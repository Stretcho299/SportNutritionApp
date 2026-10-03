import type {
  ExecutedExercise,
  ExecutedSet,
  Exercise,
  WorkoutSession,
} from "./storage/database";

export type SessionMetrics = {
  durationMs: number;
  performedSets: number;
  repetitions: number;
  volumeKg: number;
};

export type SessionExerciseDetail = {
  execution: ExecutedExercise;
  snapshot: Exercise | undefined;
  sets: ExecutedSet[];
};

export type SessionMonthGroup = {
  key: string;
  label: string;
  sessions: WorkoutSession[];
};

const sessionTimestamp = (session: WorkoutSession) =>
  session.completedAt ?? session.startedAt;

export function getSessionDurationMs(session: WorkoutSession) {
  return Math.max(0, sessionTimestamp(session) - session.startedAt);
}

export function formatSessionDurationLabel(durationMs: number) {
  const minutes = Math.max(0, Math.round(durationMs / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} h ${remainder}` : `${hours} h`;
}

export function formatSessionNumber(value: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(
    value,
  );
}

export function getSessionExerciseDetails(
  session: WorkoutSession,
): SessionExerciseDetail[] {
  const snapshotById = new Map(
    session.snapshot.exercises.map((exercise) => [exercise.id, exercise]),
  );
  const executionById = new Map<string, ExecutedExercise>();
  for (const executed of [
    ...session.execution.exercises,
    ...(session.execution.archivedExercises ?? []),
  ]) {
    executionById.set(executed.exerciseId, executed);
  }

  return [...executionById.values()]
    .map((execution, index) => ({
      execution,
      snapshot: snapshotById.get(execution.exerciseId),
      index,
    }))
    .sort(
      (a, b) =>
        (a.snapshot?.position ?? Number.MAX_SAFE_INTEGER) -
          (b.snapshot?.position ?? Number.MAX_SAFE_INTEGER) ||
        a.index - b.index,
    )
    .map(({ execution, snapshot }) => ({
      execution,
      snapshot,
      sets: execution.sets.filter(
        (set) => set.status === "performed" || set.status === "skipped",
      ),
    }));
}

export function getSessionMetrics(session: WorkoutSession): SessionMetrics {
  const executedExercises = [
    ...session.execution.exercises,
    ...(session.execution.archivedExercises ?? []),
  ];
  let performedSets = 0;
  let repetitions = 0;
  let volumeKg = 0;

  for (const exercise of executedExercises) {
    for (const set of exercise.sets) {
      if (set.status !== "performed") continue;
      performedSets += 1;
      repetitions += set.repetitions ?? 0;
      volumeKg += (set.weightKg ?? 0) * (set.repetitions ?? 0);
    }
  }

  return {
    durationMs: getSessionDurationMs(session),
    performedSets,
    repetitions,
    volumeKg: Math.round((volumeKg + Number.EPSILON) * 10) / 10,
  };
}

export function getVolumeDelta(
  session: WorkoutSession,
  previous: WorkoutSession | undefined,
) {
  if (!previous) return undefined;
  const previousVolume = getSessionMetrics(previous).volumeKg;
  const deltaKg = getSessionMetrics(session).volumeKg - previousVolume;
  return {
    deltaKg,
    percent: previousVolume > 0 ? (deltaKg / previousVolume) * 100 : undefined,
  };
}

export function getCompletedSessions(sessions: WorkoutSession[]) {
  return sessions
    .filter((session) => session.status === "completed")
    .sort((a, b) => sessionTimestamp(b) - sessionTimestamp(a));
}

export function groupCompletedSessionsByMonth(
  sessions: WorkoutSession[],
): SessionMonthGroup[] {
  const groups = new Map<string, SessionMonthGroup>();
  for (const session of getCompletedSessions(sessions)) {
    const date = new Date(sessionTimestamp(session));
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        label: new Intl.DateTimeFormat("fr-FR", {
          month: "long",
          year: "numeric",
        })
          .format(date)
          .toLocaleUpperCase("fr-FR"),
        sessions: [],
      };
      groups.set(key, group);
    }
    group.sessions.push(session);
  }
  return [...groups.values()];
}

export function getPreviousCompletedSession(
  session: WorkoutSession,
  sessions: WorkoutSession[],
) {
  const currentTimestamp = sessionTimestamp(session);
  return getCompletedSessions(sessions).find(
    (candidate) =>
      candidate.id !== session.id &&
      candidate.templateId === session.templateId &&
      sessionTimestamp(candidate) < currentTimestamp,
  );
}

export function formatSessionDate(timestamp: number) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

export function formatSessionDay(timestamp: number) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit" }).format(timestamp);
}
