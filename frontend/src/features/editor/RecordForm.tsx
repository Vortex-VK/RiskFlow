import { useEffect, useRef, useState } from "react";
import type {
  Association,
  Document,
  Entity,
  Payment,
  Selection,
} from "../../domain/types";
import { categories, country, parseMoney, utc } from "../../domain/types";
import {
  affectedPayments,
  assertIntegrity,
  clone,
  contextFor,
  starterContext,
} from "../../domain/commands";
import { useWorkspace } from "../../state/workspace";
import type { Draft } from "./draft";
import styles from "./Editor.module.css";

type Fields = Record<string, string>;

function fieldsFor(record: Entity | Payment | Association): Fields {
  const fields: Fields = {};
  for (const [key, value] of Object.entries(record))
    fields[key] = Array.isArray(value)
      ? value.join(", ")
      : value === null
        ? ""
        : String(value);
  if ("amountMinor" in record)
    fields.amount = (record.amountMinor / 100).toFixed(2);
  if ("amountMinor" in record) {
    const model = record.modelInput;
    fields.channel = record.rankingInput?.channel ?? model?.channel ?? "";
    fields.mcc = model?.mcc ?? "";
    fields.completed = record.rankingInput
      ? record.rankingInput.completed === null
        ? ""
        : String(record.rankingInput.completed)
      : model
        ? String(model.completed)
        : "";
    fields.merchantState =
      record.rankingInput?.merchantRegion ?? model?.merchantState ?? "";
    fields.merchantCity =
      record.rankingInput?.merchantCity ?? model?.merchantCity ?? "";
    fields.merchantZip = model?.merchantZip ?? "";
  }
  if ("typicalAmountMinor" in record)
    fields.typicalAmount = (record.typicalAmountMinor / 100).toFixed(2);
  return fields;
}

export function RecordForm({
  document,
  selection,
  draft,
  close,
}: {
  document: Document;
  selection: NonNullable<Selection>;
  draft: Draft | null;
  close: () => void;
}) {
  const state = useWorkspace();
  const record =
    draft?.record ||
    (selection.kind === "node"
      ? document.scenario.nodes.find((n) => n.id === selection.id)
      : selection.kind === "payment"
        ? document.scenario.payments.find((p) => p.id === selection.id)
        : document.scenario.associations.find((a) => a.id === selection.id));
  if (!record) return null;
  return (
    <RecordFields
      key={JSON.stringify(record)}
      document={document}
      selection={selection}
      record={record}
      creating={!!draft}
      close={close}
      commit={state.commit}
    />
  );
}

