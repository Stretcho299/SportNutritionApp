import type { WorkoutExecution, Workout } from "./storage/database";

export function RestCountdown({
  remaining,
  total,
}: {
  remaining: number;
  total: number;
}) {
  const ratio = total > 0 ? Math.min(1, Math.max(0, remaining / total)) : 0;
  return (
    <div className="countdown" role="timer" aria-label="Temps de repos restant">
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <circle className="countdown-track" cx="40" cy="40" r="35" />
        <circle
          className="countdown-value"
          cx="40"
          cy="40"
          r="35"
          pathLength="100"
          strokeDasharray="100"
          strokeDashoffset={100 * (1 - ratio)}
        />
      </svg>
      <div>
        <strong>
          {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
        </strong>
        <span>Repos</span>
      </div>
    </div>
  );
}

export function WorkoutProgress({
  execution,
  workout,
  selectedExerciseId,
}: {
  execution: WorkoutExecution;
  workout: Workout;
  clock: number;
  selectedExerciseId: string;
}) {
  const sets = [
    ...execution.exercises,
    ...(execution.archivedExercises ?? []),
  ].flatMap((exercise) => exercise.sets);
  const settled = sets.filter(
    (set) => set.status === "performed" || set.status === "skipped",
  ).length;
  const restingExercise = execution.exercises.find((exercise) =>
    exercise.sets.some((set) => set.status === "resting"),
  );
  const resting = restingExercise?.sets.find((set) => set.status === "resting");
  const activeExercises = execution.exercises.filter((exercise) =>
    exercise.sets.some((set) => set.status === "active"),
  );
  const currentExercise =
    restingExercise ??
    activeExercises.find(
      (exercise) => exercise.exerciseId === selectedExerciseId,
    ) ??
    activeExercises[0];
  const currentSet =
    resting ?? currentExercise?.sets.find((set) => set.status === "active");
  const name = workout.exercises.find(
    (exercise) => exercise.id === currentExercise?.exerciseId,
  )?.name;
  const ratio = sets.length > 0 ? settled / sets.length : 0;
  return (
    <section className="workout-progress" aria-label="Progression de la séance">
      <div className="progress-copy">
        <div className="progress-label">
          <span>
            {execution.status === "completed" ? "Terminée" : "Progression"}
          </span>
          <strong>
            {settled} / {sets.length}
          </strong>
        </div>
        <progress
          className="sr-only"
          aria-label="Séries traitées"
          max={Math.max(1, sets.length)}
          value={settled}
        />
        <div className="progress-track" aria-hidden="true">
          <span style={{ width: `${ratio * 100}%` }}>
            <i />
          </span>
        </div>
        <small className="sr-only">
          {currentSet
            ? `${name} · Série ${(currentExercise?.sets.indexOf(currentSet) ?? 0) + 1}${resting ? "" : " active"}`
            : "Séries effectuées ou skippées"}
        </small>
      </div>
    </section>
  );
}
