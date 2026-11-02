"""Check publishable working-tree files; optionally copy them without Git history.

This is a limited hygiene check, not a comprehensive secret or personal-data audit.
It never commits, rewrites history, removes local files, or contacts a remote.
"""

import argparse
import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATTERNS = {
    "private key": rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
    "AWS access key": rb"AKIA[0-9A-Z]{16}",
    "GitHub token": rb"(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})",
    "API token": rb"sk-(?:proj-)?[A-Za-z0-9_-]{30,}",
    "local home path": rb"(?:[A-Za-z]:[\\/]+Users[\\/]+|/home/|/Users/)[A-Za-z0-9_.-]+",
}


def git_paths(*arguments: str) -> list[str]:
    output = subprocess.check_output(["git", *arguments, "-z"], cwd=ROOT)
    return [path.decode("utf-8") for path in output.split(b"\0") if path]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--export", type=Path, help="Copy checked files to a NEW directory, without .git"
    )
    args = parser.parse_args()
    ignored = git_paths("ls-files", "--cached", "--ignored", "--exclude-standard")
    if ignored:
        raise SystemExit("Local-only files remain tracked:\n" + "\n".join(ignored))
    candidates = sorted(set(git_paths("ls-files", "--cached", "--others", "--exclude-standard")))
    paths = [name for name in candidates if (ROOT / name).is_file()]
    problems = []
    total = 0
    for name in paths:
        path = ROOT / name
        if path.is_symlink() or not path.resolve().is_relative_to(ROOT):
            problems.append(f"{name}: symlink or path outside repository")
            continue
        content = path.read_bytes()
        total += len(content)
        if len(content) > 50 * 1024 * 1024:
            problems.append(f"{name}: exceeds the 50 MiB publication limit")
        for label, pattern in PATTERNS.items():
            if re.search(pattern, content):
                problems.append(f"{name}: possible {label}")
    if problems:
        raise SystemExit("Review these files (matched values omitted):\n" + "\n".join(problems))
    print(f"Checked {len(paths)} files ({total:,} bytes); no configured hygiene findings.")
    print("This checks working-tree files only. Existing Git history is NOT sanitized.")
    if args.export:
        destination = args.export.resolve()
        if destination.exists():
            raise SystemExit("Export directory already exists; choose a new directory.")
        destination.mkdir(parents=True)
        for name in paths:
            target = destination / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / name, target)
        print(f"Copied a snapshot without Git history to {destination}")


if __name__ == "__main__":
    main()
