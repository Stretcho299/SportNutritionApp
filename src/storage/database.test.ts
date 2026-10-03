import { IDBFactory } from "fake-indexeddb";
import {
  createCustomExercise,
  officialExercises,
  updateCustomExercise,
} from "../exercises/catalog";
import {
  activateExecutedExercise,
  canReplaceExecutedExercise,
  abandonWorkoutSession,
  addExercise,
  addExerciseToExecution,
  addSet,
  addSetToExecution,
  completeWorkoutExecution,
  completeWorkoutSession,
  createWorkout,
  createWorkoutSession,
  defaultInitialSetCount,
  defaultRestSeconds,
  hasActiveWorkoutSession,
  hasCompletedWorkoutSession,
  legacyDefaultRestSeconds,
  finishExecutedRest,
  loadWorkouts,
  loadWorkoutStore,
  removeExecutedExercise,
  removeExecutedSet,
  removeExecutedUpcomingSet,
  reorder,
  saveWorkouts,
  saveWorkoutStore,
  saveCustomDefinitions,
  saveCustomDefinitionAndUpdateTemplates,
  updateCustomDefinitionInStore,
  replaceExerciseDefinition,
  skipExecutedExercise,
  startExecutedSetRest,
  startWorkoutExecution,
  setIdsFromSelection,
  type Workout,
  updateExecutedSet,
  updateExecutedSets,
  updatePlannedSetValues,
} from "./database";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());

it("keeps definition snapshots in templates and sessions after a custom definition is deleted", async () => {
  const custom = createCustomExercise({
    name: "Tirage personnel",
    primaryMuscle: "grand_dorsal",
    equipment: ["poulie"],
  });
  await saveCustomDefinitions([custom]);
  const workout = addExercise(createWorkout("Dos"), custom.name, 2, 60, custom);
  const session = createWorkoutSession(workout, 1234);
  await saveWorkoutStore({
    version: 2,
    templates: [workout],
    sessions: [session],
    customDefinitions: [custom],
  });
  await saveCustomDefinitions([]);
  const stored = await loadWorkoutStore();
  expect(stored.customDefinitions).toEqual([]);
  expect(stored.templates[0].exercises[0].definitionSnapshot).toEqual(custom);
  expect(stored.sessions[0].snapshot.exercises[0].definitionSnapshot).toEqual(
    custom,
  );
  expect(stored.sessions[0].snapshot.exercises[0].name).toBe(
    "Tirage personnel",
  );
});

it("keeps a just-created custom definition when a localStorage workout is saved immediately", async () => {
  vi.stubGlobal("indexedDB", undefined);
  localStorage.clear();
  const custom = createCustomExercise({
    name: "Row local",
    primaryMuscle: "grand_dorsal",
  });
  void saveCustomDefinitions([custom]);
  await saveWorkouts([
    addExercise(createWorkout("Dos"), custom.name, 1, 30, custom),
  ]);
  const stored = await loadWorkoutStore();
  expect(stored.customDefinitions).toEqual([custom]);
  expect(stored.templates[0].exercises[0].definitionSnapshot).toEqual(custom);
});

it("freezes official muscle metadata when a session starts", () => {
  const definition = officialExercises[0];
  const workout = addExercise(
    createWorkout("Push"),
    definition.name,
    3,
    90,
    definition,
  );
  const session = createWorkoutSession(workout, 1234);
  workout.exercises[0].definitionSnapshot!.muscleTargets[0].muscle = "biceps";
  expect(
    session.snapshot.exercises[0].definitionSnapshot?.muscleTargets[0].muscle,
  ).toBe("grand_pectoral");
  expect(session.snapshot.exercises[0].exerciseDefinitionId).toBe(
    definition.id,
  );
  expect(session.snapshot.exercises[0].definitionSnapshot?.illustrationId).toBe(
    definition.illustrationId,
  );
});

it("replaces an occurrence definition while preserving planned structure and clearing old values and notes", () => {
  const bench = officialExercises.find(
    (definition) => definition.id === "official:bench-press-barbell",
  )!;
  const shoulder = officialExercises.find(
    (definition) => definition.id === "official:lateral-raise-dumbbell",
  )!;
  const workout = addExercise(createWorkout("Push"), bench.name, 3, 90, bench);
  const occurrence = workout.exercises[0];
  occurrence.position = 4;
  occurrence.permanentNote = "Note propre au développé";
  occurrence.plannedSets[0] = {
    ...occurrence.plannedSets[0],
    weightKg: 42.5,
    repetitions: 8,
    restSeconds: 135,
  };
  workout.sessionNotes = { [occurrence.id]: "Note de l'ancienne séance" };

  const replaced = replaceExerciseDefinition(workout, occurrence.id, shoulder);
  const next = replaced.exercises[0];
  expect(next).toMatchObject({
    id: occurrence.id,
    position: 4,
    name: shoulder.name,
    exerciseDefinitionId: shoulder.id,
    definitionSnapshot: shoulder,
  });
  expect(next.permanentNote).toBeUndefined();
  expect(next.plannedSets).toHaveLength(3);
  expect(next.plannedSets[0]).toMatchObject({
    id: occurrence.plannedSets[0].id,
    position: occurrence.plannedSets[0].position,
    weightKg: null,
    repetitions: null,
    restSeconds: 135,
  });
  expect(replaced.sessionNotes).toEqual({});
});

it("allows replacement only before an executed exercise has work or rest", () => {
  const workout = addExercise(createWorkout("Push"), "Bench", 3, 90);
  const id = workout.exercises[0].id;
  const active = startWorkoutExecution(workout, 1000);
  const upcoming = {
    ...active,
    exercises: active.exercises.map((exercise) => ({
      ...exercise,
      status: "upcoming" as const,
      sets: exercise.sets.map((set) => ({
        ...set,
        status: "upcoming" as const,
      })),
    })),
  };
  expect(canReplaceExecutedExercise(upcoming, id)).toBe(true);
  expect(canReplaceExecutedExercise(active, id)).toBe(true);
  for (const status of ["performed", "skipped", "resting"] as const) {
    const changed = {
      ...active,
      exercises: active.exercises.map((exercise) => ({
        ...exercise,
        sets: exercise.sets.map((set, index) =>
          index === 0 ? { ...set, status } : set,
        ),
      })),
    };
    expect(canReplaceExecutedExercise(changed, id)).toBe(false);
  }
  expect(
    canReplaceExecutedExercise({ ...active, status: "completed" }, id),
  ).toBe(false);
  expect(canReplaceExecutedExercise(active, "missing")).toBe(false);
});

