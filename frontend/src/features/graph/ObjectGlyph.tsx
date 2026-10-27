import { memo } from "react";
import type { Entity } from "../../domain/types";
import { jellyPath, jellyRestPoints } from "./node-motion";
import { accountInitial } from "./account-labels";
import { radius, cornerRadius } from "./geometry";
import styles from "./Graph.module.css";

type Glyph = Pick<Entity, "id" | "name" | "type">;

export const ObjectGlyph = memo(function ObjectGlyph({
  node,
  selected = false,
  review,
  accountLabel = accountInitial(node.name),
}: {
  node: Glyph;
  selected?: boolean;
  review?: "flagged" | "selected" | undefined;
  accountLabel?: string;
}) {
  const r = radius(node);
  const corner = cornerRadius(node);
  return (
    <svg width="100" height="100" viewBox="-50 -50 100 100" overflow="visible">
      <g
        data-node={node.id}
        data-review={review}
        className={selected ? styles.selected : ""}
      >
        <circle className="node-hit" r={r + 8} fill="transparent" />
        {review && (
          <circle
            className="node-review-ring"
            r={r + 5}
            fill="none"
            stroke="var(--transaction-review)"
            strokeWidth={review === "selected" ? 3 : 1.5}
            opacity={review === "selected" ? 1 : 0.65}
            pointerEvents="none"
            aria-hidden="true"
          />
        )}
        <g className="node-material" pointerEvents="none">
          <path
            className="node-body"
            data-radius={r}
            data-corner={corner}
            d={jellyPath(jellyRestPoints(r, corner))}
          />
          {node.type === "account" ? (
            <text className={styles.initial} textAnchor="middle" y="6">
              {accountLabel}
            </text>
          ) : (
            <path
              className={styles.icon}
              d={
                node.type === "device"
                  ? "M-6-10H6V10H-6ZM-2 7H2"
                  : node.type === "merchant"
                    ? "M-9-5H9V9H-9ZM-11-5L-7-10H7L11-5M-3 9V2H3V9"
                    : "M0-3a3 3 0 1 0 0 6a3 3 0 1 0 0-6"
              }
            />
          )}
        </g>
        {review && (
          <g
            className="node-review-badge"
            transform={`translate(${r * 0.85},${-r * 0.85})`}
            pointerEvents="none"
            aria-hidden="true"
          >
            <circle
              r="8"
              fill="var(--transaction-review)"
              stroke="var(--canvas)"
              strokeWidth="2"
            />
            <path
              d="M0 -3.5V0.5M0 3.5V3.6"
              fill="none"
              stroke="#301b17"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </g>
        )}
      </g>
      <text className={styles.label} y={r + 22}>
        {node.name.length > 27 ? node.name.slice(0, 25) + "…" : node.name}
      </text>
    </svg>
  );
});
