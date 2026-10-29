import { readGraphView, rememberGraphView } from "../view-memory";
import { TransactionOverlay } from "./TransactionOverlay";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useReactFlow, useStoreApi, type Viewport } from "@xyflow/react";
import { createPortal } from "react-dom";
import type { Entity, Position } from "../../../domain/types";
import { useWorkspace } from "../../../state/workspace";
import {
  buildHierarchy,
  groupLabel,
  pathToPayment,
  type TransactionGroup,
} from "../../../domain/hierarchy";
import { DetailGraph, type GraphProps } from "../DetailGraph";
import { AtlasCanvas } from "./AtlasCanvas";
import { buildAtlasMap } from "./layout";
import { useSemanticZoom } from "./useSemanticZoom";
import { sectorOffset, sectorLayoutKey, type Sector } from "./model";
import { sectorObjectScope } from "./object-scope";
function sectorCamera(sector: Sector, playback: boolean): Viewport {
  const width = window.innerWidth,
    height = window.innerHeight;
  const circles = sector.children.length
    ? sector.territory.map((p) => ({ ...p, radius: 0 }))
    : Object.values(sector.positions).map((p) => ({ ...p, radius: 85 }));
  const left = Math.min(...circles.map((p) => p.x - p.radius)),
    right = Math.max(...circles.map((p) => p.x + p.radius));
  const top = Math.min(...circles.map((p) => p.y - p.radius)),
    bottom = Math.max(...circles.map((p) => p.y + p.radius * 1.18));
  const zoom = Math.max(
    0.0001,
    Math.min(
      1.1,
      Math.max(240, width - 180) / ((right - left) * 1.08),
      Math.max(240, height - (playback ? 410 : 300)) / ((bottom - top) * 1.08),
    ),
  );
  return {
    x: width / 2 - ((left + right) / 2) * zoom,
    y: height / 2 + (playback ? -35 : 20) - ((top + bottom) / 2) * zoom,
    zoom,
  };
}

