import { useEffect, useLayoutEffect } from "react";
import { useSimulation } from "../../state/simulation";
import { GROWTH_DURATION } from "./growth";
import { useWorkspace } from "../../state/workspace";
import { LEAF_PAYMENTS } from "../../domain/limits";
import { DetailGraph, type GraphProps } from "./DetailGraph";
import { AtlasGraph } from "./atlas/AtlasGraph";

export function Graph(props: GraphProps) {
  const workspace = useWorkspace();
  const desaturated = useSimulation(
    (s) => s.pending || (s.viewing && s.playing),
  );
  useLayoutEffect(() => {
    window.document.documentElement.dataset.simulating = String(desaturated);
  }, [desaturated]);
  useEffect(() => {
    if (props.snapshot || !workspace.revealGraph) return;
    const reduced =
      matchMedia("(prefers-reduced-motion: reduce)").matches ||
      window.document.documentElement.dataset.motion === "off";
    const timer = setTimeout(
      () => useWorkspace.setState({ revealGraph: false }),
      reduced ? 0 : GROWTH_DURATION,
    );
    return () => clearTimeout(timer);
  }, [props.snapshot, workspace.revealGraph, workspace.sessionId]);
  const document = props.snapshot || workspace.document!;
  const large = document.scenario.payments.length > LEAF_PAYMENTS;
  const memoryKey = `${workspace.sessionId}:${document.scenario.id}:${large ? "atlas" : "detail"}`;
  const graph = large ? (
    <AtlasGraph {...props} memoryKey={memoryKey} key={document.scenario.id} />
  ) : (
    <DetailGraph {...props} memoryKey={memoryKey} />
  );
  return (
    <div
      key={props.snapshot ? document.scenario.id : workspace.sessionId}
      className={`graph-stage ${!props.snapshot && workspace.revealGraph ? "graph-reveal" : ""}`}
      data-simulating={desaturated}
    >
      {graph}
    </div>
  );
}
