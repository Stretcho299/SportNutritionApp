import { equipmentLabels, muscleTargetLabels } from "./exercises/catalog";
import type { WorkoutSession } from "./storage/database";
import {
  formatSessionDate,
  formatSessionDurationLabel,
  formatSessionNumber,
  getPreviousCompletedSession,
  getSessionExerciseDetails,
  getSessionMetrics,
  getVolumeDelta,
} from "./sessionMetrics";

function formatSet(set: {
  status: string;
  weightKg: number | null;
  repetitions: number | null;
}) {
  if (set.status === "skipped") return "Ignorée";
  const repetitions = set.repetitions ?? 0;
  return set.weightKg === null
    ? `${repetitions} reps`
    : `${formatSessionNumber(set.weightKg)} kg × ${repetitions}`;
}

function exerciseMetadata(
  sessionExercise: ReturnType<typeof getSessionExerciseDetails>[number],
) {
  const definition = sessionExercise.snapshot?.definitionSnapshot;
  if (!definition) return "";
  const primary = definition.muscleTargets.find(
    (target) => target.role === "primary",
  );
  const muscle = primary ? muscleTargetLabels[primary.muscle] : "";
  const equipment = definition.equipment
    .map((item) => equipmentLabels[item])
    .join(", ");
  return [muscle, equipment || "Sans matériel"].filter(Boolean).join(" · ");
}

export function SessionSummary({
  session,
  sessions,
  motionClass = "",
  onReturn,
}: {
  session: WorkoutSession;
  sessions: WorkoutSession[];
  motionClass?: string;
  onReturn: () => void;
}) {
  const metrics = getSessionMetrics(session);
  const previous = getPreviousCompletedSession(session, sessions);
  const delta = getVolumeDelta(session, previous);
  const exercises = getSessionExerciseDetails(session);

  return (
    <section
      className={`session-summary${motionClass}`}
      aria-label={`Bilan de ${session.templateName}`}
    >
      <header className="session-summary-hero">
        <span className="session-summary-date">
          {formatSessionDate(session.completedAt ?? session.startedAt)}
        </span>
        <h2>{session.templateName}</h2>
        <strong>{formatSessionDurationLabel(metrics.durationMs)}</strong>
      </header>

      <section className="session-summary-metrics" aria-label="Résultats">
        <div>
          <strong>{metrics.performedSets}</strong>
          <span>Séries</span>
        </div>
        <div>
          <strong>{formatSessionNumber(metrics.repetitions)}</strong>
          <span>Reps</span>
        </div>
        <div>
          <strong>{formatSessionNumber(metrics.volumeKg)}</strong>
          <span>kg</span>
        </div>
      </section>

      <section className="session-summary-comparison">
        <h3>Volume vs séance précédente</h3>
        {delta ? (
          <p>
            <strong>
              {delta.deltaKg > 0 ? "+" : delta.deltaKg < 0 ? "−" : ""}
              {formatSessionNumber(Math.abs(delta.deltaKg))} kg
            </strong>
            {delta.percent !== undefined && (
              <span>
                {delta.percent > 0 ? "+" : delta.percent < 0 ? "−" : ""}
                {formatSessionNumber(Math.abs(delta.percent))} %
              </span>
            )}
          </p>
        ) : (
          <p className="session-summary-first">Première séance enregistrée</p>
        )}
      </section>

      <section className="session-summary-exercises" aria-label="Exercices">
        <h3>Exercices</h3>
        {exercises.map(({ execution, snapshot, sets }) => {
          const metadata = exerciseMetadata({ execution, snapshot, sets });
          const plannedSetIds = [...(snapshot?.plannedSets ?? [])]
            .sort((a, b) => a.position - b.position)
            .map((plannedSet) => plannedSet.id);
          return (
            <article
              className="session-summary-exercise"
              key={execution.exerciseId}
            >
              <header>
                <h4>{snapshot?.name ?? "Exercice historique"}</h4>
                {metadata && <p>{metadata}</p>}
              </header>
              {sets.length > 0 && (
                <ol>
                  {sets.map((set, index) => {
                    const plannedIndex = plannedSetIds.indexOf(set.setId);
                    const setNumber =
                      plannedIndex >= 0 ? plannedIndex + 1 : index + 1;
                    return (
                      <li
                        className={
                          set.status === "skipped" ? "is-skipped" : undefined
                        }
                        key={set.setId}
                      >
                        <span>{String(setNumber).padStart(2, "0")}</span>
                        <strong>{formatSet(set)}</strong>
                      </li>
                    );
                  })}
                </ol>
              )}
              {session.sessionNotes?.[execution.exerciseId]?.trim() && (
                <aside className="session-summary-note">
                  <span>Note de cette séance</span>
                  <p>{session.sessionNotes[execution.exerciseId]}</p>
                </aside>
              )}
              {snapshot?.permanentNote?.trim() && (
                <aside className="session-summary-note is-permanent">
                  <span>Note permanente</span>
                  <p>{snapshot.permanentNote}</p>
                </aside>
              )}
            </article>
          );
        })}
      </section>

      <button className="primary session-summary-return" onClick={onReturn}>
        RETOUR AUX SÉANCES
      </button>
    </section>
  );
}