it("replaces an active occurrence, execution and snapshot without changing completed history", async () => {
  const bench = officialExercises.find(
    (item) => item.id === "official:bench-press-barbell",
  )!;
  const shoulder = officialExercises.find(
    (item) => item.id === "official:lateral-raise-dumbbell",
  )!;
  const workout = addExercise(createWorkout("Push"), bench.name, 3, 90, bench);
  const original = workout.exercises[0];
  original.position = 4;
  original.permanentNote = "Ancien mouvement";
  original.plannedSets[0] = {
    ...original.plannedSets[0],
    weightKg: 45,
    repetitions: 8,
    restSeconds: 135,
  };
  const session = createWorkoutSession(workout, 1000);
  const current: Workout = {
    ...workout,
    execution: session.execution,
    sessionNotes: { [original.id]: "Note de séance" },
  };
  await saveWorkouts([current]);
  const completed = {
    ...session,
    id: "past",
    status: "completed" as const,
    completedAt: 900,
    execution: {
      ...session.execution,
      sessionId: "past",
      status: "completed" as const,
      completedAt: 900,
    },
  };
  const abandoned = {
    ...session,
    id: "abandoned",
    status: "abandoned" as const,
    abandonedAt: 950,
    execution: { ...session.execution, sessionId: "abandoned" },
  };
  const before = await loadWorkoutStore();
  await saveWorkoutStore({
    ...before,
    sessions: [completed, abandoned, ...before.sessions],
  });
  const replaced = replaceExerciseDefinition(current, original.id, shoulder);
  expect(replaced.exercises[0]).toMatchObject({
    id: original.id,
    position: 4,
    name: shoulder.name,
    exerciseDefinitionId: shoulder.id,
    definitionSnapshot: shoulder,
  });
  expect(replaced.exercises[0].permanentNote).toBeUndefined();
  expect(replaced.sessionNotes).toEqual({});
  expect(replaced.exercises[0].plannedSets.map((set) => set.id)).toEqual(
    original.plannedSets.map((set) => set.id),
  );
  expect(
    replaced.exercises[0].plannedSets.map((set) => set.restSeconds),
  ).toEqual(original.plannedSets.map((set) => set.restSeconds));
  expect(
    replaced.exercises[0].plannedSets.every(
      (set) => set.weightKg === null && set.repetitions === null,
    ),
  ).toBe(true);
  expect(replaced.execution?.exercises[0].status).toBe("active");
  expect(
    replaced.execution?.exercises[0].sets.map((set) => set.status),
  ).toEqual(session.execution.exercises[0].sets.map((set) => set.status));
  expect(replaced.execution?.exercises[0].sets.map((set) => set.setId)).toEqual(
    original.plannedSets.map((set) => set.id),
  );
  expect(
    replaced.execution?.exercises[0].sets.every(
      (set) => set.weightKg === null && set.repetitions === null,
    ),
  ).toBe(true);
  await saveWorkouts([replaced]);
  const stored = await loadWorkoutStore();
  expect(
    stored.sessions.find((item) => item.id === session.id)?.snapshot
      .exercises[0],
  ).toMatchObject({
    name: shoulder.name,
    exerciseDefinitionId: shoulder.id,
    definitionSnapshot: shoulder,
  });
  expect(
    stored.sessions.find((item) => item.id === session.id)?.snapshot
      .exercises[0].plannedSets,
  ).toEqual(replaced.exercises[0].plannedSets);
  expect(
    stored.sessions.find((item) => item.id === "past")?.snapshot.exercises[0],
  ).toMatchObject({
    name: bench.name,
    exerciseDefinitionId: bench.id,
    definitionSnapshot: bench,
  });
  expect(
    stored.sessions.find((item) => item.id === "abandoned")?.snapshot
      .exercises[0],
  ).toMatchObject({
    name: bench.name,
    exerciseDefinitionId: bench.id,
    definitionSnapshot: bench,
  });
  expect(
    replaceExerciseDefinition(
      {
        ...current,
        execution: {
          ...current.execution!,
          exercises: [
            {
              ...current.execution!.exercises[0],
              sets: [
                {
                  ...current.execution!.exercises[0].sets[0],
                  status: "performed",
                },
                ...current.execution!.exercises[0].sets.slice(1),
              ],
            },
          ],
        },
      },
      original.id,
      shoulder,
    ),
  ).toMatchObject({ exercises: [{ name: bench.name }] });
});

it("updates custom definitions and template occurrences without changing historical snapshots", async () => {
  const original = createCustomExercise({
    name: "Presse perso",
    primaryMuscle: "grand_pectoral",
    secondaryMuscles: ["triceps"],
  });
  const workout = addExercise(
    createWorkout("Push"),
    original.name,
    2,
    75,
    original,
  );
  const occurrence = workout.exercises[0];
  occurrence.position = 3;
  occurrence.permanentNote = "Garder la prise";
  occurrence.plannedSets[0] = {
    ...occurrence.plannedSets[0],
    weightKg: 32,
    repetitions: 10,
    restSeconds: 100,
  };
  const session = createWorkoutSession(workout, 1234);
  const originalHistoricalSnapshot = structuredClone(session.snapshot);
  const secondTemplate = addExercise(
    createWorkout("Push B"),
    original.name,
    1,
    45,
    original,
  );
  const store = {
    version: 2 as const,
    templates: [workout, secondTemplate],
    sessions: [session],
    customDefinitions: [original],
  };
  await saveWorkoutStore(store);

  const updated = updateCustomExercise(original, {
    name: "Presse convergente",
    primaryMuscle: "grand_pectoral",
    secondaryMuscles: ["triceps", "deltoide_anterieur"],
    equipment: ["machine"],
  });
  const pureResult = updateCustomDefinitionInStore(store, updated);
  expect(pureResult.sessions[0].snapshot).toEqual(originalHistoricalSnapshot);
  await saveCustomDefinitionAndUpdateTemplates(updated);

  const saved = await loadWorkoutStore();
  expect(saved.customDefinitions).toEqual([updated]);
  const savedOccurrence = saved.templates[0].exercises[0];
  expect(savedOccurrence).toMatchObject({
    id: occurrence.id,
    position: 3,
    name: "Presse convergente",
    exerciseDefinitionId: original.id,
    definitionSnapshot: updated,
    permanentNote: "Garder la prise",
  });
  expect(savedOccurrence.plannedSets).toEqual(occurrence.plannedSets);
  expect(saved.templates[1].exercises[0]).toMatchObject({
    name: "Presse convergente",
    exerciseDefinitionId: original.id,
    definitionSnapshot: updated,
  });
  expect(saved.sessions[0].snapshot).toEqual(originalHistoricalSnapshot);
  expect(saved.sessions[0].snapshot.exercises[0].name).toBe("Presse perso");
});

it("keeps legacy occurrences unassociated when custom definitions are updated", () => {
  const legacy = addExercise(createWorkout("Push"), "Presse perso");
  const custom = createCustomExercise({
    name: "Presse perso",
    primaryMuscle: "grand_pectoral",
  });
  const updated = updateCustomExercise(custom, { name: "Presse nouvelle" });
  const store = updateCustomDefinitionInStore(
    {
      version: 2,
      templates: [legacy],
      sessions: [],
      customDefinitions: [custom],
    },
    updated,
  );
  expect(store.templates[0].exercises[0].exerciseDefinitionId).toBeUndefined();
  expect(store.templates[0].exercises[0].name).toBe("Presse perso");
});