function RecordFields({
  document,
  selection,
  record,
  creating,
  close,
  commit,
}: {
  document: Document;
  selection: NonNullable<Selection>;
  record: Entity | Payment | Association;
  creating: boolean;
  close: () => void;
  commit: (document: Document, message: string) => void;
}) {
  const [fields, setFields] = useState(() => fieldsFor(record));
  const [label, setLabel] = useState(
    document.scenario.groundTruth[record.id] || "",
  );
  const [preserve, setPreserve] = useState("preserve");
  const [riskChanged, setRiskChanged] = useState(false);
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => () => useWorkspace.setState({ previewContext: null }), []);
  const affected = creating
    ? []
    : affectedPayments(document, selection).filter(
        (p) => document.scenario.groundTruth[p.id],
      );
  const name = (id: string) =>
    document.scenario.nodes.find((n) => n.id === id)?.name || id;
  const contextComplete =
    "type" in record &&
    record.type === "account" &&
    contextFor(document, record.id, "accountDevice").length > 0 &&
    contextFor(document, record.id, "accountLocation").length > 0;
  const change = (key: string, value: string) => {
    setFields((old) => ({ ...old, [key]: value }));
    if (!["name", "description", "regionLabel"].includes(key))
      setRiskChanged(true);
    setError("");
    const next = { ...fields, [key]: value };
    useWorkspace.setState({
      dirty: true,
      previewContext:
        selection.kind === "payment"
          ? {
              accountId: next.accountId!,
              merchantId: next.merchantId!,
              deviceId: next.deviceId!,
              locationId: next.locationId!,
            }
          : null,
    });
  };
  const input = (
    key: string,
    title: string,
    type = "text",
    optional = false,
  ) => (
    <label key={key}>
      {title}
      <input
        name={key}
        type={type}
        value={fields[key] || ""}
        required={!optional}
        maxLength={key === "name" ? 80 : undefined}
        pattern={key === "mcc" ? "[0-9]{4}" : undefined}
        inputMode={key === "mcc" ? "numeric" : undefined}
        step={type === "datetime-local" ? ".001" : undefined}
        onChange={(e) => change(key, e.target.value)}
      />
    </label>
  );
  const time = (key: string, title: string, optional = false) => (
    <label key={key}>
      {title} · UTC
      <input
        name={key}
        type="datetime-local"
        step=".001"
        value={(fields[key] || "").replace(/Z$/, "")}
        required={!optional}
        onChange={(e) => change(key, e.target.value)}
      />
    </label>
  );
  const select = (
    key: string,
    title: string,
    choices: { id: string; name: string }[],
    optional = false,
  ) => (
    <label key={key}>
      {title}
      <select
        name={key}
        value={fields[key] || ""}
        required={!optional}
        onChange={(e) => change(key, e.target.value)}
      >
        {!optional && <option value="">Choose {title.toLowerCase()}</option>}
        {choices.map((choice) => (
          <option key={choice.id} value={choice.id}>
            {choice.name}
          </option>
        ))}
      </select>
    </label>
  );
  function save(addContext = false) {
    try {
      let next = clone(document);
      if (selection.kind === "node" && "type" in record && "name" in record) {
        const updated = { ...record, name: fields.name!.trim() } as Entity;
        if (updated.type === "account") {
          updated.openedAt = utc(fields.openedAt!);
          updated.typicalAmountMinor = parseMoney(fields.typicalAmount!);
          updated.usualCountryCodes = fields
            .usualCountryCodes!.split(",")
            .map(country);
          const values = fields
            .usualMerchantCategories!.split(",")
            .map((s) => s.trim());
          if (values.some((v) => !categories.some((c) => c === v)))
            throw new Error(
              "Use the listed merchant categories, separated by commas.",
            );
          updated.usualMerchantCategories =
            values as typeof updated.usualMerchantCategories;
        }
        if (updated.type === "merchant") {
          updated.category = fields.category as typeof updated.category;
          updated.countryCode = country(fields.countryCode!);
        }
        if (updated.type === "location") {
          updated.countryCode = country(fields.countryCode!);
          if (fields.regionLabel?.trim())
            updated.regionLabel = fields.regionLabel.trim();
          else delete updated.regionLabel;
        }
        if (updated.type === "device") {
          if (fields.description?.trim())
            updated.description = fields.description.trim();
          else delete updated.description;
        }
        next.scenario.nodes = next.scenario.nodes.map((n) =>
          n.id === record.id ? updated : n,
        );
        if (addContext && updated.type === "account")
          next = starterContext(next, updated.id);
      } else if (selection.kind === "payment") {
        const merchant = document.scenario.nodes.find(
          (node) => node.id === fields.merchantId && node.type === "merchant",
        );
        const payment: Payment = {
          ...(record as Payment),
          id: record.id,
          accountId: fields.accountId!,
          merchantId: fields.merchantId!,
          deviceId: fields.deviceId!,
          locationId: fields.locationId!,
          occurredAt: utc(fields.occurredAt!),
          amountMinor: parseMoney(fields.amount!),
          modelInput: {
            channel: (fields.channel || "Chip Transaction") as NonNullable<
              Payment["modelInput"]
            >["channel"],
            mcc: fields.mcc?.trim() || "5411",
            completed: fields.completed !== "false",
            merchantState: fields.merchantState || "",
            merchantCity: fields.merchantCity || "",
            merchantZip: fields.merchantZip || "",
          },
          category: fields.category
            ? (fields.category as NonNullable<Payment["category"]>)
            : merchant?.type === "merchant"
              ? merchant.category
              : "other",
        };
        // Preserve unknown imported fields when editing unrelated graph context.
        if (payment.rankingInput) {
          if (
            ![
              "Chip Transaction",
              "Online Transaction",
              "Swipe Transaction",
            ].includes(payment.modelInput!.channel)
          )
            payment.modelInput = null;
          const previous = fieldsFor(record);
          payment.rankingInput = { ...payment.rankingInput };
          for (const [field, target] of [
            ["mcc", "category"],
            ["channel", "channel"],
            ["merchantState", "merchantRegion"],
            ["merchantCity", "merchantCity"],
          ] as const)
            if (fields[field] !== previous[field])
              payment.rankingInput[target] = fields[field] || "";
          if (fields.completed !== previous.completed)
            payment.rankingInput.completed = fields.completed
              ? fields.completed !== "false"
              : null;
          if (fields.occurredAt !== previous.occurredAt)
            payment.rankingInput.timePrecision = "second";
          if (fields.merchantId !== previous.merchantId)
            payment.rankingInput.merchantIdProvided = true;
        }
        if (creating) next.scenario.payments.push(payment);
        else
          next.scenario.payments = next.scenario.payments.map((p) =>
            p.id === record.id ? payment : p,
          );
        if (label === "legitimate" || label === "fraudulent")
          next.scenario.groundTruth[record.id] = label;
        else delete next.scenario.groundTruth[record.id];
      } else if (
        selection.kind === "association" &&
        "accountId" in record &&
        "knownFrom" in record
      ) {
        const a: Association = {
          ...record,
          observedAt: utc(fields.observedAt!),
          knownFrom: fields.knownFrom ? utc(fields.knownFrom) : null,
        };
        if (creating) next.scenario.associations.push(a);
        else
          next.scenario.associations = next.scenario.associations.map((old) =>
            old.id === record.id ? a : old,
          );
      }
      if (riskChanged && preserve === "clear")
        for (const p of affected) delete next.scenario.groundTruth[p.id];
      assertIntegrity(next);
      commit(
        next,
        addContext
          ? "Account saved with connected device and location. Undo is available."
          : creating
            ? "Added to the scenario. Undo is available."
            : "Changes applied. Undo is available.",
      );
      if (creating) {
        close();
        useWorkspace.getState().select(selection);
      } else if (selection.kind === "node" && !addContext) close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please check the fields.");
      requestAnimationFrame(() => errorRef.current?.focus());
    }
  }
  return (
    <form
      data-scenario-form
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
      onInvalid={(event) => {
        let section = (event.target as HTMLElement).closest("details");
        while (section) {
          section.open = true;
          section = section.parentElement?.closest("details") || null;
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          useWorkspace.setState({ dirty: false });
          close();
        }
      }}
    >
      {selection.kind === "node" && "name" in record && (
        <>
          {input("name", "Name")}
          {"type" in record && record.type === "account" && (
            <button
              type="button"
              data-tour="starter-context"
              className="wide"
              disabled={contextComplete}
              onClick={(event) => {
                if (event.currentTarget.form?.reportValidity()) save(true);
              }}
            >
              {contextComplete
                ? "Device & location connected"
                : "Create starter context"}
            </button>
          )}
          {"type" in record && record.type === "account" && (
            <details>
              <summary>Account baseline</summary>
              {time("openedAt", "Opened")}
              {input("typicalAmount", "Typical purchase · USD")}
              {input("usualCountryCodes", "Usual countries · ISO codes")}
              {input("usualMerchantCategories", "Usual merchant categories")}
              <p className={styles.note}>{categories.join(", ")}</p>
            </details>
          )}
          {"type" in record && record.type === "merchant" && (
            <>
              {select(
                "category",
                "Category",
                categories.map((c) => ({ id: c, name: c })),
              )}
              {input("countryCode", "Country · ISO code")}
            </>
          )}
          {"type" in record && record.type === "location" && (
            <>
              {input("countryCode", "Country · ISO code")}
              {input("regionLabel", "Region", "text", true)}
            </>
          )}
          {"type" in record &&
            record.type === "device" &&
            input("description", "Description", "text", true)}
        </>
      )}
      {selection.kind === "payment" && (
        <>
          {input("amount", "Amount · USD")}
          {time("occurredAt", "Payment time")}
          <details>
            <summary>Additional information</summary>
            <p className={styles.note}>
              Optional. Blank fields use the merchant's category, Chip
              Transaction, MCC 5411, and Completed.
            </p>
            {select(
              "category",
              "Payment category",
              [
                { id: "", name: "Use merchant category" },
                ...categories.map((category) => ({
                  id: category,
                  name: category,
                })),
              ],
              true,
            )}
            {(record as Payment).sourceCategory && (
              <p className={styles.note}>
                Original CSV category: {(record as Payment).sourceCategory}
              </p>
            )}
            {select(
              "channel",
              "Transaction channel",
              [
                { id: "", name: "Default: Chip Transaction" },
                ...[
                  "Chip Transaction",
                  "Online Transaction",
                  "Swipe Transaction",
                ].map((id) => ({ id, name: id })),
              ],
              true,
            )}
            {input("mcc", "Merchant category code (four digits)", "text", true)}
            {select(
              "completed",
              "Completion status",
              [
                { id: "", name: "Default: Completed" },
                { id: "true", name: "Completed" },
                { id: "false", name: "Failed or declined" },
              ],
              true,
            )}
            <details>
              <summary>Merchant geography (optional)</summary>
              {input("merchantState", "Merchant state", "text", true)}
              {input("merchantCity", "Merchant city", "text", true)}
              {input("merchantZip", "Merchant ZIP", "text", true)}
            </details>
          </details>
          {select(
            "deviceId",
            "Device",
            contextFor(document, fields.accountId!, "accountDevice").map(
              (a) => ({ id: a.targetId, name: name(a.targetId) }),
            ),
          )}
          {select(
            "locationId",
            "Location",
            contextFor(document, fields.accountId!, "accountLocation").map(
              (a) => ({ id: a.targetId, name: name(a.targetId) }),
            ),
          )}
          {(!fields.deviceId || !fields.locationId) && (
            <p className={styles.note}>
              Need a device or location? Close this edit and choose Create
              starter context on the account.
            </p>
          )}
          <details>
            <summary>Endpoints & synthetic label</summary>
            {select(
              "accountId",
              "Account",
              document.scenario.nodes.filter((n) => n.type === "account"),
            )}
            {select(
              "merchantId",
              "Merchant",
              document.scenario.nodes.filter((n) => n.type === "merchant"),
            )}
            <label>
              Synthetic label
              <select
                value={label}
                onChange={(e) => {
                  setLabel(e.target.value);
                  useWorkspace.setState({ dirty: true });
                }}
              >
                <option value="">Unlabeled</option>
                <option value="legitimate">Legitimate</option>
                <option value="fraudulent">Fraudulent</option>
              </select>
            </label>
            <p className={styles.note}>
              An author assertion, never inferred from a score.
            </p>
          </details>
        </>
      )}
      {selection.kind === "association" && "targetId" in record && (
        <>
          <p>
            {name(record.accountId)} → {name(record.targetId)}
          </p>
          {time("observedAt", "First observed")}
          {time("knownFrom", "Familiar since", true)}
          <p className={styles.note}>
            Leave familiarity empty for an unfamiliar relationship.
          </p>
        </>
      )}
      {riskChanged && affected.length > 0 && (
        <label className={styles.labelChoice}>
          {affected.length} affected labeled payment
          {affected.length === 1 ? "" : "s"}
          <select
            value={preserve}
            onChange={(e) => setPreserve(e.target.value)}
          >
            <option value="preserve">
              Preserve synthetic label{affected.length > 1 ? "s" : ""}
            </option>
            <option value="clear">
              Clear label{affected.length > 1 ? "s" : ""}
            </option>
          </select>
          <span>
            Labels are author assertions; changing facts does not revalidate
            them.
          </span>
        </label>
      )}
      {error && (
        <p ref={errorRef} tabIndex={-1} role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <button className="primary" type="submit">
          {creating ? "Add" : "Apply"}
        </button>
        <button
          type="button"
          onClick={() => {
            useWorkspace.setState({ dirty: false });
            close();
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
