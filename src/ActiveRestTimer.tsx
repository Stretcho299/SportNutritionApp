import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function RestRing({ remaining, total }: { remaining: number; total: number }) {
  const ratio = total > 0 ? Math.min(1, Math.max(0, remaining / total)) : 0;
  return (
    <svg className="rest-ring" viewBox="0 0 120 120" aria-hidden="true">
      <circle className="rest-ring-track" cx="60" cy="60" r="52" />
      <circle
        className="rest-ring-value countdown-value"
        cx="60"
        cy="60"
        r="52"
        pathLength="100"
        strokeDasharray="100"
        strokeDashoffset={100 * (1 - ratio)}
      />
    </svg>
  );
}

export function ActiveRestTimer({
  remaining,
  total,
  exerciseName,
  setNumber,
  onFinish,
}: {
  remaining: number;
  total: number;
  exerciseName: string;
  setNumber: number;
  onFinish: () => void;
}) {
  const [open, setOpen] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const elapsedRatio =
    total > 0 ? Math.min(1, Math.max(0, 1 - remaining / total)) : 1;

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
  }, [open]);

  return (
    <>
      <aside
        className="active-rest-timer"
        role="timer"
        aria-label="Temps de repos restant"
        data-reference-seconds={total}
      >
        <button
          type="button"
          className="active-rest-summary"
          aria-label="Ouvrir le chrono de repos"
          onClick={() => setOpen(true)}
        >
          <span className="mini-timer-icon" aria-hidden="true">
            <Icon name="circle" size={18} strokeWidth={2.2} />
          </span>
          <span className="mini-timer-copy">
            <span>Repos en cours</span>
            <strong>{formatTime(remaining)}</strong>
          </span>
          <span className="mini-timer-track" aria-hidden="true">
            <span style={{ width: `${elapsedRatio * 100}%` }} />
          </span>
        </button>
        <button type="button" className="mini-timer-finish" onClick={onFinish}>
          Fin de repos
        </button>
      </aside>
      {open && (
        <div
          className="rest-overlay-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            className="rest-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Détail du repos"
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false);
            }}
          >
            <header>
              <span>Repos</span>
              <button
                ref={closeButton}
                type="button"
                className="rest-overlay-close"
                aria-label="Fermer le chrono"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </header>
            <div className="rest-overlay-ring">
              <RestRing remaining={remaining} total={total} />
              <div>
                <strong>{formatTime(remaining)}</strong>
                <span>/ {formatTime(total)}</span>
              </div>
            </div>
            <p>
              {exerciseName} · Série {setNumber}
            </p>
            <button type="button" className="primary" onClick={onFinish}>
              Fin de repos
            </button>
          </section>
        </div>
      )}
    </>
  );
}
