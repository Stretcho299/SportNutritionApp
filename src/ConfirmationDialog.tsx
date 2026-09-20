import { useEffect, useRef, useState } from "react";
import { useBodyScrollLock } from "./useBodyScrollLock";

export type ConfirmationRequest = {
  title: string;
  description: string;
  cancelLabel?: string;
  confirmLabel: string;
  onConfirm: () => void;
};

export function ConfirmationDialog({
  request,
  onCancel,
}: {
  request: ConfirmationRequest;
  onCancel: () => void;
}) {
  const [closing, setClosing] = useState(false);
  const closeTimeout = useRef<number | undefined>(undefined);
  useBodyScrollLock(true);

  useEffect(
    () => () => {
      if (closeTimeout.current !== undefined)
        window.clearTimeout(closeTimeout.current);
    },
    [],
  );

  const finish = (action: () => void) => {
    if (closing) return;
    setClosing(true);
    closeTimeout.current = window.setTimeout(action, 180);
  };

  return (
    <div
      className={`modal confirmation-backdrop${closing ? " is-closing" : ""}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) finish(onCancel);
      }}
    >
      <section
        className="confirmation-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmation-title"
        aria-describedby="confirmation-description"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            finish(onCancel);
          }
          if (event.key === "Tab") {
            const buttons = event.currentTarget.querySelectorAll("button");
            const first = buttons[0];
            const last = buttons[buttons.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <span className="confirmation-mark" aria-hidden="true">
          !
        </span>
        <h2 id="confirmation-title">{request.title}</h2>
        <p id="confirmation-description">{request.description}</p>
        <div className="confirmation-actions">
          <button
            autoFocus
            className="confirmation-cancel"
            onClick={() => finish(onCancel)}
          >
            {request.cancelLabel ?? "Annuler"}
          </button>
          <button
            className="confirmation-submit"
            onClick={() => finish(request.onConfirm)}
          >
            {request.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
