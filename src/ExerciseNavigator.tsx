import { Icon } from "./Icon";
import type { Exercise, ExerciseExecutionStatus } from "./storage/database";

export function ExerciseNavigator({
  exercises,
  selectedExerciseId,
  statusFor,
  onSelect,
}: {
  exercises: Exercise[];
  selectedExerciseId: string;
  statusFor: (exerciseId: string) => ExerciseExecutionStatus | undefined;
  onSelect: (exerciseId: string) => void;
}) {
  const selectedIndex = Math.max(
    0,
    exercises.findIndex((exercise) => exercise.id === selectedExerciseId),
  );

  return (
    <section
      className="exercise-navigator"
      aria-label="Navigation des exercices"
    >
      <div className="exercise-navigator-copy" aria-live="polite">
        <span>Exercices</span>
        <strong>
          {selectedIndex + 1} / {exercises.length}
        </strong>
      </div>
      <ul className="exercise-tabs" aria-label="Exercices">
        {exercises.map((exercise, index) => {
          const status = statusFor(exercise.id) ?? "upcoming";
          const selected = exercise.id === selectedExerciseId;
          return (
            <li
              className={`${selected ? "selected " : ""}execution-${status}`}
              key={exercise.id}
            >
              <button
                className="exercise-tab"
                aria-pressed={selected}
                onClick={() => onSelect(exercise.id)}
              >
                <span className="exercise-tab-circle" aria-hidden="true">
                  {status === "completed" ? (
                    <Icon name="check" size={18} strokeWidth={2.4} />
                  ) : (
                    String(index + 1).padStart(2, "0")
                  )}
                </span>
                <span className="sr-only">
                  {exercise.name} ·{" "}
                  {status === "completed"
                    ? "Terminé"
                    : status === "active"
                      ? "En cours"
                      : "À venir"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
