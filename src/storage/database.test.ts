import { IDBFactory } from "fake-indexeddb";
import {
  activateExecutedExercise,
  addExercise,
  addExerciseToExecution,
  addSet,
  completeWorkoutExecution,
  createWorkout,
  createWorkoutSession,
  hasActiveWorkoutSession,
  finishExecutedRest,
  loadWorkouts,
  loadWorkoutStore,
  removeExecutedUpcomingSet,
  saveWorkouts,
  saveWorkoutStore,
  skipExecutedExercise,
  startExecutedSetRest,
  startWorkoutExecution,
  type Workout,
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
  expect(execution.exercises[1].sets[0].status).toBe("active");
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

it("does not complete an exercise or activate the next one when its last upcoming set is removed", () => {
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
  expect(next.exercises[0].status).toBe("active");
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

it("keeps the localStorage fallback versioned", async () => {
  vi.stubGlobal("indexedDB", undefined);
  const template = createWorkout("Fallback");
  await saveWorkoutStore({ version: 2, templates: [template], sessions: [] });
  expect(
    JSON.parse(localStorage.getItem("sport-nutrition-workouts") ?? "{}"),
  ).toMatchObject({ version: 2 });
  expect((await loadWorkoutStore()).templates).toEqual([template]);
});
