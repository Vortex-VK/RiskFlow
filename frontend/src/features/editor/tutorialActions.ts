// Next uses the same controls and validation as a user action. Only its
// synchronous events may cross the tutorial's interaction boundary.
let demonstrating = false;

export function isTutorialAction() {
  return demonstrating;
}

export function demonstrate(action: () => void) {
  demonstrating = true;
  try {
    action();
  } finally {
    demonstrating = false;
  }
}

export function clickTutorialTarget(selector: string) {
  const target = document.querySelector<HTMLElement | SVGElement>(selector);
  if (!target || target.closest('[inert], [aria-hidden="true"]')) return;
  demonstrate(() => {
    if (target instanceof HTMLElement) target.click();
    else target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

export function submitTutorialForm() {
  demonstrate(() => {
    document
      .querySelector<HTMLFormElement>("form[data-scenario-form]")
      ?.requestSubmit();
  });
}
