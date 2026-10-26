import { useState, type ReactNode } from "react";

export function PaymentPages<T>({
  items,
  identify,
  children,
  itemName = "payment",
}: {
  items: readonly T[];
  identify: (item: T) => string;
  children: (item: T, index: number) => ReactNode;
  itemName?: string;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const search = query.toLowerCase();
  const matches = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => identify(item).toLowerCase().includes(search));
  const count = Math.max(1, Math.ceil(matches.length / 60));
  const current = Math.min(page, count - 1);
  return (
    <>
      {(items.length > 60 || query) && (
        <div className="payment-pagination">
          <input
            aria-label={`Find ${itemName}`}
            placeholder={`Find ${itemName} by ID`}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
          <div>
            <button
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              Previous page
            </button>
            <span>
              {current + 1} / {count} · {matches.length.toLocaleString()}{" "}
              {itemName}s
            </span>
            <button
              disabled={current + 1 >= count}
              onClick={() => setPage(current + 1)}
            >
              Next page
            </button>
          </div>
        </div>
      )}
      {matches
        .slice(current * 60, (current + 1) * 60)
        .map(({ item, index }) => children(item, index))}
    </>
  );
}
