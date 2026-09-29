import { formatSessionDuration } from "./formatSessionDuration";
import type { WorkoutExecution } from "./storage/database";

export function ActiveWorkoutCapsule({
  name,
  execution,
  now,
  visible = true,
  onResume,
}: {
  name: string;
  execution: WorkoutExecution;
  now: number;
  visible?: boolean;
  onResume: () => void;
}) {
  const elapsedSeconds = Math.max(
    0,
    Math.floor((now - execution.startedAt) / 1000),
  );
  const sets = [
    ...execution.exercises,
    ...(execution.archivedExercises ?? []),
  ].flatMap((exercise) => exercise.sets);
  const settled = sets.filter(
    (set) => set.status === "performed" || set.status === "skipped",
  ).length;
  const remaining = sets.length - settled;

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
      <span className="active-workout-capsule-copy">
        <span className="active-workout-capsule-heading">
          <span className="active-workout-capsule-dot" aria-hidden="true" />
          <span className="active-workout-capsule-name">{name}</span>
        </span>
        <span className="active-workout-capsule-progress">
          {settled} terminée{settled === 1 ? "" : "s"} · {remaining} restante
          {remaining === 1 ? "" : "s"}
        </span>
      </span>
      <span
        className="active-workout-capsule-duration"
        role="timer"
        aria-label="Durée de la séance en cours"
        data-started-at={execution.startedAt}
      >
        {formatSessionDuration(elapsedSeconds)}
      </span>
    </button>
  );
}
