import { IDBFactory } from "fake-indexeddb";
import {
  activateExecutedExercise,
  abandonWorkoutSession,
  addExercise,
  addExerciseToExecution,
  addSet,
  addSetToExecution,
  completeWorkoutExecution,
  createWorkout,
  createWorkoutSession,
  hasActiveWorkoutSession,
  finishExecutedRest,
  loadWorkouts,
  loadWorkoutStore,
  removeExecutedExercise,
  removeExecutedSet,
  removeExecutedUpcomingSet,
  reorder,
  saveWorkouts,
  saveWorkoutStore,
  skipExecutedExercise,
  startExecutedSetRest,
  startWorkoutExecution,
  type Workout,
  updateExecutedSet,
} from "./database";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());

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

it("uses the exercise default after deleting all sets, or 90 for a legacy empty exercise", () => {
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