it("preserves legacy names without linking them to official IDs during v2 loading", async () => {
  const workout = addExercise(
    createWorkout("Ancien"),
    "Développé couché",
    1,
    90,
  );
  await saveWorkoutStore({ version: 2, templates: [workout], sessions: [] });
  const stored = await loadWorkoutStore();
  expect(stored.templates[0].exercises[0].name).toBe("Développé couché");
  expect(stored.templates[0].exercises[0].exerciseDefinitionId).toBeUndefined();
});

it("round-trips blank and subsequently edited sets through IndexedDB", async () => {
  const workout = addExercise(createWorkout("Push"), "Bench", 4, 120);
  await saveWorkouts([workout]);
  expect(await loadWorkouts()).toEqual([workout]);
  workout.exercises[0] = addSet(workout.exercises[0]);
  workout.exercises[0].plannedSets[0].weightKg = 82.5;
  workout.exercises[0].plannedSets[0].repetitions = 8;
  await saveWorkouts([workout]);
  expect(await loadWorkouts()).toEqual([workout]);
  expect((await loadWorkouts())[0].exercises[0].plannedSets[4]).toMatchObject({
    weightKg: null,
    repetitions: null,
    restSeconds: 120,
  });
});

it("creates new exercises with three sets and 150 seconds of rest by default", () => {
  const workout = addExercise(createWorkout("Push"), "Bench");
  const exercise = workout.exercises[0];
  expect(defaultInitialSetCount).toBe(3);
  expect(defaultRestSeconds).toBe(150);
  expect(legacyDefaultRestSeconds).toBe(90);
  expect(
    addSet({ ...exercise, plannedSets: [] }).plannedSets[0].restSeconds,
  ).toBe(150);
  expect(exercise.plannedSets).toHaveLength(3);
  expect(exercise.plannedSets.map((set) => set.restSeconds)).toEqual([
    150, 150, 150,
  ]);

  const execution = startWorkoutExecution(workout, 1000);
  const updatedExecution = addExerciseToExecution(
    execution,
    addExercise(createWorkout("Unused"), "Row").exercises[0],
  );
  expect(updatedExecution.exercises[1].sets).toHaveLength(3);
  expect(
    updatedExecution.exercises[1].sets.map((set) => set.restSeconds),
  ).toEqual([150, 150, 150]);
});

it("shows first-session state until a completed session exists for the template", () => {
  const workout = addExercise(createWorkout("Push"), "Bench");
  const session = createWorkoutSession(workout, 1000);
  expect(hasCompletedWorkoutSession([], workout.id)).toBe(false);
  expect(
    hasCompletedWorkoutSession(
      [{ ...session, status: "abandoned", abandonedAt: 2000 }],
      workout.id,
    ),
  ).toBe(false);
  expect(
    hasCompletedWorkoutSession(
      [{ ...session, status: "completed", completedAt: 3000 }],
      workout.id,
    ),
  ).toBe(true);
  expect(
    hasCompletedWorkoutSession(
      [{ ...session, templateId: "another-template", status: "completed" }],
      workout.id,
    ),
  ).toBe(false);
});

it("selects current and following planned sets in displayed order and preserves IDs", () => {
  let workout = addExercise(createWorkout("Push"), "Bench", 4, 30);
  workout = addExercise(workout, "Row", 2, 60);
  const [bench, row] = workout.exercises;
  const originalIds = bench.plannedSets.map((set) => set.id);
  const selectedId = originalIds[1];
  const cascadeIds = setIdsFromSelection(bench.plannedSets, selectedId, true);
  const updated = updatePlannedSetValues(bench, cascadeIds, "weightKg", 80);
  expect(updated.plannedSets.map((set) => set.weightKg)).toEqual([
    null,
    80,
    80,
    80,
  ]);
  expect(updated.plannedSets.map((set) => set.repetitions)).toEqual([
    null,
    null,
    null,
    null,
  ]);
  expect(updated.plannedSets.map((set) => set.restSeconds)).toEqual([
    30, 30, 30, 30,
  ]);
  expect(updated.plannedSets.map((set) => set.id)).toEqual(originalIds);
  expect(updated.plannedSets.map((set) => set.position)).toEqual([0, 1, 2, 3]);
  expect(row.plannedSets.map((set) => set.weightKg)).toEqual([null, null]);
  const execution = startWorkoutExecution(workout, 1000);
  const executionAfterCascade = updateExecutedSets(
    execution,
    bench.id,
    cascadeIds,
    "weightKg",
    80,
  );
  expect(
    executionAfterCascade.exercises[1].sets.map((set) => set.weightKg),
  ).toEqual([null, null]);
  expect(addSet(updated).plannedSets.at(-1)).toMatchObject({
    weightKg: null,
    repetitions: null,
  });
  expect(setIdsFromSelection(bench.plannedSets, "missing", true)).toEqual([]);
  const reordered = bench.plannedSets.map((set, index) => ({
    ...set,
    position: [3, 0, 2, 1][index],
  }));
  expect(setIdsFromSelection(reordered, originalIds[2], true)).toEqual([
    originalIds[2],
    originalIds[0],
  ]);
});

it("keeps a picker edit local when apply-to-following is off", () => {
  const exercise = addExercise(createWorkout("Push"), "Bench", 4, 30)
    .exercises[0];
  const setIds = setIdsFromSelection(
    exercise.plannedSets,
    exercise.plannedSets[1].id,
    false,
  );
  const updated = updatePlannedSetValues(exercise, setIds, "weightKg", 80);
  expect(updated.plannedSets.map((set) => set.weightKg)).toEqual([
    null,
    80,
    null,
    null,
  ]);
});

it("propagates repetitions and rest without changing a running rest clock or performed status", () => {
  const workout = addExercise(createWorkout("Push"), "Bench", 4, 30);
  const exercise = workout.exercises[0];
  const ids = setIdsFromSelection(
    exercise.plannedSets,
    exercise.plannedSets[1].id,
    true,
  );
  const repetitions = updatePlannedSetValues(exercise, ids, "repetitions", 10);
  const rest = updatePlannedSetValues(exercise, ids, "restSeconds", 75);
  expect(repetitions.plannedSets.map((set) => set.repetitions)).toEqual([
    null,
    10,
    10,
    10,
  ]);
  expect(rest.plannedSets.map((set) => set.restSeconds)).toEqual([
    30, 75, 75, 75,
  ]);
  expect(repetitions.plannedSets.map((set) => set.weightKg)).toEqual([
    null,
    null,
    null,
    null,
  ]);
  expect(repetitions.plannedSets.map((set) => set.restSeconds)).toEqual([
    30, 30, 30, 30,
  ]);
  expect(rest.plannedSets.map((set) => set.weightKg)).toEqual([
    null,
    null,
    null,
    null,
  ]);
  expect(rest.plannedSets.map((set) => set.repetitions)).toEqual([
    null,
    null,
    null,
    null,
  ]);

  let execution = startWorkoutExecution(workout, 1000);
  execution = startExecutedSetRest(
    execution,
    exercise.id,
    exercise.plannedSets[0].id,
    1000,
  );
  const active = execution.exercises[0].sets[0];
  expect(active).toMatchObject({
    status: "resting",
    restEndsAt: 31000,
    restDurationSeconds: 30,
  });
  const performedExecution = {
    ...execution,
    exercises: execution.exercises.map((item) => ({
      ...item,
      sets: item.sets.map((set, index) =>
        index === 2 ? { ...set, status: "performed" as const } : set,
      ),
    })),
  };
  const propagated = updateExecutedSets(
    performedExecution,
    exercise.id,
    setIdsFromSelection(exercise.plannedSets, exercise.plannedSets[0].id, true),
    "restSeconds",
    90,
  );
  expect(propagated.exercises[0].sets.map((set) => set.restSeconds)).toEqual([
    90, 90, 90, 90,
  ]);
  expect(propagated.exercises[0].sets[0]).toMatchObject({
    status: "resting",
    restEndsAt: 31000,
    restDurationSeconds: 30,
  });
  expect(propagated.exercises[0].sets[2].status).toBe("performed");
});

