import { useEffect, useRef } from "react";

export function ReplaceDialog({
  discard,
  cancel,
}: {
  discard: () => void;
  cancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="replace-dialog"
      aria-labelledby="replace-title"
      onCancel={(e) => {
        e.preventDefault();
        cancel();
      }}
    >
      <h2 id="replace-title">Replace this workspace?</h2>
      <p>
        Your current changes and run history will be discarded. Everything stays
        in this session; no draft is saved to this browser.
      </p>
      <div className="inline-actions">
        <button onClick={discard}>Discard</button>
        <button autoFocus onClick={cancel}>
          Cancel
        </button>
      </div>
    </dialog>
  );
}
