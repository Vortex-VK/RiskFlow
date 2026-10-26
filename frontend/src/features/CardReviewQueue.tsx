import type { components } from "../api/generated";
import type { DeepReadonly } from "../domain/runs";
import { money } from "../domain/types";
import { PaymentPages } from "./PaymentPages";

type ReviewEvent = DeepReadonly<components["schemas"]["EventResult"]>;

export function CardReviewQueue({
  events,
  truth,
  sourceId,
  inspect,
}: {
  events: readonly ReviewEvent[];
  truth: Readonly<Record<string, string>>;
  sourceId: (id: string) => string;
  inspect: (event: ReviewEvent) => void;
}) {
  const leads = events.filter((e) => e.cardPattern);
  const versioned = leads.some((e) => e.cardPattern?.priority);
  const groups = versioned
    ? [
        {
          name: "Prioritized card reviews",
          items: leads.filter(
            (e) => e.cardPattern?.priority?.level === "prioritized",
          ),
        },
        {
          name: "Exploratory card leads",
          items: leads.filter(
            (e) => e.cardPattern?.priority?.level !== "prioritized",
          ),
        },
      ]
    : [{ name: "Card review leads", items: leads }];
  return (
    <>
      {versioned && (
        <p>
          Prioritized leads appear first. All exploratory leads remain listed;
          prioritization does not increase detection counts or establish fraud.
        </p>
      )}
      {groups.map(({ name, items }) => (
        <section key={name} aria-label={name}>
          <h4>
            {name} ({items.length})
          </h4>
          {items.some((e) => truth[e.eventId]) && (
            <p>
              Among labeled leads in this group:{" "}
              {items.filter((e) => truth[e.eventId] === "fraudulent").length}{" "}
              fraudulent,{" "}
              {items.filter((e) => truth[e.eventId] === "legitimate").length}{" "}
              legitimate.
            </p>
          )}
          {items.length === 0 ? (
            <p>No leads in this group.</p>
          ) : (
            <PaymentPages items={items} identify={(e) => sourceId(e.eventId)}>
              {(e) => (
                <button
                  key={e.eventId}
                  className="wide"
                  onClick={() => inspect(e)}
                >
                  Inspect card review {sourceId(e.eventId)} ·{" "}
                  {money(e.amountMinor)}
                </button>
              )}
            </PaymentPages>
          )}
        </section>
      ))}
    </>
  );
}