it("does not modify a finalized execution through set-value propagation", () => {
  const workout = addExercise(createWorkout("Push"), "Bench", 2, 30);
  const execution = {
    ...startWorkoutExecution(workout, 1000),
    status: "completed" as const,
    completedAt: 2000,
  };
  expect(
    updateExecutedSets(
      execution,
      workout.exercises[0].id,
      workout.exercises[0].plannedSets.map((set) => set.id),
      "weightKg",
      100,
    ),
  ).toBe(execution);
});

it("keeps legacy numeric values, IDs and positions when adding and saving a blank set", async () => {
  const legacy: Workout = {
    id: "w",
    name: "Legacy",
    exercises: [
      {
        id: "e",
        name: "Squat",
        position: 0,
        plannedSets: [
          {
            id: "s",
            position: 0,
            weightKg: 0,
            repetitions: 12,
            restSeconds: 60,
          },
        ],
      },
    ],
  };
  await saveWorkouts([legacy]);
  const [loaded] = await loadWorkouts();
  expect(loaded).toEqual(legacy);
  loaded.exercises[0] = addSet(loaded.exercises[0]);
  await saveWorkouts([loaded]);
  const [saved] = await loadWorkouts();
  expect(saved.exercises[0].plannedSets[0]).toEqual(
    legacy.exercises[0].plannedSets[0],
  );
  expect(saved.exercises[0].plannedSets[1]).toMatchObject({
    position: 1,
    repetitions: null,
    weightKg: null,
    restSeconds: 60,
  });
});

it("uses an exercise rest default after deleting all sets, or preserves 90 seconds for a legacy empty exercise", () => {
  const exercise = addExercise(createWorkout("Push"), "Bench", 1, 120)
    .exercises[0];
  expect(
    addSet({ ...exercise, plannedSets: [] }).plannedSets[0].restSeconds,
  ).toBe(120);
  expect(
    addSet({ id: "old", name: "Old", position: 0, plannedSets: [] })
      .plannedSets[0].restSeconds,
  ).toBe(90);
});

it("uses the last set in persisted display order as the rest reference", () => {
  const exercise = addExercise(createWorkout("Push"), "Bench", 2, 120)
    .exercises[0];
  exercise.plannedSets[0].position = 1;
  exercise.plannedSets[1].position = 0;
  exercise.plannedSets[0].restSeconds = 0;
  expect(addSet(exercise).plannedSets.at(-1)?.restSeconds).toBe(0);
});

it("starts the selected exercise without activating its neighbors", () => {
  let workout = addExercise(createWorkout("Init"), "A", 2, 30);
  workout = addExercise(workout, "B", 2, 30);
  workout = addExercise(workout, "C", 2, 30);
  const [, b] = workout.exercises;
  const execution = startWorkoutExecution(workout, 1000, b.id);

  expect(execution.exercises.map((item) => item.status)).toEqual([
    "upcoming",
    "active",
    "upcoming",
  ]);
  expect(
    execution.exercises.find((item) => item.exerciseId === b.id)?.status,
  ).toBe("active");
});

it("persists execution states, advances after rest, and skips remaining sets", async () => {
  const workout = addExercise(createWorkout("Push"), "Bench", 2, 30);
  const execution = startWorkoutExecution(workout, 1000);
  expect(execution.exercises[0].sets[0].status).toBe("active");
  const resting = startExecutedSetRest(
    execution,
    workout.exercises[0].id,
    workout.exercises[0].plannedSets[0].id,
    1000,
  );
  expect(resting.exercises[0].sets[0]).toMatchObject({
    status: "resting",
    restEndsAt: 31000,
  });
  const advanced = finishExecutedRest(resting);
  expect(advanced.exercises[0].sets[1].status).toBe("active");
  const skipped = skipExecutedExercise(advanced, workout.exercises[0].id);
  expect(skipped.exercises[0].sets.map((set) => set.status)).toEqual([
    "performed",
    "skipped",
  ]);
  await saveWorkouts([{ ...workout, execution: skipped }]);
  expect((await loadWorkouts())[0].execution).toEqual(skipped);
});

it("enforces a single active rest across exercises at the model boundary", () => {
  let workout = addExercise(createWorkout("Push"), "Bench", 2, 30);
  workout = addExercise(workout, "Row", 1, 30);
  const bench = workout.exercises[0];
  const row = workout.exercises[1];
  const execution = startWorkoutExecution(workout, 1000);
  const resting = startExecutedSetRest(
    execution,
    bench.id,
    bench.plannedSets[0].id,
    1000,
  );
  const rowActive = activateExecutedExercise(resting, row.id);
  const blocked = startExecutedSetRest(
    rowActive,
    row.id,
    row.plannedSets[0].id,
    1000,
  );
  expect(blocked).toEqual(rowActive);
  expect(
    blocked.exercises.flatMap((exercise) =>
      exercise.sets.filter((set) => set.status === "resting"),
    ),
  ).toHaveLength(1);
  const afterFinish = finishExecutedRest(blocked);
  expect(
    startExecutedSetRest(
      afterFinish,
      row.id,
      row.plannedSets[0].id,
      1000,
    ).exercises.flatMap((exercise) =>
      exercise.sets.filter((set) => set.status === "resting"),
    ),
  ).toHaveLength(1);
});

it("repairs duplicate persisted rest clocks at the storage boundary", async () => {
  let workout = addExercise(createWorkout("Dual"), "Bench", 2, 30);
  workout = addExercise(workout, "Row", 2, 30);
  const execution = startWorkoutExecution(workout, 1000);
  const duplicate = {
    ...execution,
    exercises: execution.exercises.map((exercise, index) => ({
      ...exercise,
      status: "active" as const,
      sets: exercise.sets.map((set, setIndex) =>
        setIndex === 0
          ? {
              ...set,
              status: "resting" as const,
              restEndsAt: 31000 + index * 1000,
            }
          : set,
      ),
    })),
  };

  await saveWorkouts([{ ...workout, execution: duplicate }]);
  const persisted = (await loadWorkouts())[0].execution!;
  const resting = persisted.exercises.flatMap((exercise) =>
    exercise.sets.filter((set) => set.status === "resting"),
  );

  expect(resting).toHaveLength(1);
  expect(persisted.exercises[1].sets[0].status).toBe("active");
  expect(persisted.exercises[1].sets[0].restEndsAt).toBeUndefined();
});

