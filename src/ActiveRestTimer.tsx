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
}: {
  remaining: number;
  total: number;
}) {
  return (
    <aside
      className="active-rest-timer"
      role="timer"
      aria-label="Temps de repos restant"
      data-reference-seconds={total}
    >
      <div className="compact-rest-ring">
        <RestRing remaining={remaining} total={total} />
        <strong>{formatTime(remaining)}</strong>
      </div>
    </aside>
  );
}
