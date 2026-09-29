import { formatSessionDuration } from "./formatSessionDuration";

export function ActiveWorkoutCapsule({
  name,
  startedAt,
  now,
  visible = true,
  onResume,
}: {
  name: string;
  startedAt: number;
  now: number;
  visible?: boolean;
  onResume: () => void;
}) {
  const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));

  return (
    <button
      className="active-workout-capsule"
      type="button"
      aria-label={`Reprendre la séance ${name}`}
      aria-hidden={!visible || undefined}
      inert={!visible || undefined}
      data-visible={visible ? "true" : "false"}
      onClick={onResume}
    >
      <span className="active-workout-capsule-dot" aria-hidden="true" />
      <span className="active-workout-capsule-copy">
        <span className="active-workout-capsule-name">{name}</span>
        <span
          className="active-workout-capsule-duration"
          role="timer"
          aria-label="Durée de la séance en cours"
          data-started-at={startedAt}
        >
          {formatSessionDuration(elapsedSeconds)}
        </span>
      </span>
    </button>
  );
}