it("adds a future exercise without changing the active series", () => {
  const workout = addExercise(createWorkout("Push"), "Bench", 2, 30);
  const execution = startWorkoutExecution(workout, 1000);
  const expanded = addExercise(workout, "Row", 2, 30);
  const next = addExerciseToExecution(execution, expanded.exercises[1]);
  expect(next.exercises[0].sets[0].status).toBe("active");
  expect(next.exercises[1]).toMatchObject({ status: "upcoming" });
  expect(next.exercises[1].sets.map((set) => set.status)).toEqual([
    "upcoming",
    "upcoming",
  ]);
});

it("preserves independent exercise progress when changing exercises", () => {
  let workout = addExercise(createWorkout("Push"), "Bench", 4, 30);
  workout = addExercise(workout, "Row", 2, 30);
  const bench = workout.exercises[0];
  const row = workout.exercises[1];
  let execution = startWorkoutExecution(workout, 1000);
  for (const set of bench.plannedSets.slice(0, 2)) {
    execution = startExecutedSetRest(execution, bench.id, set.id, 1000);
    execution = finishExecutedRest(execution);
  }
  expect(execution.exercises[0].sets[2].status).toBe("active");
  execution = activateExecutedExercise(execution, row.id);
  expect(execution.exercises[1].sets[0].status).toBe("active");
  execution = startExecutedSetRest(
    execution,
    row.id,
    row.plannedSets[0].id,
    1000,
  );
  execution = finishExecutedRest(execution);
  expect(execution.exercises[1].sets[1].status).toBe("active");
  expect(
    activateExecutedExercise(execution, bench.id).exercises[0].sets[2].status,
  ).toBe("active");
});

it("does not activate another exercise after finishing a rest", () => {
  let workout = addExercise(createWorkout("Push"), "Bench", 1, 30);
  workout = addExercise(workout, "Row", 1, 30);
  const first = workout.exercises[0];
  let execution = startWorkoutExecution(workout, 1000);
  execution = startExecutedSetRest(
    execution,
    first.id,
    first.plannedSets[0].id,
    1000,
  );
  execution = finishExecutedRest(execution);
  expect(execution.exercises.map((exercise) => exercise.status)).toEqual([
    "completed",
    "upcoming",
  ]);
});

it("does not activate another exercise after finishing an exercise", () => {
  let workout = addExercise(createWorkout("Push"), "Bench", 1, 30);
  workout = addExercise(workout, "Row", 1, 30);
  const first = workout.exercises[0];
  const execution = skipExecutedExercise(
    startWorkoutExecution(workout, 1000),
    first.id,
  );
  expect(execution.exercises.map((exercise) => exercise.status)).toEqual([
    "completed",
    "upcoming",
  ]);
});

it("removes an active non-performed set without advancing the session", () => {
  let workout = addExercise(createWorkout("Push"), "Bench", 2, 30);
  workout = addExercise(workout, "Row", 1, 30);
  const execution = startWorkoutExecution(workout, 1000);
  const next = removeExecutedSet(
    execution,
    workout.exercises[0].id,
    workout.exercises[0].plannedSets[0].id,
  );
  expect(next.exercises[0]).toMatchObject({ status: "upcoming" });
  expect(next.exercises[0].sets).toHaveLength(1);
  expect(next.exercises[0].sets[0].status).toBe("upcoming");
  expect(next.exercises[1].status).toBe("upcoming");
});

it("archives performed sets when their exercise is removed", () => {
  const workout = addExercise(
    addExercise(createWorkout("Push"), "Bench", 4, 30),
    "Row",
    1,
    30,
  );
  const bench = workout.exercises[0];
  let execution = startWorkoutExecution(workout, 1000);
  for (const set of bench.plannedSets.slice(0, 2)) {
    execution = startExecutedSetRest(execution, bench.id, set.id, 1000);
    execution = finishExecutedRest(execution);
  }
  execution = removeExecutedExercise(execution, bench.id);
  expect(execution.exercises.map((exercise) => exercise.exerciseId)).toEqual([
    workout.exercises[1].id,
  ]);
  expect(execution.archivedExercises?.[0].sets).toHaveLength(2);
  expect(execution.archivedExercises?.[0].sets).toEqual(
    expect.arrayContaining([expect.objectContaining({ status: "performed" })]),
  );
});

it("keeps archived exercise metadata in the active session snapshot without restoring its template occurrence", async () => {
  const benchDefinition = officialExercises.find(
    (definition) => definition.id === "official:bench-press-barbell",
  )!;
  let workout = addExercise(
    createWorkout("Push"),
    benchDefinition.name,
    2,
    30,
    benchDefinition,
  );
  const bench = workout.exercises[0];
  bench.permanentNote = "Banc position 4";
  workout = addExercise(workout, "Row", 1, 30);
  const session = createWorkoutSession(workout, 1_000);
  await saveWorkouts([{ ...workout, execution: session.execution }]);
  let execution = startExecutedSetRest(
    session.execution,
    bench.id,
    bench.plannedSets[0].id,
    1_000,
  );
  execution = finishExecutedRest(execution);
  execution = removeExecutedExercise(execution, bench.id);
  const currentWorkout: Workout = {
    ...workout,
    exercises: workout.exercises
      .filter((exercise) => exercise.id !== bench.id)
      .map((exercise, position) => ({ ...exercise, position })),
    execution,
    sessionNotes: { [bench.id]: "Bonne stabilité" },
  };

  await saveWorkouts([currentWorkout]);
  const stored = await loadWorkoutStore();
  const storedSession = stored.sessions[0];
  expect(stored.templates[0].exercises.map((exercise) => exercise.id)).toEqual([
    workout.exercises[1].id,
  ]);
  expect(storedSession.execution.archivedExercises?.[0].exerciseId).toBe(
    bench.id,
  );
  expect(storedSession.snapshot.exercises).toContainEqual(
    expect.objectContaining({
      id: bench.id,
      name: benchDefinition.name,
      exerciseDefinitionId: benchDefinition.id,
      definitionSnapshot: benchDefinition,
      permanentNote: "Banc position 4",
    }),
  );
  expect(storedSession.sessionNotes).toEqual({ [bench.id]: "Bonne stabilité" });
});

