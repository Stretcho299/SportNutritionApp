export type PlannedSet = {
  id: string;
  position: number;
  weightKg: number;
  repetitions: number;
  restSeconds: number;
};
export type Exercise = {
  id: string;
  name: string;
  position: number;
  plannedSets: PlannedSet[];
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
export const addExercise = (w: Workout, name: string): Workout => ({
  ...w,
  exercises: [
    ...w.exercises,
    { id: id(), name, position: w.exercises.length, plannedSets: [] },
  ],
});
export const addSet = (
  e: Exercise,
  weightKg: number,
  repetitions: number,
  restSeconds = defaultRestSeconds,
): Exercise => ({
  ...e,
  plannedSets: [
    ...e.plannedSets,
    {
      id: id(),
      position: e.plannedSets.length,
      weightKg,
      repetitions,
      restSeconds,
    },
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
