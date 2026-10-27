import { readGraphView, rememberGraphView } from "./view-memory";
import { firingOpacity, growthTree } from "./growth";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ReactFlow,
  Handle,
  Position as HandlePosition,
  BaseEdge,
  useReactFlow,
} from "@xyflow/react";
import type {
  Node,
  NodeProps,
  Edge,
  EdgeProps,
  OnNodesChange,
  Viewport,
} from "@xyflow/react";
import type { Document, Entity, Position, Selection } from "../../domain/types";
import { groupId } from "../../domain/types";
import { clone } from "../../domain/commands";
import { guarded, useWorkspace } from "../../state/workspace";
import { createElasticNodes } from "./node-motion";
import type { ElasticPose } from "./node-motion";
import { ObjectGlyph } from "./ObjectGlyph";
import { radius } from "./geometry";
import { pushObjects } from "./collisions";
import type { Contact } from "./collisions";
import { accountLabels } from "./account-labels";
import styles from "./Graph.module.css";
type ObjectNode = Node<
  {
    entity: Entity;
    accountLabel: string;
    highlighted: boolean;
    compatible: boolean;
    review: "flagged" | "selected" | undefined;
  },
  "object"
>;
type Link = Edge<
  {
    start: Position;
    end: Position;
    radiusStart: number;
    radiusEnd: number;
    count: number;
    context: boolean;
    highlighted: boolean;
    comparison?: string;
    pulse?: number;
    risk?: "review" | "block";
    temporal?: "future" | "observed" | "familiar";
  },
  "link"
>;
function ObjectView({ data, selected }: NodeProps<ObjectNode>) {
  return (
    <div
      className={`${styles.object} node-${data.entity.type} ${data.compatible ? "node-compatible" : ""} nopan`}
    >
      <ObjectGlyph
        node={data.entity}
        accountLabel={data.accountLabel}
        selected={selected || data.highlighted}
        review={data.review}
      />
      <Handle
        type="source"
        position={HandlePosition.Right}
        className={styles.anchor}
        isConnectable={false}
        aria-hidden="true"
      />
      <Handle
        type="target"
        position={HandlePosition.Left}
        className={styles.anchor}
        isConnectable={false}
        aria-hidden="true"
      />
    </div>
  );
}

function LinkView({ id, data, selected }: EdgeProps<Link>) {
  if (!data) return null;
  const dx = data.end.x - data.start.x,
    dy = data.end.y - data.start.y;
  const length = Math.hypot(dx, dy) || 1;
  const x1 = data.start.x + (dx / length) * (data.radiusStart + 3),
    y1 = data.start.y + (dy / length) * (data.radiusStart + 3);
  const x2 = data.end.x - (dx / length) * (data.radiusEnd + 5),
    y2 = data.end.y - (dy / length) * (data.radiusEnd + 5);
  const color = data.risk
    ? `var(--transaction-${data.risk})`
    : "var(--transaction-cyan)";
  return (
    <>
      <BaseEdge
        id={id}
        path={`M${x1},${y1}L${x2},${y2}`}
        interactionWidth={18}
        markerEnd={
          data.context
            ? ""
            : `url(#payment-arrow${data.risk ? `-${data.risk}` : ""})`
        }
        style={{
          stroke: data.risk
            ? color
            : selected || data.highlighted || data.comparison
              ? "var(--accent)"
              : "var(--edge)",
          filter: undefined,
          strokeWidth: data.risk || selected || data.highlighted ? 2 : 1.2,
          strokeDasharray: data.context
            ? data.temporal === "future"
              ? "1 8"
              : data.temporal === "familiar"
                ? "8 5"
                : "3 6"
            : undefined,
          opacity: data.temporal === "future" ? 0.25 : 1,
        }}
      />
      {data.pulse !== undefined && (
        <g
          className="payment-pulse"
          data-progress={data.pulse}
          opacity={firingOpacity(data.pulse)}
          style={{
            color: "var(--transaction-cyan)",

            pointerEvents: "none",
          }}
        >
          <path
            d={`M${x1},${y1}L${x2},${y2}`}
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
          />
        </g>
      )}
      {(data.count > 1 || data.comparison) && (
        <text
          x={(x1 + x2) / 2}
          y={(y1 + y2) / 2 - 7}
          className={`${styles.edgeLabel} ${data.comparison ? styles.comparisonLabel : ""}`}
        >
          {data.comparison || data.count}
        </text>
      )}
    </>
  );
}

