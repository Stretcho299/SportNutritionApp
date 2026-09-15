export type PlannedSet = {
  id: string;
  position: number;
  weightKg: number | null;
  repetitions: number | null;
  restSeconds: number;
};
export type Exercise = {
  id: string;
  name: string;
  position: number;
  plannedSets: PlannedSet[];
  defaultRestSeconds?: number;
};
export type Workout = { id: string; name: string; exercises: Exercise[] };
export const defaultRestSeconds = 90;
const key = "sport-nutrition-workouts";
const id = () =>
  globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
export const sort = <T extends { position: number }>(items: T[]) =>
  [...items].sort((a, b) => a.position - b.position);
export const createWorkout = (name: string): Workout => ({
  id: id(),
  name,
  exercises: [],
});
const blankSet = (position: number, restSeconds: number): PlannedSet => ({
  id: id(),
  position,
  weightKg: null,
  repetitions: null,
  restSeconds,
});
export const addExercise = (
  w: Workout,
  name: string,
  initialSetCount = 1,
  restSeconds = defaultRestSeconds,
): Workout => {
  if (!Number.isSafeInteger(initialSetCount) || initialSetCount <= 0)
    throw new RangeError(
      "Le nombre de séries doit être un entier strictement positif.",
    );
  return {
    ...w,
    exercises: [
      ...w.exercises,
      {
        id: id(),
        name,
        position: w.exercises.length,
        defaultRestSeconds: restSeconds,
        plannedSets: Array.from({ length: initialSetCount }, (_, position) =>
          blankSet(position, restSeconds),
        ),
      },
    ],
  };
};
// Prefer the last series in the displayed order, including an explicit zero rest.
// The exercise default survives deletion of all its sets; legacy exercises need no migration.
export const addSet = (e: Exercise): Exercise => ({
  ...e,
  plannedSets: [
    ...e.plannedSets,
    blankSet(
      e.plannedSets.length,
      sort(e.plannedSets).at(-1)?.restSeconds ??
        e.defaultRestSeconds ??
        defaultRestSeconds,
    ),
  ],
});
export const reorder = <T extends { position: number }>(
  items: T[],
  from: number,
  to: number,
) => {
  const next = sort(items);
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next.map((x, position) => ({ ...x, position }));
};
const open = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("sport-nutrition", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("data");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
export async function loadWorkouts(): Promise<Workout[]> {
  if (!globalThis.indexedDB)
    return JSON.parse(localStorage.getItem(key) ?? "[]");
  const db = await open();
  return new Promise((resolve) => {
    const r = db.transaction("data").objectStore("data").get(key);
    r.onsuccess = () => resolve(r.result ?? []);
    r.onerror = () => resolve([]);
  });
}
export async function saveWorkouts(workouts: Workout[]) {
  if (!globalThis.indexedDB) {
    localStorage.setItem(key, JSON.stringify(workouts));
    return;
  }
  const db = await open();
  db.transaction("data", "readwrite").objectStore("data").put(workouts, key);
}
export const __storageKey = key;