export function AtlasGraph(props: GraphProps) {
  const workspace = useWorkspace();
  const document = props.snapshot || workspace.document!;
  const memoryKey = props.memoryKey!;
  const [remembered] = useState(() => readGraphView(memoryKey));
  const store = useStoreApi();
  const root = useMemo(
    () => buildHierarchy(document.scenario),
    [document.scenario],
  );
  const [layoutCache, setLayoutCache] = useState<{
    root: TransactionGroup;
    entities: Entity[];
    layouts: Map<string, Record<string, Position>>;
    sectors: Map<string, Sector>;
  } | null>(null);
  const layouts = useMemo(
    () =>
      layoutCache?.layouts ??
      remembered?.layouts ??
      new Map<string, Record<string, Position>>(),
    [layoutCache, remembered],
  );
  const sectors = useMemo(
    () =>
      layoutCache?.root === root &&
      layoutCache.entities === document.scenario.nodes
        ? layoutCache.sectors
        : buildAtlasMap(root, document.scenario.nodes, layouts),
    [root, document.scenario.nodes, layouts, layoutCache],
  );
  const [path, setPath] = useState<string[]>(() =>
    remembered?.path.every((id) => sectors.has(id)) ? remembered.path : [],
  );
  const [camera, setCamera] = useState(() =>
    remembered && remembered.path.every((id) => sectors.has(id))
      ? remembered.viewport
      : sectorCamera(sectors.get(root.id)!, !!props.snapshot),
  );
  const [returnCamera, setReturnCamera] = useState<Viewport | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const busy = useRef(false);
  const alive = useRef(true);
  const flow = useReactFlow();
  const chain = [root];
  for (const id of path) {
    const child = chain.at(-1)!.children.find((g) => g.id === id);
    if (!child) break;
    chain.push(child);
  }
  const current = chain.at(-1)!;
  const currentGroup = useRef(current);
  currentGroup.current = current;
  const scope = useMemo(
    () =>
      sectorObjectScope(
        root,
        current,
        document.scenario.nodes,
        workspace.objectOrigins,
      ),
    [root, current, document.scenario.nodes, workspace.objectOrigins],
  );
  const duration = () =>
    matchMedia("(prefers-reduced-motion: reduce)").matches ||
    window.document.documentElement.dataset.motion === "off"
      ? 0
      : 700;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const remember = useCallback(() => {
    if (busy.current) return;
    let savedLayouts = layouts;
    if (!props.snapshot && !current.children.length) {
      const positions = useWorkspace.getState().document?.view.positions;
      if (positions)
        savedLayouts = new Map(layouts).set(
          sectorLayoutKey(current),
          Object.fromEntries(
            [...current.entityIds]
              .filter((id) => positions[id])
              .map((id) => [id, positions[id]!]),
          ),
        );
    }
    rememberGraphView(memoryKey, {
      viewport: flow.getViewport(),
      path,
      layouts: savedLayouts,
    });
  }, [memoryKey, flow, path, layouts, current, props.snapshot]);
  useLayoutEffect(() => {
    const unsubscribe = store.subscribe((next, previous) => {
      if (next.transform !== previous.transform) remember();
    });
    return () => {
      unsubscribe();
    };
  }, [store, remember]);
  useLayoutEffect(() => {
    let frame = 0;
    let timer: ReturnType<typeof setTimeout>;
    void flow.setViewport(camera);
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        void flow.setViewport(camera);
        const milliseconds = returnCamera ? duration() : 0;
        if (returnCamera)
          void flow.setViewport(returnCamera, { duration: milliseconds });
        timer = setTimeout(() => {
          busy.current = false;
          remember();
          setTransitioning(false);
        }, milliseconds + 50);
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [camera, returnCamera, flow, remember]);

  const navigate = useCallback(
    async (ids: string[], preserveViewport = false) => {
      if (busy.current) return false;
      if (!props.snapshot && useWorkspace.getState().dirty) {
        useWorkspace
          .getState()
          .notify(
            "Apply or cancel your unapplied edits before changing groups.",
          );
        return false;
      }
      let target = root;
      for (const id of ids)
        target = target.children.find((g) => g.id === id) || target;
      const previous = currentGroup.current;
      if (target.id === previous.id) return true;
      let navigationSectors = sectors;
      if (!props.snapshot && !previous.children.length) {
        const stored = useWorkspace.getState().document!;
        const positions = Object.fromEntries(
          [...previous.entityIds].map((id) => [id, stored.view.positions[id]!]),
        );
        const existing = sectors.get(previous.id)!.positions;
        if (
          Object.entries(positions).some(
            ([id, p]) => p.x !== existing[id]?.x || p.y !== existing[id]?.y,
          )
        ) {
          const saved = new Map(layouts).set(
            sectorLayoutKey(previous),
            positions,
          );
          navigationSectors = buildAtlasMap(root, stored.scenario.nodes, saved);
          setLayoutCache({
            root,
            entities: stored.scenario.nodes,
            layouts: saved,
            sectors: navigationSectors,
          });
        }
      }
      const rootSector = navigationSectors.get(root.id)!;
      const from = sectorOffset(rootSector, previous.id)!,
        to = sectorOffset(rootSector, target.id)!;
      const offset = {
        x: (to.x - from.x) / from.scale,
        y: (to.y - from.y) / from.scale,
      };
      const relativeScale = to.scale / from.scale;
      const inward = target.id.startsWith(previous.id + "/");
      const before = flow.getViewport();
      const destination = preserveViewport
        ? {
            x: before.x + offset.x * before.zoom,
            y: before.y + offset.y * before.zoom,
            zoom: before.zoom * relativeScale,
          }
        : sectorCamera(navigationSectors.get(target.id)!, !!props.snapshot);
      busy.current = true;
      setTransitioning(true);
      if (inward && !preserveViewport) {
        void flow.setViewport(
          {
            ...destination,
            x: destination.x - (offset.x * destination.zoom) / relativeScale,
            y: destination.y - (offset.y * destination.zoom) / relativeScale,
            zoom: destination.zoom / relativeScale,
          },
          { duration: duration() },
        );
        await new Promise((resolve) => setTimeout(resolve, duration() + 20));
        if (!alive.current) return false;
      }
      if (!props.snapshot) {
        const s = useWorkspace.getState();
        if (s.document && !target.children.length) {
          useWorkspace.setState({
            document: {
              ...s.document,
              view: {
                ...s.document.view,
                positions: {
                  ...s.document.view.positions,
                  ...navigationSectors.get(target.id)!.positions,
                },
              },
            },
          });
        }
        s.select(null);
      }
      setReturnCamera(inward || preserveViewport ? null : destination);
      setCamera(
        inward || preserveViewport
          ? destination
          : {
              ...before,
              x: before.x + offset.x * before.zoom,
              y: before.y + offset.y * before.zoom,
              zoom: before.zoom * relativeScale,
            },
      );
      setPath(ids);
      return true;
    },
    [root, sectors, layouts, props.snapshot, flow],
  );
  useSemanticZoom({
    sector: sectors.get(current.id)!,
    parent: chain.length > 1 ? chain.at(-2)!.id : null,
    busy: transitioning || (!props.snapshot && workspace.dirty),
    fittedZoom: (sector) => sectorCamera(sector, !!props.snapshot).zoom,
    navigate: (id) => {
      if (current.id.startsWith(id + "/")) {
        while (
          id !== root.id &&
          flow.getViewport().zoom <
            sectorCamera(sectors.get(id)!, !!props.snapshot).zoom * 0.92
        )
          id = id.slice(0, id.lastIndexOf("/"));
      }
      const ids =
        id === "all"
          ? []
          : id
              .split("/")
              .slice(1)
              .map((_, i) =>
                id
                  .split("/")
                  .slice(0, i + 2)
                  .join("/"),
              );
      void navigate(ids, true);
    },
  });
  const enter = useCallback(
    (id: string) => {
      void navigate([...path, id]);
    },
    [navigate, path],
  );
  const requestedPayment = props.snapshot
    ? props.focusPaymentId
    : workspace.selection?.kind === "payment"
      ? workspace.selection.id
      : undefined;
  const previousFocus = useRef<string | undefined>(
    remembered ? requestedPayment : undefined,
  );
  useEffect(() => {
    if (
      requestedPayment &&
      previousFocus.current !== requestedPayment &&
      !transitioning
    ) {
      previousFocus.current = requestedPayment;
      void navigate(pathToPayment(root, requestedPayment)).then((entered) => {
        if (entered && alive.current && !props.snapshot)
          useWorkspace
            .getState()
            .select({ kind: "payment", id: requestedPayment });
      });
    } else if (!requestedPayment) previousFocus.current = undefined;
  }, [requestedPayment, root, navigate, props.snapshot, transitioning]);
  useEffect(() => {
    if (props.snapshot) return;
    useWorkspace.setState({
      visibleGraphIds: current.children.length ? [] : [...scope],
      activeSectorPayments: current.children.length
        ? null
        : current.payments.map((payment) => payment.id),
    });
    return () => {
      useWorkspace.setState({
        visibleGraphIds: null,
        activeSectorPayments: null,
      });
    };
  }, [current, scope, props.snapshot]);
  useLayoutEffect(() => {
    if (props.snapshot || current.children.length) return;
    const state = useWorkspace.getState();
    if (!state.document) return;
    const positions = sectors.get(current.id)!.positions;
    useWorkspace.setState({
      document: {
        ...state.document,
        view: {
          ...state.document.view,
          positions: { ...state.document.view.positions, ...positions },
        },
      },
    });
  }, [current.id, sectors, props.snapshot]);
  const paymentScope = useMemo(
    () => new Set(current.payments.map((p) => p.id)),
    [current],
  );
  const snapshot = useMemo(
    () =>
      props.snapshot
        ? {
            ...props.snapshot,
            view: {
              ...props.snapshot.view,
              positions: {
                ...props.snapshot.view.positions,
                ...sectors.get(current.id)!.positions,
              },
            },
          }
        : undefined,
    [props.snapshot, sectors, current.id],
  );
  const navigation = (
    <nav
      className="hierarchy-navigation"
      aria-label="Transaction groups"
      data-editing={!props.snapshot}
    >
      {chain.map(
        (g, i) =>
          (i === 0 || i >= chain.length - 2) && (
            <button
              key={g.id}
              onClick={() => {
                void navigate(path.slice(0, i));
              }}
              disabled={transitioning || i === chain.length - 1}
              title={`${groupLabel(g)}\n${g.reason}`}
              aria-label={groupLabel(g)}
            >
              {i ? "\u203a " : ""}
              {groupLabel(g).length > 48
                ? groupLabel(g).slice(0, 46) + "..."
                : groupLabel(g)}
            </button>
          ),
      )}
      <span>
        {current.payments.length.toLocaleString()} payments
        {!current.children.length ? " - interactive detail" : ""}
      </span>
      {!!current.children.length && (
        <span className="hierarchy-key">
          Click or zoom to explore · Drag to pan
        </span>
      )}
    </nav>
  );
  return (
    <>
      <div
        className="hierarchy-stage"
        data-detail={!current.children.length}
        data-transitioning={transitioning}
        aria-busy={transitioning}
      >
        {current.children.length ? (
          <>
            <AtlasCanvas
              root={sectors.get(root.id)!}
              sector={sectors.get(current.id)!}
              entities={document.scenario.nodes}
              enter={enter}
              viewport={camera}
              disabled={transitioning}
              flaggedIds={props.flaggedIds}
              revealedIds={props.revealedIds}
              flaggedOnly={props.flaggedOnly}
              inspectReviewGroup={props.inspectReviewGroup}
              inspectPayment={
                props.snapshot
                  ? props.inspect
                    ? (id) => props.inspect?.({ kind: "payment", id })
                    : undefined
                  : (id) => workspace.select({ kind: "payment", id })
              }
            />
            <TransactionOverlay
              root={sectors.get(root.id)!}
              sector={sectors.get(current.id)!}
              entities={document.scenario.nodes}
              pulses={props.pulses}
              decisions={props.decisions}
            />
          </>
        ) : (
          <DetailGraph
            key={current.id}
            {...props}
            {...(snapshot ? { snapshot } : {})}
            scope={scope}
            paymentScope={paymentScope}
            hierarchyViewport={camera}
          />
        )}
      </div>
      {props.navigationTarget
        ? createPortal(navigation, props.navigationTarget)
        : navigation}
    </>
  );
}
