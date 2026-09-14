import { IDBFactory } from "fake-indexeddb";
import {
  addExercise,
  addSet,
  createWorkout,
  loadWorkouts,
  saveWorkouts,
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
