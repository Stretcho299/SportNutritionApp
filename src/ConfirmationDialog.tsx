import { useEffect, useRef } from "react";

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
  const cancelButton = useRef<HTMLButtonElement>(null);
  useEffect(() => cancelButton.current?.focus(), []);
  return (
    <div
      className="modal confirmation-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
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
            onCancel();
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
            ref={cancelButton}
            className="confirmation-cancel"
            onClick={onCancel}
          >
            {request.cancelLabel ?? "Annuler"}
          </button>
          <button className="confirmation-submit" onClick={request.onConfirm}>
            {request.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
