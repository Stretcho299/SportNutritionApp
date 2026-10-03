import {
  addExercise,
  createWorkout,
  createWorkoutSession,
} from "./storage/database";
import type { WorkoutSession } from "./storage/database";
import {
  formatSessionDurationLabel,
  getCompletedSessions,
  getPreviousCompletedSession,
  getSessionDurationMs,
  getSessionExerciseDetails,
  getSessionMetrics,
  getVolumeDelta,
  groupCompletedSessionsByMonth,
} from "./sessionMetrics";

const createSession = (
  id: string,
  templateId = "push",
  completedAt: number | null = 10_000,
): WorkoutSession => {
  let template = addExercise(createWorkout("Push"), "Développé couché", 3, 90);
  template = { ...template, id: templateId };
  const base = createWorkoutSession(template, 1_000);
  const exerciseId = template.exercises[0].id;
  return {
    ...base,
    id,
    templateId,
    templateName: "Push historique",
    completedAt,
    status: "completed",
    execution: {
      ...base.execution,
      status: "completed",
      completedAt: completedAt ?? undefined,
      exercises: [
        {
          exerciseId,
          status: "completed",
          sets: [
            {
              setId: "performed-a",
              status: "performed",
              weightKg: 80,
              repetitions: 8,
              restSeconds: 90,
            },
            {
              setId: "performed-b",
              status: "performed",
              weightKg: 82.5,
              repetitions: 6,
              restSeconds: 90,
            },
            {
              setId: "skipped",
              status: "skipped",
              weightKg: 100,
              repetitions: 12,
              restSeconds: 90,
            },
          ],
        },
      ],
    },
  };
};

it("clamps duration and formats whole minutes and hours in French", () => {
  const session = createSession("duration", "push", 3_121_000);
  expect(getSessionDurationMs(session)).toBe(3_120_000);
  expect(formatSessionDurationLabel(getSessionDurationMs(session))).toBe(
    "52 min",
  );
  expect(formatSessionDurationLabel(72 * 60_000)).toBe("1 h 12");
  expect(formatSessionDurationLabel(60 * 60_000)).toBe("1 h");
  expect(
    getSessionDurationMs({ ...session, completedAt: 500, startedAt: 1_000 }),
  ).toBe(0);
});

it("counts only performed sets and their repetitions and load", () => {
  const session = createSession("metrics");
  expect(getSessionMetrics(session)).toMatchObject({
    performedSets: 2,
    repetitions: 14,
    volumeKg: 1_135,
  });
});

it("treats null repetitions and null weight as zero", () => {
  const session = createSession("null-values");
  const execution = session.execution.exercises[0];
  execution.sets = [
    { ...execution.sets[0], weightKg: null, repetitions: 8 },
    { ...execution.sets[1], weightKg: 80, repetitions: null },
  ];
  expect(getSessionMetrics(session)).toMatchObject({
    performedSets: 2,
    repetitions: 8,
    volumeKg: 0,
  });
});

it("keeps decimal load and bodyweight volume without external load at zero", () => {
  const session = createSession("decimal");
  session.execution.exercises[0].sets = [
    {
      ...session.execution.exercises[0].sets[0],
      weightKg: 82.5,
      repetitions: 8,
    },
    {
      ...session.execution.exercises[0].sets[1],
      weightKg: null,
      repetitions: 12,
    },
  ];
  expect(getSessionMetrics(session).volumeKg).toBe(660);
  expect(formatSessionDurationLabel(60_000)).toBe("1 min");
});

it("includes archived executed exercises in metrics and historical details", () => {
  const session = createSession("archived");
  const archivedBase = addExercise(
    createWorkout("Push"),
    "Élévations latérales",
    1,
    60,
  );
  const archived = archivedBase.exercises[0];
  const archivedSnapshot = {
    ...archived,
    position: 1,
    definitionSnapshot: {
      id: "custom:shoulder",
      source: "custom" as const,
      name: archived.name,
      category: "strength" as const,
      measurementType: "reps" as const,
      mechanics: "isolation" as const,
      force: "push" as const,
      muscleGroups: ["epaules" as const],
      muscleTargets: [
        { muscle: "deltoide_lateral" as const, role: "primary" as const },
      ],
      equipment: ["halteres" as const],
      aliases: [],
      illustrationId: "exercise-lateral-raise-dumbbell",
    },
    permanentNote: "Banc incliné à 30°",
  };
  session.snapshot.exercises.push(archivedSnapshot);
  session.execution.archivedExercises = [
    {
      exerciseId: archived.id,
      status: "completed",
      sets: [
        {
          setId: archived.plannedSets[0].id,
          status: "performed",
          weightKg: 7.5,
          repetitions: 12,
          restSeconds: 60,
        },
      ],
    },
  ];

  expect(getSessionMetrics(session)).toMatchObject({
    performedSets: 3,
    repetitions: 26,
    volumeKg: 1_225,
  });
  expect(
    getSessionExerciseDetails(session).map(({ snapshot }) => snapshot?.name),
  ).toEqual(["Développé couché", "Élévations latérales"]);
});

it("sorts completed sessions and groups them by month", () => {
  const older = createSession("older", "push", Date.UTC(2026, 8, 3));
  const newer = createSession("newer", "push", Date.UTC(2026, 9, 3));
  const fallback = {
    ...createSession("fallback", "push", null),
    startedAt: Date.UTC(2026, 9, 2),
  };
  const active = { ...createSession("active"), status: "inProgress" as const };
  expect(
    getCompletedSessions([older, active, fallback, newer]).map(
      (item) => item.id,
    ),
  ).toEqual(["newer", "fallback", "older"]);
  expect(
    groupCompletedSessionsByMonth([older, active, fallback, newer]),
  ).toHaveLength(2);
});

it("compares against the latest strictly earlier completed session of the same template", () => {
  const previous = createSession("previous", "push", 20_000);
  const earlier = createSession("earlier", "push", 10_000);
  const otherTemplate = createSession("other", "pull", 25_000);
  const current = createSession("current", "push", 30_000);
  const sameTime = createSession("same-time", "push", 30_000);
  const abandoned = {
    ...createSession("abandoned", "push", 29_000),
    status: "abandoned" as const,
  };
  const active = {
    ...createSession("active", "push", 29_000),
    status: "inProgress" as const,
  };
  expect(
    getPreviousCompletedSession(current, [
      earlier,
      active,
      abandoned,
      sameTime,
      otherTemplate,
      previous,
    ])?.id,
  ).toBe("previous");
  expect(getVolumeDelta(current, previous)).toEqual({ deltaKg: 0, percent: 0 });
});

it("returns signed volume deltas and omits percent for a zero or missing prior volume", () => {
  const current = createSession("current", "push", 30_000);
  const previous = createSession("previous", "push", 20_000);
  previous.execution.exercises[0].sets = [
    {
      ...previous.execution.exercises[0].sets[0],
      weightKg: 50,
      repetitions: 10,
    },
  ];
  expect(getVolumeDelta(current, previous)).toEqual({
    deltaKg: 635,
    percent: 127,
  });
  current.execution.exercises[0].sets = [
    {
      ...current.execution.exercises[0].sets[0],
      weightKg: 20,
      repetitions: 10,
    },
  ];
  expect(getVolumeDelta(current, previous)).toEqual({
    deltaKg: -300,
    percent: -60,
  });
  previous.execution.exercises[0].sets = [];
  expect(getVolumeDelta(current, previous)).toEqual({
    deltaKg: 200,
    percent: undefined,
  });
  expect(getVolumeDelta(current, undefined)).toBeUndefined();
});
