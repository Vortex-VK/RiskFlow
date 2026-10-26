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
  accountLabel = accountInitial(node.name),
}: {
  node: Glyph;
  selected?: boolean;
  accountLabel?: string;
}) {
  const r = radius(node);
  const corner = cornerRadius(node);
  return (
    <svg width="100" height="100" viewBox="-50 -50 100 100" overflow="visible">
      <g data-node={node.id} className={selected ? styles.selected : ""}>
        <circle className="node-hit" r={r + 8} fill="transparent" />
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
      </g>
      <text className={styles.label} y={r + 22}>
        {node.name.length > 27 ? node.name.slice(0, 25) + "…" : node.name}
      </text>
    </svg>
  );
});