it("completes a session once and leaves its historical snapshot unchanged after template edits", async () => {
  let template = addExercise(createWorkout("Push"), "Bench", 1, 30);
  const originalSnapshot = createWorkoutSession(template, 1_000);
  let execution = startExecutedSetRest(
    originalSnapshot.execution,
    template.exercises[0].id,
    template.exercises[0].plannedSets[0].id,
    1_000,
  );
  execution = finishExecutedRest(execution);
  const readySession = {
    ...originalSnapshot,
    status: "readyToFinish" as const,
    execution,
  };
  await saveWorkoutStore({
    version: 2,
    templates: [template],
    sessions: [readySession],
  });

  const completed = await completeWorkoutSession(readySession.id, 2_000);
  const repeated = await completeWorkoutSession(readySession.id, 3_000);
  template = {
    ...template,
    name: "Push modifié",
    exercises: template.exercises.map((exercise) => ({
      ...exercise,
      name: "Bench récent",
      plannedSets: exercise.plannedSets.map((set) => ({
        ...set,
        weightKg: 90,
      })),
    })),
  };
  await saveWorkouts([template]);

  const stored = await loadWorkoutStore();
  expect(completed.completedAt).toBe(2_000);
  expect(repeated.completedAt).toBe(2_000);
  expect(stored.sessions).toHaveLength(1);
  expect(stored.sessions[0].completedAt).toBe(2_000);
  expect(stored.sessions[0].snapshot).toEqual(originalSnapshot.snapshot);
  expect(stored.sessions[0].snapshot.exercises[0].name).toBe("Bench");
  expect(stored.templates[0].name).toBe("Push modifié");
  expect(stored.templates[0].exercises[0].plannedSets[0].weightKg).toBe(90);
});

it("reopens a ready session when a new exercise is added", () => {
  const workout = addExercise(createWorkout("Push"), "Bench", 1, 30);
  const completedExercise = workout.exercises[0];
  let execution = startWorkoutExecution(workout, 1000);
  execution = startExecutedSetRest(
    execution,
    completedExercise.id,
    completedExercise.plannedSets[0].id,
    1000,
  );
  expect(execution.status).toBe("readyToFinish");
  const expanded = addExercise(workout, "Row", 1, 30);
  const reopened = addExerciseToExecution(execution, expanded.exercises[1]);
  expect(reopened.status).toBe("inProgress");
  expect(reopened.exercises[1].status).toBe("upcoming");
});

it("synchronizes session work values to the template", async () => {
  const template = addExercise(createWorkout("Push"), "Bench", 1, 30);
  const set = template.exercises[0].plannedSets[0];
  const sessionExecution = updateExecutedSet(
    startWorkoutExecution(template, 1000),
    template.exercises[0].id,
    set.id,
    "weightKg",
    80,
  );
  const withReps = updateExecutedSet(
    sessionExecution,
    template.exercises[0].id,
    set.id,
    "repetitions",
    8,
  );
  await saveWorkouts([{ ...template, execution: withReps }]);
  const store = await loadWorkoutStore();
  expect(store.templates[0].exercises[0].plannedSets[0]).toMatchObject({
    weightKg: 80,
    repetitions: 8,
  });
  expect(store.sessions[0].execution.exercises[0].sets[0]).toMatchObject({
    weightKg: 80,
    repetitions: 8,
  });
  expect(
    createWorkoutSession(store.templates[0], 2000).execution.exercises[0]
      .sets[0],
  ).toMatchObject({
    weightKg: 80,
    repetitions: 8,
  });
});

it("synchronizes propagated active-session values into the matching template IDs", async () => {
  const workout = addExercise(createWorkout("Push"), "Bench", 4, 30);
  const exercise = workout.exercises[0];
  const execution = startWorkoutExecution(workout, 1000);
  const setIds = setIdsFromSelection(
    exercise.plannedSets,
    exercise.plannedSets[1].id,
    true,
  );
  const next = {
    ...workout,
    exercises: [updatePlannedSetValues(exercise, setIds, "weightKg", 80)],
    execution: updateExecutedSets(
      execution,
      exercise.id,
      setIds,
      "weightKg",
      80,
    ),
  };
  await saveWorkouts([next]);
  const store = await loadWorkoutStore();
  const templateExercise = store.templates[0].exercises[0];
  const sessionExercise = store.sessions[0].execution.exercises[0];
  expect(templateExercise.plannedSets.map((set) => set.weightKg)).toEqual([
    null,
    80,
    80,
    80,
  ]);
  expect(sessionExercise.sets.map((set) => set.weightKg)).toEqual([
    null,
    80,
    80,
    80,
  ]);
  expect(templateExercise.plannedSets.map((set) => set.id)).toEqual(
    exercise.plannedSets.map((set) => set.id),
  );
  expect(sessionExercise.sets.map((set) => set.setId)).toEqual(
    exercise.plannedSets.map((set) => set.id),
  );
  expect(store.sessions[0].snapshot.exercises[0].plannedSets[1].weightKg).toBe(
    80,
  );
});

it("edits upcoming and performed values without changing execution state", () => {
  let workout = addExercise(createWorkout("Push"), "Bench", 1, 30);
  workout = addExercise(workout, "Row", 1, 30);
  const bench = workout.exercises[0];
  const row = workout.exercises[1];
  let execution = startWorkoutExecution(workout, 1000);
  execution = updateExecutedSet(
    execution,
    row.id,
    row.plannedSets[0].id,
    "weightKg",
    70,
  );
  execution = updateExecutedSet(
    execution,
    row.id,
    row.plannedSets[0].id,
    "repetitions",
    12,
  );
  execution = startExecutedSetRest(
    execution,
    bench.id,
    bench.plannedSets[0].id,
    1000,
  );
  execution = finishExecutedRest(execution);
  expect(execution.exercises.map((exercise) => exercise.status)).toEqual([
    "completed",
    "upcoming",
  ]);
  execution = updateExecutedSet(
    execution,
    row.id,
    row.plannedSets[0].id,
    "weightKg",
    72.5,
  );
  execution = updateExecutedSet(
    execution,
    bench.id,
    bench.plannedSets[0].id,
    "weightKg",
    82.5,
  );
  execution = updateExecutedSet(
    execution,
    bench.id,
    bench.plannedSets[0].id,
    "repetitions",
    8,
  );
  expect(execution.exercises[0].sets[0]).toMatchObject({
    status: "performed",
    weightKg: 82.5,
    repetitions: 8,
  });
  expect(execution.exercises[1].sets[0]).toMatchObject({
    status: "upcoming",
    weightKg: 72.5,
    repetitions: 12,
  });
});

it("synchronizes session structure to the template without sharing objects", async () => {
  const template = addExercise(createWorkout("Push"), "Bench", 1, 30);
  const sessionWorkout = addExercise(template, "Row", 1, 30);
  sessionWorkout.exercises[0] = addSet(sessionWorkout.exercises[0]);
  const addedExercise = sessionWorkout.exercises[1];
  let execution = startWorkoutExecution(template, 1000);
  execution = addExerciseToExecution(execution, addedExercise);
  execution = addSetToExecution(
    execution,
    template.exercises[0].id,
    sessionWorkout.exercises[0].plannedSets[1],
  );
  await saveWorkouts([{ ...sessionWorkout, execution }]);
  const store = await loadWorkoutStore();
  expect(store.templates[0].exercises).toHaveLength(2);
  expect(store.templates[0].exercises[0].plannedSets).toHaveLength(2);
  expect(store.sessions[0].execution.exercises).toHaveLength(2);
  expect(store.sessions[0].execution.exercises[0].sets).toHaveLength(2);
  expect(store.templates[0]).not.toBe(store.sessions[0].snapshot);
  expect(store.templates[0].exercises[0]).not.toBe(
    store.sessions[0].snapshot.exercises[0],
  );
});