const nodeTypes = { object: ObjectView };
const edgeTypes = { link: LinkView };

export function DetailGraph({
  add,
  snapshot,
  eventId,
  evidenceIds = [],
  revealedIds,
  pulses = [],
  contextTime,
  decisions = [],
  inspect,
  restoreViewport = false,
  comparison,
  placing = null,
  connecting = null,
  chooseTarget,
  connectObjects,
  arrival,
  scope,
  paymentScope,
  hierarchyViewport,
  memoryKey,
  flaggedIds,
  flaggedOnly = false,
}: {
  memoryKey?: string;
  navigationTarget?: HTMLElement | null;
  hierarchyViewport?: Viewport;
  scope?: Set<string>;
  paymentScope?: Set<string>;
  focusPaymentId?: string | undefined;
  flaggedIds?: ReadonlySet<string>;
  flaggedOnly?: boolean;
  add: (kind: Entity["type"], point: Position) => void;
  snapshot?: Document;
  eventId?: string;
  evidenceIds?: readonly string[];
  revealedIds?: readonly string[];
  pulses?: readonly { eventId: string; progress: number }[];
  contextTime?: string;
  decisions?: readonly {
    eventId: string;
    accountId: string;
    merchantId: string;
    decision: string;
  }[];
  inspect?: (selection: Selection) => void;
  restoreViewport?: boolean;
  comparison?: Record<string, string>;
  placing?: Entity["type"] | null;
  connecting?: string | null;
  chooseTarget?: (id: string) => void;
  connectObjects?: (source: string, target: string) => void;
  arrival?: { id: string; pose?: ElasticPose; contacts?: Contact[] } | null;
}) {
  const workspace = useWorkspace();
  const document = snapshot || workspace.document!;
  const visibleNodes = useMemo(
    () => document.scenario.nodes.filter((n) => !scope || scope.has(n.id)),
    [document.scenario.nodes, scope],
  );
  const visiblePayments = useMemo(
    () =>
      document.scenario.payments.filter(
        (p) => !paymentScope || paymentScope.has(p.id),
      ),
    [document.scenario.payments, paymentScope],
  );
  const visibleIdsRef = useRef(scope);
  visibleIdsRef.current = scope;
  const readOnly = !!snapshot;
  const selection = readOnly ? null : workspace.selection;
  const flow = useReactFlow<ObjectNode, Link>();
  const container = useRef<HTMLDivElement>(null);
  const suppressConnectionMenu = useRef(false);
  const [connectionDrag, setConnectionDrag] = useState<{
    source: string;
    start: Position;
    end: Position;
  } | null>(null);
  const connectionSource = connectionDrag?.source || connecting;
  useEffect(() => {
    const cancel = () => setConnectionDrag(null);
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && connectionDrag) {
        event.stopImmediatePropagation();
        cancel();
      }
    };
    window.addEventListener("keydown", escape, true);
    window.addEventListener("blur", cancel);
    return () => {
      window.removeEventListener("keydown", escape, true);
      window.removeEventListener("blur", cancel);
    };
  }, [connectionDrag]);
  const initialViewport = useRef(false);
  const [remembered] = useState(() =>
    !scope && memoryKey ? readGraphView(memoryKey) : undefined,
  );
  const motionRef = useRef<ReturnType<typeof createElasticNodes> | null>(null);
  const [measurements, setMeasurements] = useState<
    Record<string, NonNullable<ObjectNode["measured"]>>
  >({});
  const onNodesChange = useCallback<OnNodesChange<ObjectNode>>((changes) => {
    const dimensions = changes.filter((change) => change.type === "dimensions");
    if (!dimensions.length) return;
    setMeasurements((current) => {
      const next = { ...current };
      let changed = false;
      for (const change of dimensions) {
        if (
          change.dimensions &&
          (current[change.id]?.width !== change.dimensions.width ||
            current[change.id]?.height !== change.dimensions.height)
        ) {
          next[change.id] = change.dimensions;
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, []);
  const [inspectionPositions, setInspectionPositions] = useState<
    Record<string, Position>
  >({});
  const inspectionPositionsRef = useRef<Record<string, Position>>({});
  function moveForInspection(next: Record<string, Position>) {
    inspectionPositionsRef.current = next;
    setInspectionPositions(next);
  }
  const positions = {
    ...document.view.positions,
    ...(readOnly ? inspectionPositions : {}),
    ...(!readOnly ? workspace.dragging?.positions : {}),
  };
  const payment = readOnly
    ? document.scenario.payments.find((p) => p.id === eventId)
    : workspace.previewContext ||
      (selection?.kind === "payment"
        ? document.scenario.payments.find((p) => p.id === selection.id)
        : undefined);
  const evidencePayments = document.scenario.payments.filter((p) =>
    evidenceIds.includes(p.id),
  );
  const paymentById = useMemo(
    () => new Map(document.scenario.payments.map((p) => [p.id, p])),
    [document.scenario.payments],
  );
  const activePaths = new Map<string, number>();
  for (const pulse of pulses) {
    const p = paymentById.get(pulse.eventId);
    if (!p) continue;
    const key = groupId(p.accountId, p.merchantId);
    const previous = activePaths.get(key);
    if (
      previous === undefined ||
      firingOpacity(pulse.progress) > firingOpacity(previous)
    )
      activePaths.set(key, pulse.progress);
  }
  const highlighted = new Set(
    payment
      ? [
          payment.accountId,
          payment.merchantId,
          payment.deviceId,
          payment.locationId,
        ]
      : [],
  );
  for (const p of evidencePayments)
    for (const id of [p.accountId, p.merchantId, p.deviceId, p.locationId])
      highlighted.add(id);
  const labels = useMemo(
    () => accountLabels(document.scenario.nodes),
    [document.scenario.nodes],
  );
  const flaggedObjects = useMemo(() => {
    const ids = new Set<string>();
    for (const p of visiblePayments) {
      if (flaggedIds?.has(p.id))
        for (const id of [p.accountId, p.merchantId, p.deviceId, p.locationId])
          ids.add(id);
    }
    return ids;
  }, [visiblePayments, flaggedIds]);
  const flaggedMerchants = useMemo(
    () =>
      new Set(
        visiblePayments
          .filter((p) => flaggedIds?.has(p.id))
          .map((p) => p.merchantId),
      ),
    [visiblePayments, flaggedIds],
  );
  const growth = useMemo(() => {
    const points = visibleNodes.map((n) => ({
      ...document.view.positions[n.id]!,
      id: n.id,
    }));
    const byId = new Map(points.map((p) => [p.id, p]));
    const links: [(typeof points)[number], (typeof points)[number]][] = [];
    const connect = (source: string, target: string) => {
      const a = byId.get(source),
        b = byId.get(target);
      if (a && b) links.push([a, b]);
    };
    for (const p of visiblePayments) connect(p.accountId, p.merchantId);
    for (const a of document.scenario.associations)
      connect(a.accountId, a.targetId);
    return new Map(growthTree(points, links).map((b) => [b.point.id, b.time]));
  }, [
    visibleNodes,
    visiblePayments,
    document.view.positions,
    document.scenario.associations,
  ]);
  const nodes: ObjectNode[] = visibleNodes.map((entity) => ({
    id: entity.id,
    type: "object",
    origin: [0.5, 0.5],
    position: positions[entity.id]!,
    measured: measurements[entity.id] || { width: 100, height: 100 },
    data: {
      entity,
      accountLabel: labels.get(entity.id) || "",
      highlighted: readOnly && highlighted.has(entity.id),
      review: flaggedMerchants.has(entity.id)
        ? payment?.merchantId === entity.id &&
          eventId &&
          flaggedIds?.has(eventId)
          ? "selected"
          : "flagged"
        : undefined,
      compatible:
        !!connectionSource &&
        (entity.type === "account") !==
          (document.scenario.nodes.find((n) => n.id === connectionSource)
            ?.type ===
            "account"),
    },
    selected: selection?.kind === "node" && selection.id === entity.id,
    ariaLabel: `${entity.type}: ${entity.name}${entity.type === "account" ? ` (${labels.get(entity.id)})` : ""}${flaggedMerchants.has(entity.id) ? ", has payments for review" : ""}`,
    style: {
      animationDelay: `${growth.get(entity.id) || 0}ms`,
      width: 100,
      height: 100,
      opacity:
        flaggedOnly && !flaggedObjects.has(entity.id)
          ? 0.18
          : !readOnly && payment && !highlighted.has(entity.id)
            ? 0.28
            : 1,
    },
  }));
  const nodeMap = new Map(visibleNodes.map((n) => [n.id, n]));
  const grouped = useMemo(() => {
    const groups = new Map<
      string,
      { accountId: string; merchantId: string; count: number }
    >();
    for (const p of visiblePayments) {
      const key = groupId(p.accountId, p.merchantId);
      const old = groups.get(key);
      groups.set(key, {
        accountId: p.accountId,
        merchantId: p.merchantId,
        count:
          (old?.count || 0) +
          (revealedIds && !revealedIds.includes(p.id) ? 0 : 1),
      });
    }
    return groups;
  }, [visiblePayments, revealedIds]);
  const risks = useMemo(() => {
    const result = new Map<string, "review" | "block">();
    for (const event of decisions) {
      const key = groupId(event.accountId, event.merchantId);
      if (
        event.decision === "block" ||
        (event.decision === "review" && result.get(key) !== "block")
      )
        result.set(key, event.decision);
    }
    return result;
  }, [decisions]);
  const edges: Link[] = [];
  const link = (
    id: string,
    source: string,
    target: string,
    context: boolean,
    count: number,
    targetSelection: NonNullable<Selection>,
  ) => {
    const a = nodeMap.get(source),
      b = nodeMap.get(target);
    if (!a || !b) return;
    const related = [payment, ...evidencePayments].some(
      (p) =>
        p &&
        source === p.accountId &&
        [p.merchantId, p.deviceId, p.locationId].includes(target),
    );
    const association = context
      ? document.scenario.associations.find((a) => a.id === id)
      : undefined;
    const temporal =
      association && contextTime
        ? contextTime < association.observedAt
          ? "future"
          : association.knownFrom && contextTime >= association.knownFrom
            ? "familiar"
            : "observed"
        : undefined;
    edges.push({
      id,
      source,
      target,
      type: "link",
      data: {
        start: positions[source]!,
        end: positions[target]!,
        radiusStart: radius(a),
        radiusEnd: radius(b),
        count,
        context,
        highlighted: related,
        ...(!context && risks.has(id) ? { risk: risks.get(id)! } : {}),
        ...(comparison?.[id] ? { comparison: comparison[id] } : {}),
        ...(temporal ? { temporal } : {}),
        ...(!context && activePaths.has(id)
          ? { pulse: activePaths.get(id)! }
          : {}),
      },
      selected:
        selection?.kind === targetSelection.kind &&
        selection.id === targetSelection.id,
      style: {
        animationDelay: `${Math.max(growth.get(source) || 0, growth.get(target) || 0)}ms`,
        opacity:
          flaggedOnly &&
          !(context
            ? flaggedObjects.has(source) && flaggedObjects.has(target)
            : risks.has(id))
            ? 0.12
            : comparison && !comparison[id]
              ? 0.2
              : !readOnly && payment && !related
                ? 0.2
                : 1,
      },
      ariaLabel: `${a.name} to ${b.name}, ${context ? `${temporal || ""} relationship` : `${count} ${readOnly ? "revealed " : ""}payments`}`,
    });
  };
  for (const a of document.scenario.associations)
    link(a.id, a.accountId, a.targetId, true, 0, {
      kind: "association",
      id: a.id,
    });
  for (const [key, group] of grouped)
    link(key, group.accountId, group.merchantId, false, group.count, {
      kind: "group",
      id: key,
    });

  useEffect(() => {
    if (!container.current) return;
    let inspectionOrigin: Record<string, Position> = {};
    const motion = createElasticNodes({
      graph: container.current,
      worldPoint: (event) =>
        flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }),
      getPosition: (id) => {
        if (readOnly)
          return (
            inspectionPositionsRef.current[id] || document.view.positions[id]!
          );
        const s = useWorkspace.getState();
        return (s.dragging?.positions || s.document!.view.positions)[id]!;
      },
      setPosition: (id, position) => {
        const s = useWorkspace.getState();
        const current = readOnly ? document : s.document!;
        const start = readOnly
          ? { ...document.view.positions, ...inspectionPositionsRef.current }
          : s.dragging?.positions || current.view.positions;
        const result = pushObjects(
          current.scenario.nodes.filter(
            (n) => !visibleIdsRef.current || visibleIdsRef.current.has(n.id),
          ),
          start,
          id,
          position,
        );
        motion.contact(result.contacts);
        if (readOnly) moveForInspection(result.positions);
        else
          useWorkspace.setState({
            dragging: { id, positions: result.positions },
          });
      },
      updateGeometry: () => {},
      beginDrag: (id) => {
        if (readOnly) {
          inspectionOrigin = { ...inspectionPositionsRef.current };
          return true;
        }
        if (useWorkspace.getState().dirty) {
          useWorkspace
            .getState()
            .notify("Apply or cancel your unapplied edits before dragging.");
          return false;
        }
        useWorkspace.setState({
          dragging: {
            id,
            positions: { ...useWorkspace.getState().document!.view.positions },
          },
        });
        return true;
      },
      endDrag: (_id, cancelled, moved) => {
        if (readOnly) {
          if (cancelled) moveForInspection(inspectionOrigin);
          return;
        }
        const s = useWorkspace.getState();
        if (!cancelled && moved && s.document && s.dragging) {
          const next = clone(s.document);
          next.view.positions = s.dragging.positions;
          guarded(() => s.commit(next, "Object moved. Undo is available."));
        }
        useWorkspace.setState({ dragging: null });
      },
    });
    motionRef.current = motion;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") motion.cancelDrag();
    };
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("keydown", escape);
      motionRef.current = null;
      motion.destroy();
    };
  }, [flow, document.scenario.id, readOnly]);

  useLayoutEffect(() => {
    if (!arrival) return;
    let frame = 0;
    let attempts = 0;
    const adopt = () => {
      if (
        container.current?.querySelector(`[data-node="${arrival.id}"]`) &&
        motionRef.current
      ) {
        if (arrival.pose) motionRef.current.adoptPose(arrival.id, arrival.pose);
        if (arrival.contacts) motionRef.current.contact(arrival.contacts);
      } else if (++attempts < 10) frame = requestAnimationFrame(adopt);
    };
    adopt();
    return () => cancelAnimationFrame(frame);
  }, [arrival]);
  return (
    <div
      ref={container}
      className={`${styles.canvas} ${placing ? "placing-object" : ""}`}
      onContextMenu={(event) => {
        if (
          !readOnly &&
          (suppressConnectionMenu.current ||
            (event.target as Element).closest(".react-flow__node"))
        )
          event.preventDefault();
      }}
      onPointerDownCapture={(event) => {
        suppressConnectionMenu.current = false;
        if (readOnly || !connectObjects || event.button !== 2) return;
        const source = (event.target as Element)
          .closest(".react-flow__node")
          ?.getAttribute("data-id");
        if (!source) return;
        suppressConnectionMenu.current = true;
        event.preventDefault();
        event.stopPropagation();
        if (workspace.dirty || workspace.dragging) {
          workspace.notify(
            "Apply or cancel your unapplied edits before connecting.",
          );
          return;
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        const point = { x: event.clientX, y: event.clientY };
        setConnectionDrag({ source, start: point, end: point });
      }}
      onPointerMove={(event) => {
        if (!connectionDrag) return;
        event.preventDefault();
        setConnectionDrag({
          ...connectionDrag,
          end: { x: event.clientX, y: event.clientY },
        });
      }}
      onPointerUp={(event) => {
        if (!connectionDrag) return;
        event.preventDefault();
        event.stopPropagation();
        const target = window.document
          .elementFromPoint(event.clientX, event.clientY)
          ?.closest(".react-flow__node")
          ?.getAttribute("data-id");
        const moved =
          Math.hypot(
            event.clientX - connectionDrag.start.x,
            event.clientY - connectionDrag.start.y,
          ) > 6;
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
        setConnectionDrag(null);
        if (moved && target && target !== connectionDrag.source)
          connectObjects?.(connectionDrag.source, target);
      }}
      onPointerCancel={() => setConnectionDrag(null)}
      onLostPointerCapture={() => setConnectionDrag(null)}
      onKeyDown={(e) => {
        if (!(e.target instanceof Element)) return;
        const focusedNode = e.target
          .closest(".react-flow__node")
          ?.getAttribute("data-id");
        const focusedEdge = e.target
          .closest(".react-flow__edge")
          ?.getAttribute("data-id");
        if (
          (e.key === "Enter" || e.key === " ") &&
          (focusedNode || focusedEdge)
        ) {
          e.preventDefault();
          if (readOnly) {
            inspect?.(
              focusedNode
                ? { kind: "node", id: focusedNode }
                : {
                    kind: grouped.has(focusedEdge!) ? "group" : "association",
                    id: focusedEdge!,
                  },
            );
            return;
          }
          if (focusedNode && connecting) chooseTarget?.(focusedNode);
          else if (focusedNode)
            workspace.select({ kind: "node", id: focusedNode });
          else if (focusedEdge)
            workspace.select({
              kind: grouped.has(focusedEdge) ? "group" : "association",
              id: focusedEdge,
            });
          return;
        }
        if (!focusedNode) return;
        const delta = {
          ArrowLeft: [-10, 0],
          ArrowRight: [10, 0],
          ArrowUp: [0, -10],
          ArrowDown: [0, 10],
        }[e.key];
        if (delta) {
          e.preventDefault();
          e.stopPropagation();
          if (readOnly) {
            const p = positions[focusedNode]!;
            const result = pushObjects(visibleNodes, positions, focusedNode, {
              x: p.x + delta[0]!,
              y: p.y + delta[1]!,
            });
            motionRef.current?.contact(result.contacts);
            moveForInspection(result.positions);
            return;
          }
          guarded(() => {
            const next = clone(document);
            const p = next.view.positions[focusedNode]!;
            const result = pushObjects(
              visibleNodes,
              next.view.positions,
              focusedNode,
              { x: p.x + delta[0]!, y: p.y + delta[1]! },
            );
            next.view.positions = result.positions;
            motionRef.current?.contact(result.contacts);
            workspace.commit(next, "Object moved.");
          });
        }
      }}
    >
      {connectionDrag && (
        <svg className="connection-preview" aria-hidden="true">
          <line
            x1={flow.flowToScreenPosition(positions[connectionDrag.source]!).x}
            y1={flow.flowToScreenPosition(positions[connectionDrag.source]!).y}
            x2={connectionDrag.end.x}
            y2={connectionDrag.end.y}
          />
          <circle cx={connectionDrag.end.x} cy={connectionDrag.end.y} r="5" />
        </svg>
      )}
      <svg
        width="0"
        height="0"
        aria-hidden="true"
        style={{ position: "absolute" }}
      >
        <defs>
          {(["", "review", "block"] as const).map((risk) => (
            <marker
              key={risk}
              id={`payment-arrow${risk ? `-${risk}` : ""}`}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path
                d="M2 2L8 5L2 8"
                fill="none"
                stroke={
                  risk ? `var(--transaction-${risk})` : "var(--edge-hover)"
                }
                strokeWidth="1.2"
              />
            </marker>
          ))}
        </defs>
      </svg>
      <ReactFlow<ObjectNode, Link>
        {...(hierarchyViewport || remembered?.viewport
          ? { defaultViewport: hierarchyViewport || remembered!.viewport }
          : {})}
        nodes={nodes}
        onNodesChange={onNodesChange}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodeOrigin={[0.5, 0.5]}
        nodesDraggable={false}
        autoPanOnNodeFocus={false}
        deleteKeyCode={null}
        multiSelectionKeyCode={null}
        selectionKeyCode={null}
        nodesConnectable={false}
        minZoom={scope ? 0.0001 : 0.25}
        maxZoom={2}
        onNodeClick={(_, n) =>
          readOnly
            ? inspect?.({ kind: "node", id: n.id })
            : connecting
              ? chooseTarget?.(n.id)
              : workspace.select({ kind: "node", id: n.id })
        }
        onEdgeClick={(_, edge) =>
          (readOnly ? inspect : workspace.select)?.({
            kind: grouped.has(edge.id) ? "group" : "association",
            id: edge.id,
          })
        }
        onPaneClick={(event) => {
          if (readOnly) inspect?.(null);
          else if (placing)
            add(
              placing,
              flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }),
            );
          else workspace.select(null);
        }}
        onInit={() => {
          if (!initialViewport.current) {
            initialViewport.current = true;
            if (scope) {
              return;
            }
            if (remembered) {
              void flow.setViewport(remembered.viewport);
              return;
            }
            if (readOnly || restoreViewport) {
              void flow.setViewport(document.view.viewport);
              return;
            }
            const width = container.current!.clientWidth,
              height = container.current!.clientHeight;
            const zoom =
              width < 600 ? width / 480 : Math.min(width / 1200, height / 800);
            void flow.setViewport({
              x: (width - 1200 * zoom) / 2,
              y: (height - 800 * zoom) / 2,
              zoom: Math.max(0.25, zoom),
            });
          }
        }}
        onMove={(_, viewport) => {
          if (!scope && memoryKey)
            rememberGraphView(memoryKey, {
              viewport,
              path: [],
              layouts: new Map(),
            });
        }}
        onMoveEnd={(_, viewport) => {
          if (readOnly) return;
          const s = useWorkspace.getState();
          if (s.document)
            useWorkspace.setState({
              document: {
                ...s.document,
                view: { ...s.document.view, viewport },
              },
            });
        }}
      />
    </div>
  );
}

export type GraphProps = Parameters<typeof DetailGraph>[0];
