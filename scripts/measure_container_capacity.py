"""Measure real HTTP requests in fresh Linux Docker containers with swap disabled.

Client and payload preparation run on the host, outside the measured cgroup.
Reports include the cgroup high-water mark, anon/file memory, OOM events, response
sizes, and latency. A completed experiment is not necessarily a passing fit.
"""

import argparse
import gzip
import json
import os
import subprocess
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def docker(*args):
    return subprocess.check_output(["docker", *args], text=True, stderr=subprocess.STDOUT).strip()


def read_pairs(path):
    return {
        key: int(value) for key, value in (line.split() for line in path.read_text().splitlines())
    }


def measure(image, payloads, output, memory_mib, cpus, repeats):
    name = f"riskflow-capacity-{os.getpid()}-{memory_mib}-{cpus}"
    report = {
        "memory_limit_mib": memory_mib,
        "cpus": cpus,
        "swap_allowed": False,
        "stages": [],
        "requests_succeeded": False,
        "within_ui_timeout": False,
    }
    cgroup = None
    try:
        docker(
            "run",
            "-d",
            "--name",
            name,
            "--cpus",
            str(cpus),
            "--memory",
            f"{memory_mib}m",
            "--memory-swap",
            f"{memory_mib}m",
            "-p",
            "127.0.0.1::8000",
            image,
        )
        info = json.loads(docker("inspect", name))[0]
        pid = info["State"]["Pid"]
        port = info["NetworkSettings"]["Ports"]["8000/tcp"][0]["HostPort"]
        relative = next(
            line.split(":", 2)[2]
            for line in Path(f"/proc/{pid}/cgroup").read_text().splitlines()
            if line.startswith("0::")
        )
        cgroup = Path("/sys/fs/cgroup") / relative.lstrip("/")

        def snapshot(stage, **extra):
            stat = read_pairs(cgroup / "memory.stat")
            row = {
                "stage": stage,
                "current_mib": int((cgroup / "memory.current").read_text()) / 2**20,
                "peak_mib": int((cgroup / "memory.peak").read_text()) / 2**20,
                "anonymous_mib": stat["anon"] / 2**20,
                "file_cache_mib": stat["file"] / 2**20,
                "events": read_pairs(cgroup / "memory.events"),
                **extra,
            }
            report["stages"].append(row)
            print(json.dumps({"profile": name, **row}), flush=True)

        def request(path, payload=None):
            data = json.dumps(payload, separators=(",", ":")).encode() if payload else None
            req = Request(
                f"http://127.0.0.1:{port}{path}",
                data=data,
                headers={"Content-Type": "application/json", "Accept-Encoding": "gzip"},
            )
            with urlopen(req, timeout=180) as response:
                raw = response.read()
                decoded = (
                    gzip.decompress(raw)
                    if response.headers.get("Content-Encoding") == "gzip"
                    else raw
                )
                return json.loads(decoded), len(raw), len(decoded)

        started = time.monotonic()
        deadline = started + 120
        while True:
            try:
                request("/api/v1/health")
                break
            except (OSError, URLError):
                state = json.loads(docker("inspect", "--format", "{{json .State}}", name))
                if not state["Running"] or time.monotonic() >= deadline:
                    raise RuntimeError(f"Readiness failed: {state}") from None
                time.sleep(0.5)
        snapshot("ready", seconds=time.monotonic() - started)

        def measured(stage, path, payload):
            start = time.monotonic()
            result, wire, decoded = request(path, payload)
            snapshot(
                stage, seconds=time.monotonic() - start, wire_bytes=wire, response_bytes=decoded
            )
            return result

        for source in sorted(payloads.glob("*.json")):
            payload = json.loads(source.read_text())
            prefix = source.stem
            validation = measured(f"{prefix}/validate", "/api/v1/scenarios/validate", payload)
            assert validation["valid"], validation
            for repeat in range(1, repeats + 1):
                result = measured(f"{prefix}/simulation-{repeat}", "/api/v1/simulations", payload)
                assert len(result["events"]) == 10000
                event = max(result["events"], key=lambda e: e["model"]["ranking"]["rawMargin"])
                reference = min(result["events"], key=lambda e: e["model"]["ranking"]["rawMargin"])
                explanation = {
                    **payload,
                    "eventId": event["eventId"],
                    "modelBundleSha256": event["model"]["bundleSha256"],
                    "expectedRawMargin": event["model"]["ranking"]["rawMargin"],
                }
                del result
                measured(f"{prefix}/explanation-{repeat}", "/api/v1/explanations", explanation)
                measured(
                    f"{prefix}/comparison-{repeat}",
                    "/api/v1/explanations/compare",
                    {
                        **explanation,
                        "referenceEventId": reference["eventId"],
                        "expectedReferenceRawMargin": reference["model"]["ranking"]["rawMargin"],
                    },
                )
        snapshot("finished")
        report["requests_succeeded"] = True
        report["within_ui_timeout"] = all(
            row.get("seconds", 0) < 30 for row in report["stages"] if row["stage"] != "ready"
        )
    except (OSError, RuntimeError, AssertionError, ValueError, subprocess.SubprocessError) as error:
        report["error"] = str(error)
        if isinstance(error, HTTPError):
            report["error_body"] = error.read().decode(errors="replace")[:2000]
        if cgroup and cgroup.exists():
            report["failure_memory_peak_mib"] = int((cgroup / "memory.peak").read_text()) / 2**20
            report["failure_memory_events"] = read_pairs(cgroup / "memory.events")
    finally:
        try:
            report["container_state"] = json.loads(
                docker("inspect", "--format", "{{json .State}}", name)
            )
            (output / f"{name}.log").write_text(docker("logs", name))
        finally:
            docker("rm", "-f", name)
        (output / f"{memory_mib}m-{cpus}cpu.json").write_text(json.dumps(report, indent=2))
        print(
            json.dumps(
                {
                    "profile": name,
                    "succeeded": report["requests_succeeded"],
                    "within_ui_timeout": report["within_ui_timeout"],
                    "error": report.get("error"),
                }
            ),
            flush=True,
        )
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--image", default="riskflow:ci")
    parser.add_argument("--payloads", type=Path, default=Path(".cache/capacity-payloads"))
    parser.add_argument("--output", type=Path, default=Path(".cache/capacity-results"))
    args = parser.parse_args()
    assert len(list(args.payloads.glob("*.json"))) == 2, (
        "Generate the two CSV-derived payloads first"
    )
    args.output.mkdir(parents=True, exist_ok=True)
    reports = []
    for memory_mib, cpus, repeats in [(512, 1, 3), (1024, 1, 3), (512, 0.1, 1)]:
        reports.append(measure(args.image, args.payloads, args.output, memory_mib, cpus, repeats))
    (args.output / "summary.json").write_text(json.dumps(reports, indent=2))


if __name__ == "__main__":
    main()