it("synchronizes removed and reordered session structure to the template", async () => {
  let template = addExercise(createWorkout("Push"), "Bench", 1, 30);
  template = addExercise(template, "Row", 1, 30);
  let sessionWorkout = {
    ...template,
    exercises: reorder(template.exercises, 1, 0),
  };
  let execution = startWorkoutExecution(template, 1000);
  execution = {
    ...execution,
    exercises: sessionWorkout.exercises.map((exercise) =>
      execution.exercises.find((item) => item.exerciseId === exercise.id)!,
    ),
  };
  sessionWorkout = {
    ...sessionWorkout,
    exercises: sessionWorkout.exercises.filter(
      (exercise) => exercise.name !== "Bench",
    ),
  };
  execution = removeExecutedExercise(
    execution,
    template.exercises.find((exercise) => exercise.name === "Bench")!.id,
  );
  await saveWorkouts([{ ...sessionWorkout, execution }]);
  const store = await loadWorkoutStore();
  expect(store.templates[0].exercises).toHaveLength(1);
  expect(store.templates[0].exercises[0].name).toBe("Row");
  expect(store.templates[0].exercises[0].position).toBe(0);
  expect(store.sessions[0].execution.archivedExercises).toBeUndefined();
});

it("edits planned rest on upcoming and performed sets", () => {
  let workout = addExercise(createWorkout("Push"), "Bench", 1, 120);
  workout = addExercise(workout, "Row", 1, 120);
  const bench = workout.exercises[0];
  const row = workout.exercises[1];
  let execution = startWorkoutExecution(workout, 1000);
  execution = updateExecutedSet(
    execution,
    row.id,
    row.plannedSets[0].id,
    "restSeconds",
    150,
  );
  execution = startExecutedSetRest(
    execution,
    bench.id,
    bench.plannedSets[0].id,
    1000,
  );
  const restEndsAt = execution.exercises[0].sets[0].restEndsAt;
  execution = updateExecutedSet(
    execution,
    bench.id,
    bench.plannedSets[0].id,
    "restSeconds",
    150,
  );
  expect(execution.exercises[0].sets[0]).toMatchObject({
    status: "resting",
    restSeconds: 150,
    restEndsAt,
  });
  execution = finishExecutedRest(execution);
  execution = updateExecutedSet(
    execution,
    bench.id,
    bench.plannedSets[0].id,
    "restSeconds",
    180,
  );
  expect(execution.exercises[0].sets[0]).toMatchObject({
    status: "performed",
    restSeconds: 180,
    restEndsAt: undefined,
  });
});

it("reopens a ready session when a new set is added", () => {
  const workout = addExercise(createWorkout("Push"), "Bench", 1, 30);
  const bench = workout.exercises[0];
  let execution = startWorkoutExecution(workout, 1000);
  execution = startExecutedSetRest(
    execution,
    bench.id,
    bench.plannedSets[0].id,
    1000,
  );
  expect(execution.status).toBe("readyToFinish");
  const nextSet = addSet(bench).plannedSets[1];
  const reopened = addSetToExecution(execution, bench.id, nextSet);
  expect(reopened.status).toBe("inProgress");
  expect(reopened.exercises[0].sets).toHaveLength(2);
  expect(reopened.exercises[0].sets[1].status).toBe("upcoming");
});

it("keeps completed execution final and omits the final rest", async () => {
  let workout = addExercise(createWorkout("Push"), "Bench", 1, 30);
  workout = addExercise(workout, "Row", 1, 30);
  const bench = workout.exercises[0];
  const row = workout.exercises[1];
  let execution = startWorkoutExecution(workout, 1000);
  execution = startExecutedSetRest(
    execution,
    bench.id,
    bench.plannedSets[0].id,
    1000,
  );
  expect(execution.exercises[0].sets[0].status).toBe("resting");
  execution = finishExecutedRest(execution);
  expect(execution.exercises[1].sets[0].status).toBe("upcoming");
  execution = activateExecutedExercise(execution, row.id);
  execution = startExecutedSetRest(
    execution,
    row.id,
    row.plannedSets[0].id,
    1000,
  );
  expect(execution.status).toBe("readyToFinish");
  expect(execution.exercises[1].sets[0].status).toBe("performed");
  const completed = completeWorkoutExecution(execution, 2000);
  expect(completed.status).toBe("completed");
  expect(startWorkoutExecution({ ...workout, execution: completed })).toEqual(
    completed,
  );
  expect(activateExecutedExercise(completed, bench.id)).toEqual(completed);
  expect(
    removeExecutedUpcomingSet(completed, bench.id, bench.plannedSets[0].id),
  ).toEqual(completed);
  await saveWorkouts([{ ...workout, execution: completed }]);
  expect((await loadWorkouts())[0].execution).toEqual(completed);
});

it("marks an exercise without remaining sets complete without activating the next one", () => {
  let workout = addExercise(createWorkout("Push"), "Bench", 3, 30);
  workout = addExercise(workout, "Row", 1, 30);
  const bench = workout.exercises[0];
  let execution = startWorkoutExecution(workout, 1000);
  execution = {
    ...execution,
    exercises: execution.exercises.map((exercise) =>
      exercise.exerciseId === bench.id
        ? {
            ...exercise,
            status: "active",
            sets: exercise.sets.map((set, index) => ({
              ...set,
              status: index < 2 ? "performed" : "upcoming",
            })),
          }
        : { ...exercise, status: "upcoming" },
    ),
  };
  const next = removeExecutedUpcomingSet(
    execution,
    bench.id,
    bench.plannedSets[2].id,
  );
  expect(next.exercises[0].status).toBe("completed");
  expect(next.exercises[1].status).toBe("upcoming");
  expect(next.exercises[1].sets[0].status).toBe("upcoming");
});

it("stores independent sessions while keeping the template unchanged", async () => {
  const template = addExercise(createWorkout("Push"), "Bench", 1, 30);
  const sessionA = createWorkoutSession(template, 1000);
  const changedSnapshot = {
    ...sessionA.snapshot,
    exercises: sessionA.snapshot.exercises.map((exercise) => ({
      ...exercise,
      name: "Bench modifié",
    })),
  };
  await saveWorkoutStore({
    version: 2,
    templates: [template],
    sessions: [{ ...sessionA, snapshot: changedSnapshot }],
  });
  const store = await loadWorkoutStore();
  expect(store.templates[0]).toEqual(template);
  expect(store.sessions).toHaveLength(1);
  expect(store.sessions[0].snapshot.exercises[0].name).toBe("Bench modifié");
  expect(store.sessions[0].id).not.toBe(template.id);
});

