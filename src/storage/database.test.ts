import { IDBFactory } from "fake-indexeddb";
import {
  activateExecutedExercise,
  addExercise,
  addExerciseToExecution,
  addSet,
  completeWorkoutExecution,
  createWorkout,
  finishExecutedRest,
  loadWorkouts,
  removeExecutedUpcomingSet,
  saveWorkouts,
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
