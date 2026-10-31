import { useLayoutEffect, useRef } from "react";
import { isTutorialAction } from "./tutorialActions";

// Only highlighted controls can start an action. A gesture that starts there
// can cross the shade (dragging an object or drawing a connection).
export function useTutorialInteractions(
  selectorKey: string,
  enabled = true,
  readOnlyKey = "",
) {
  const pointers = useRef(new Set<number>());
  useLayoutEffect(() => {
    if (!enabled) return;
    const selectors = selectorKey.split("|").filter(Boolean);
    const blockedSelectors = readOnlyKey.split("|").filter(Boolean);
    const blocked = new Map<
      Element,
      { disabled: string | null; title: string | null }
    >();
    const markBlocked = () => {
      for (const selector of blockedSelectors) {
        for (const element of document.querySelectorAll(selector)) {
          if (blocked.has(element)) continue;
          blocked.set(element, {
            disabled: element.getAttribute("aria-disabled"),
            title: element.getAttribute("title"),
          });
          element.setAttribute("aria-disabled", "true");
          element.setAttribute("data-tour-blocked", "true");
          element.removeAttribute("title");
        }
      }
    };
    const observer = new MutationObserver(markBlocked);
    if (blockedSelectors.length) {
      markBlocked();
      observer.observe(document.body, { childList: true, subtree: true });
    }
    const readOnly = (target: EventTarget | null) =>
      target instanceof Element &&
      readOnlyKey
        .split("|")
        .filter(Boolean)
        .some((selector) => !!target.closest(selector));
    const allowed = (target: EventTarget | null) => {
      if (isTutorialAction()) return true;
      if (!(target instanceof Element)) return false;
      if (readOnly(target)) return false;
      const control =
        target.closest(".tour-coach") ||
        selectors
          .flatMap((selector) => [...document.querySelectorAll(selector)])
          .find((element) => element?.contains(target));
      // Decorative SVGs inside active buttons are aria-hidden, but clickable.
      return !!control && !control.closest('[inert], [aria-hidden="true"]');
    };
    const stop = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const focusCoach = () =>
      document
        .querySelector<HTMLElement>(".tour-coach")
        ?.focus({ preventScroll: true });
    const pointerDown = (event: PointerEvent) => {
      if (!allowed(event.target)) return stop(event);
      pointers.current.add(event.pointerId);
    };
    const pointerMove = (event: PointerEvent) => {
      if (!pointers.current.has(event.pointerId) && !allowed(event.target))
        stop(event);
    };
    const pointerEnd = (event: PointerEvent) => {
      const startedHere = pointers.current.delete(event.pointerId);
      if (!startedHere && !allowed(event.target)) stop(event);
    };
    const interaction = (event: Event) => {
      // Read-only evidence can still be scrolled, including on touch screens.
      if (
        (event.type === "wheel" || event.type === "touchstart") &&
        readOnly(event.target)
      )
        return;
      if (!allowed(event.target)) stop(event);
    };
    const focus = (event: FocusEvent) => {
      if (!allowed(event.target)) {
        event.stopImmediatePropagation();
        focusCoach();
      }
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") return;
      if (event.key === "Tab") {
        const targets = [
          ...document.querySelectorAll<HTMLElement>(
            "button, input, select, textarea, a[href], summary, [tabindex]",
          ),
        ].filter(
          (element) =>
            allowed(element) &&
            element.tabIndex >= 0 &&
            !element.matches(":disabled") &&
            element.getClientRects().length > 0 &&
            getComputedStyle(element).visibility !== "hidden",
        );
        stop(event);
        const current = targets.indexOf(document.activeElement as HTMLElement);
        const index =
          current < 0
            ? event.shiftKey
              ? targets.length - 1
              : 0
            : (current + (event.shiftKey ? -1 : 1) + targets.length) %
              targets.length;
        if (targets[index]) targets[index].focus({ preventScroll: true });
        else focusCoach();
        return;
      }
      const typing =
        event.target instanceof Element &&
        event.target.closest('input, textarea, [contenteditable="true"]');
      // Workspace shortcuts must not operate on dimmed buttons indirectly.
      if (
        !allowed(event.target) ||
        (!typing &&
          (event.ctrlKey || event.metaKey) &&
          /^(z|y|a)$/i.test(event.key))
      )
        stop(event);
    };
    const options = { capture: true, passive: false };
    window.addEventListener("pointerdown", pointerDown, options);
    window.addEventListener("pointermove", pointerMove, options);
    window.addEventListener("pointerup", pointerEnd, options);
    window.addEventListener("pointercancel", pointerEnd, options);
    for (const type of [
      "click",
      "dblclick",
      "contextmenu",
      "wheel",
      "touchstart",
      "mousedown",
    ])
      window.addEventListener(type, interaction, options);
    window.addEventListener("keydown", keyboard, true);
    window.addEventListener("focusin", focus, true);
    if (!pointers.current.size && !allowed(document.activeElement))
      focusCoach();
    return () => {
      observer.disconnect();
      for (const [element, before] of blocked) {
        element.removeAttribute("data-tour-blocked");
        for (const [attribute, value] of [
          ["aria-disabled", before.disabled],
          ["title", before.title],
        ] as const) {
          if (value === null) element.removeAttribute(attribute);
          else element.setAttribute(attribute, value);
        }
      }
      window.removeEventListener("pointerdown", pointerDown, true);
      window.removeEventListener("pointermove", pointerMove, true);
      window.removeEventListener("pointerup", pointerEnd, true);
      window.removeEventListener("pointercancel", pointerEnd, true);
      for (const type of [
        "click",
        "dblclick",
        "contextmenu",
        "wheel",
        "touchstart",
        "mousedown",
      ])
        window.removeEventListener(type, interaction, true);
      window.removeEventListener("keydown", keyboard, true);
      window.removeEventListener("focusin", focus, true);
    };
  }, [selectorKey, enabled, readOnlyKey]);
}