it("migrates a legacy workout execution idempotently", async () => {
  const template = addExercise(createWorkout("Legacy"), "Squat", 1, 30);
  const execution = startWorkoutExecution(template, 1000);
  await saveWorkouts([{ ...template, execution }]);
  const first = await loadWorkoutStore();
  const second = await loadWorkoutStore();
  expect(first.version).toBe(2);
  expect(first.templates).toHaveLength(1);
  expect(first.sessions).toHaveLength(1);
  expect(second.sessions.map((session) => session.id)).toEqual(
    first.sessions.map((session) => session.id),
  );
  expect(second.templates[0]).toEqual(template);
  expect(second.sessions[0].snapshot.exercises[0]).not.toHaveProperty(
    "permanentNote",
  );
  expect(second.sessions[0].sessionNotes).toEqual({});
});

it("copies permanent notes into new session snapshots and starts with no session notes", () => {
  const workout = addExercise(createWorkout("Push"), "Bench", 1, 90);
  workout.exercises[0].permanentNote = "Banc position 4";
  const session = createWorkoutSession(workout, 1000);

  expect(session.snapshot.exercises[0].permanentNote).toBe("Banc position 4");
  expect(session.sessionNotes).toEqual({});
  expect(session.snapshot).not.toHaveProperty("sessionNotes");
});

it("synchronizes permanent notes but keeps session notes and old snapshots separate", async () => {
  const workout = addExercise(createWorkout("Push"), "Bench", 1, 90);
  workout.exercises[0].permanentNote = "Banc position 4";
  const session = createWorkoutSession(workout, 1000);
  await saveWorkouts([
    {
      ...workout,
      execution: session.execution,
      sessionNotes: { [workout.exercises[0].id]: "Épaule sensible" },
    },
  ]);

  const updated = {
    ...workout,
    exercises: workout.exercises.map((exercise) =>
      exercise.id === session.snapshot.exercises[0].id
        ? { ...exercise, permanentNote: "Banc position 5" }
        : exercise,
    ),
  };
  await saveWorkouts([
    {
      ...updated,
      execution: session.execution,
      sessionNotes: { [workout.exercises[0].id]: "Épaule sensible" },
    },
  ]);

  const activeStore = await loadWorkoutStore();
  expect(activeStore.templates[0].exercises[0].permanentNote).toBe(
    "Banc position 5",
  );
  expect(activeStore.sessions[0].snapshot.exercises[0].permanentNote).toBe(
    "Banc position 5",
  );
  expect(activeStore.sessions[0].sessionNotes).toEqual({
    [workout.exercises[0].id]: "Épaule sensible",
  });
  expect(activeStore.templates[0].exercises[0]).not.toHaveProperty(
    "sessionNotes",
  );

  const nextSession = createWorkoutSession(updated, 2000);
  expect(nextSession.snapshot.exercises[0].permanentNote).toBe(
    "Banc position 5",
  );
  expect(nextSession.sessionNotes).toEqual({});

  const completed = {
    ...session.execution,
    status: "completed" as const,
    completedAt: 3000,
  };
  await saveWorkouts([
    {
      ...updated,
      execution: completed,
      sessionNotes: {
        [workout.exercises[0].id]: "Épaule sensible",
      },
    },
  ]);
  const cleared = {
    ...updated,
    exercises: updated.exercises.map((exercise) => ({
      ...exercise,
      permanentNote: undefined,
    })),
  };
  await saveWorkouts([cleared]);
  const historical = await loadWorkoutStore();
  expect(historical.templates[0].exercises[0].permanentNote).toBeUndefined();
  expect(historical.sessions[0].snapshot.exercises[0].permanentNote).toBe(
    "Banc position 5",
  );
  expect(historical.sessions[0].sessionNotes).toEqual({
    [workout.exercises[0].id]: "Épaule sensible",
  });
});

it("detects an active session without counting completed history", () => {
  const template = createWorkout("Push");
  const session = createWorkoutSession(template, 1000);
  const completed = {
    ...session,
    status: "completed" as const,
    completedAt: 2000,
  };
  expect(
    hasActiveWorkoutSession({
      version: 2,
      templates: [template],
      sessions: [completed],
    }),
  ).toBe(false);
  expect(
    hasActiveWorkoutSession({
      version: 2,
      templates: [template],
      sessions: [session],
    }),
  ).toBe(true);
});

it("rejects a store containing two active sessions", async () => {
  const templateA = createWorkout("A");
  const templateB = createWorkout("B");
  const sessionA = createWorkoutSession(templateA, 1000);
  const sessionB = createWorkoutSession(templateB, 2000);
  await expect(
    saveWorkoutStore({
      version: 2,
      templates: [templateA, templateB],
      sessions: [sessionA, sessionB],
    }),
  ).rejects.toThrow("Une seule séance");
});

it("retains abandoned sessions without making them active or changing their template", async () => {
  const template = addExercise(createWorkout("Push"), "Bench", 2, 90);
  const session = createWorkoutSession(template, 1000);
  await saveWorkoutStore({
    version: 2,
    templates: [template],
    sessions: [session],
  });

  const abandoned = await abandonWorkoutSession(session.id, 2000);
  expect(abandoned).toMatchObject({
    id: session.id,
    templateId: template.id,
    status: "abandoned",
    abandonedAt: 2000,
    snapshot: session.snapshot,
    execution: session.execution,
  });
  const store = await loadWorkoutStore();
  expect(store.templates).toEqual([template]);
  expect(store.sessions).toEqual([abandoned]);
  expect(hasActiveWorkoutSession(store)).toBe(false);
  expect(await loadWorkouts()).toEqual([template]);

  const restarted = createWorkoutSession(template, 3000);
  await saveWorkoutStore({
    ...store,
    sessions: [...store.sessions, restarted],
  });
  const nextStore = await loadWorkoutStore();
  expect(hasActiveWorkoutSession(nextStore)).toBe(true);
  expect(nextStore.sessions.map((item) => item.id)).toEqual([
    session.id,
    restarted.id,
  ]);
});

it("does not allow abandoning a completed historical session", async () => {
  const template = createWorkout("Push");
  const session = createWorkoutSession(template, 1000);
  const completed = {
    ...session,
    status: "completed" as const,
    completedAt: 2000,
    execution: { ...session.execution, status: "completed" as const },
  };
  await saveWorkoutStore({
    version: 2,
    templates: [template],
    sessions: [completed],
  });
  await expect(abandonWorkoutSession(session.id, 3000)).rejects.toThrow(
    "Seule une séance active peut être abandonnée",
  );
  expect((await loadWorkoutStore()).sessions).toEqual([completed]);
});

it("keeps the localStorage fallback versioned", async () => {
  vi.stubGlobal("indexedDB", undefined);
  const template = createWorkout("Fallback");
  await saveWorkoutStore({ version: 2, templates: [template], sessions: [] });
  expect(
    JSON.parse(localStorage.getItem("sport-nutrition-workouts") ?? "{}"),
  ).toMatchObject({ version: 2 });
  expect((await loadWorkoutStore()).templates).toEqual([template]);
});
