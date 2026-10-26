import { useState } from "react";
import { CloseIcon } from "../CloseIcon";
import { assertIntegrity, clone } from "../../domain/commands";
import { useWorkspace } from "../../state/workspace";

export function PolicyForm({ close }: { close: () => void }) {
  const state = useWorkspace();
  const document = state.document!;
  const [values, setValues] = useState({
    reviewCost: (
      document.scenario.costAssumptions.reviewCostMinor / 100
    ).toFixed(2),
    falseBlockCost: (
      document.scenario.costAssumptions.falseBlockCostMinor / 100
    ).toFixed(2),
    fraudLoss: (
      document.scenario.costAssumptions.approvedFraudLossBps / 100
    ).toFixed(2),
  });
  const [error, setError] = useState("");
  const cancel = () => {
    useWorkspace.setState({ dirty: false });
    close();
  };
  const decimal = (text: string) => {
    if (!/^\d+(?:\.\d{1,2})?$/.test(text))
      throw new Error(
        "Use a nonnegative number with at most two decimal places.",
      );
    const [whole = "", fraction = ""] = text.split(".");
    return Number(BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0")));
  };
  return (
    <aside
      className="card inspector"
      aria-label="Policy and costs"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          cancel();
        }
      }}
    >
      <button
        className="close"
        aria-label="Close policy and costs"
        onClick={cancel}
      >
        <CloseIcon />
      </button>
      <h2>Policy &amp; costs</h2>
      <p>
        Simulation uses fixed alert thresholds. Alerts go to review; no payments
        are blocked. Costs are illustrative assumptions and do not change model
        predictions.
      </p>
      <form
        data-scenario-form
        onSubmit={(event) => {
          event.preventDefault();
          try {
            const next = clone(document);
            next.scenario.costAssumptions = {
              reviewCostMinor: decimal(values.reviewCost),
              falseBlockCostMinor: decimal(values.falseBlockCost),
              approvedFraudLossBps: decimal(values.fraudLoss),
            };
            state.commit(
              assertIntegrity(next),
              "Policy and costs applied. Simulate to compare the results.",
            );
            close();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Invalid assumptions.");
          }
        }}
      >
        {(
          [
            ["reviewCost", "Cost per review · USD"],
            ["falseBlockCost", "Cost per false block · USD"],
            ["fraudLoss", "Approved fraud loss · percent"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              required
              value={values[key]}
              inputMode="decimal"
              onChange={(e) => {
                setValues({ ...values, [key]: e.target.value });
                setError("");
                useWorkspace.setState({ dirty: true });
              }}
            />
          </label>
        ))}
        {error && <p role="alert">{error}</p>}
        <div className="inline-actions">
          <button className="primary">Apply</button>
          <button type="button" onClick={cancel}>
            Cancel
          </button>
        </div>
      </form>
    </aside>
  );
}
