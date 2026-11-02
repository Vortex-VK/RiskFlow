import { Activity, lazy, Suspense, useEffect, useState } from "react";
import { LandingPage } from "../features/landing/LandingPage";
import { useSimulation } from "../state/simulation";
import { useWorkspace } from "../state/workspace";
import type { Document } from "../domain/types";

const Workspace = lazy(() => import("./App"));
const isWorkspace = () => window.location.hash === "#/workspace";

export default function Site() {
  const [route, setRoute] = useState(() => ({
    workspace: isWorkspace(),
    visited: isWorkspace(),
  }));
  useEffect(() => {
    const navigate = () => {
      const workspace = isWorkspace();
      if (!workspace) useSimulation.setState({ playing: false });
      setRoute((previous) => ({
        workspace,
        visited: previous.visited || workspace,
      }));
    };
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, []);
  useEffect(() => {
    // The temporary session also needs unload protection while viewing home.
    const beforeUnload = (event: BeforeUnloadEvent) => {
      const state = useWorkspace.getState();
      if (!state.document) return;
      const baseline = JSON.parse(state.baseline) as Document;
      if (
        state.dirty ||
        JSON.stringify(state.document.scenario) !==
          JSON.stringify(baseline.scenario) ||
        JSON.stringify(state.document.view.positions) !==
          JSON.stringify(baseline.view.positions)
      )
        event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);
  useEffect(() => {
    document.title = route.workspace
      ? "RiskFlow — graph workspace"
      : "RiskFlow — Payment fraud investigation";
    if (!route.workspace)
      document.getElementById("landing-title")?.focus({ preventScroll: true });
  }, [route.workspace]);
  return (
    <>
      {!route.workspace && <LandingPage returning={route.visited} />}
      {route.visited && (
        <Activity mode={route.workspace ? "visible" : "hidden"}>
          <Suspense
            fallback={
              <main className="loading" role="status">
                Opening your workspace…
              </main>
            }
          >
            <Workspace />
          </Suspense>
        </Activity>
      )}
    </>
  );
}
