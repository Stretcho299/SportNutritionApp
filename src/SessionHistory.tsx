import type { WorkoutSession } from "./storage/database";
import {
  formatSessionDay,
  formatSessionDurationLabel,
  formatSessionNumber,
  getSessionMetrics,
  groupCompletedSessionsByMonth,
} from "./sessionMetrics";

export function SessionHistory({
  sessions,
  loading = false,
  motionClass = "",
  onOpenSession,
}: {
  sessions: WorkoutSession[];
  loading?: boolean;
  motionClass?: string;
  onOpenSession: (session: WorkoutSession) => void;
}) {
  const groups = groupCompletedSessionsByMonth(sessions);

  return (
    <section
      className={`session-history${motionClass}`}
      aria-label="Historique"
    >
      {loading ? (
        <p className="session-history-empty">Chargement de l’historique…</p>
      ) : groups.length === 0 ? (
        <section className="session-history-empty">
          <h2>Aucune séance terminée</h2>
          <p>Vos séances terminées apparaîtront ici.</p>
        </section>
      ) : (
        <div className="session-history-groups">
          {groups.map((group) => (
            <section className="session-history-group" key={group.key}>
              <h2>{group.label}</h2>
              <ul>
                {group.sessions.map((session) => {
                  const metrics = getSessionMetrics(session);
                  const timestamp = session.completedAt ?? session.startedAt;
                  return (
                    <li key={session.id}>
                      <button
                        className="session-history-row"
                        aria-label={`Ouvrir le bilan de ${session.templateName}`}
                        onClick={() => onOpenSession(session)}
                      >
                        <span className="session-history-day">
                          {formatSessionDay(timestamp)}
                        </span>
                        <span className="session-history-copy">
                          <strong>{session.templateName}</strong>
                          <small>
                            {formatSessionDurationLabel(metrics.durationMs)}
                            <span aria-hidden="true"> · </span>
                            {metrics.performedSets} série
                            {metrics.performedSets === 1 ? "" : "s"}
                            <span aria-hidden="true"> · </span>
                            {formatSessionNumber(metrics.volumeKg)} kg
                          </small>
                        </span>
                        <span
                          className="session-history-chevron"
                          aria-hidden="true"
                        >
                          ›
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
