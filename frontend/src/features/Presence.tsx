import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

export function panelDuration() {
  if (
    matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.dataset.motion === "off"
  )
    return 0;
  return (
    parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--panel-duration",
      ),
    ) || 420
  );
}

// Retain the last content briefly so closing panels can finish their exit.
// Inert content cannot receive clicks or focus while it leaves.
export function Presence({ children }: { children: ReactNode }) {
  const [retained, setRetained] = useState(children);
  const host = useRef<HTMLDivElement>(null);
  const visible = !!children;
  useLayoutEffect(() => {
    if (children) {
      setRetained(children);
      return;
    }
    const timer = setTimeout(() => setRetained(null), panelDuration());
    return () => clearTimeout(timer);
  }, [children]);
  useLayoutEffect(() => {
    if (visible) return;
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && host.current?.contains(focused))
      focused.blur();
  }, [visible]);
  return (
    <div
      ref={host}
      className="presence"
      data-visible={visible}
      inert={!visible}
      aria-hidden={!visible || undefined}
    >
      {children || retained}
    </div>
  );
}
