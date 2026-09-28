import { ActiveRestTimer } from "./ActiveRestTimer";
import type { WorkoutExecution, Workout } from "./storage/database";

export function WorkoutProgress({
  execution,
  workout,
  clock,
  onFinishRest,
  selectedExerciseId,
}: {
  execution: WorkoutExecution;
  workout: Workout;
  clock: number;
  onFinishRest?: () => void;
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
    <section
      className={`workout-progress${resting && onFinishRest ? " has-rest" : ""}`}
      aria-label="Progression de la séance"
    >
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
      {resting && onFinishRest && (
        <ActiveRestTimer
          remaining={Math.max(
            0,
            Math.ceil(((resting.restEndsAt ?? clock) - clock) / 1000),
          )}
          total={resting.restDurationSeconds ?? resting.restSeconds}
          onFinish={onFinishRest}
        />
      )}
    </section>
  );
}
