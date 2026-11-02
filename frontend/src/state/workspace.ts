import { create } from "zustand";
import type { Document, Payment, Position, Selection } from "../domain/types";
import { assertIntegrity, clone } from "../domain/commands";

interface Workspace {
  revealGraph: boolean;
  visibleGraphIds: string[] | null;
  activeSectorPayments: string[] | null;
  objectOrigins: Record<string, readonly string[]>;
  sessionId: string;
  historyRevision: number;
  document: Document | null;
  baseline: string;
  past: Document[];
  future: Document[];
  selection: Selection;
  dirty: boolean;
  previewContext: Pick<
    Payment,
    "accountId" | "merchantId" | "deviceId" | "locationId"
  > | null;
  dragging: { id: string; positions: Record<string, Position> } | null;
  message: string;
  replace: (document: Document) => void;
  commit: (document: Document, message: string) => void;
  undo: () => void;
  redo: () => void;
  select: (selection: Selection) => void;
  notify: (message: string) => void;
}

function repair(document: Document, selection: Selection): Selection {
  if (!selection) return null;
  const s = document.scenario;
  const exists =
    selection.kind === "node"
      ? s.nodes.some((n) => n.id === selection.id)
      : selection.kind === "payment"
        ? s.payments.some((p) => p.id === selection.id)
        : selection.kind === "association"
          ? s.associations.some((a) => a.id === selection.id)
          : s.payments.some(
              (p) => `${p.accountId}:${p.merchantId}` === selection.id,
            );
  return exists ? selection : null;
}

export const useWorkspace = create<Workspace>((set, get) => ({
  revealGraph: false,
  visibleGraphIds: null,
  activeSectorPayments: null,
  objectOrigins: {},
  sessionId: crypto.randomUUID(),
  historyRevision: 0,
  document: null,
  baseline: "",
  past: [],
  future: [],
  selection: null,
  dirty: false,
  previewContext: null,
  dragging: null,
  message: "",
  replace: (document) => {
    assertIntegrity(document);
    const next = clone(document);
    set({
      revealGraph: false,
      visibleGraphIds: null,
      activeSectorPayments: null,
      objectOrigins: {},
      sessionId: crypto.randomUUID(),
      historyRevision: 0,
      document: next,
      baseline: JSON.stringify(next),
      message: "",
      past: [],
      future: [],
      selection: null,
      dirty: false,
      previewContext: null,
      dragging: null,
    });
  },
  commit: (document, message) => {
    assertIntegrity(document);
    const current = get();
    if (
      !current.document ||
      JSON.stringify(current.document) === JSON.stringify(document)
    ) {
      set({ dirty: false, previewContext: null, message });
      return;
    }
    const objectOrigins = { ...current.objectOrigins };
    if (current.activeSectorPayments?.length) {
      const existing = new Set(
        current.document.scenario.nodes.map((node) => node.id),
      );
      for (const node of document.scenario.nodes)
        if (!existing.has(node.id))
          objectOrigins[node.id] = [...current.activeSectorPayments];
    }
    set({
      // Keep origins through undo/deletion so redo restores the original home.
      // They are session-only view metadata, cleared when the document is replaced.
      objectOrigins,
      document: clone(document),
      past: [...current.past, clone(current.document)].slice(-20),
      future: [],
      selection: repair(document, current.selection),
      dirty: false,
      previewContext: null,
      message,
    });
  },
  undo: () => {
    const s = get();
    if (s.dirty || s.dragging) {
      set({ message: "Apply or cancel your edit before undo." });
      return;
    }
    const previous = s.past.at(-1);
    if (!previous || !s.document) return;
    const document = clone(previous);
    document.view.viewport = s.document.view.viewport;
    set({
      document,
      past: s.past.slice(0, -1),
      future: [...s.future, s.document],
      selection: repair(document, s.selection),
      message: "Change undone.",
      historyRevision: s.historyRevision + 1,
    });
  },
  redo: () => {
    const s = get();
    if (s.dirty || s.dragging) {
      set({ message: "Apply or cancel your edit before redo." });
      return;
    }
    const next = s.future.at(-1);
    if (!next || !s.document) return;
    const document = clone(next);
    document.view.viewport = s.document.view.viewport;
    set({
      document,
      past: [...s.past, s.document].slice(-20),
      future: s.future.slice(0, -1),
      selection: repair(document, s.selection),
      message: "Change restored.",
      historyRevision: s.historyRevision + 1,
    });
  },
  select: (selection) => {
    if (get().dirty) {
      set({ message: "Apply or cancel your unapplied edits first." });
      return;
    }
    set({ selection });
  },
  notify: (message) => set({ message }),
}));

export function guarded(action: () => void) {
  if (useWorkspace.getState().dirty) {
    useWorkspace
      .getState()
      .notify("Apply or cancel your unapplied edits first.");
    return;
  }
  try {
    action();
  } catch (error) {
    useWorkspace
      .getState()
      .notify(
        error instanceof Error
          ? error.message
          : "Unable to complete this edit.",
      );
  }
}
