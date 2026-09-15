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
export type Workout = {
  id: string;
  name: string;
  exercises: Exercise[];
  execution?: WorkoutExecution;
};
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
export type SetExecutionStatus =
  "upcoming" | "active" | "resting" | "performed" | "skipped";
export type ExerciseExecutionStatus = "upcoming" | "active" | "completed";
export type ExecutedSet = {
  setId: string;
  status: SetExecutionStatus;
  repetitions: number | null;
  weightKg: number | null;
  restSeconds: number;
  restEndsAt?: number;
};
export type ExecutedExercise = {
  exerciseId: string;
  status: ExerciseExecutionStatus;
  sets: ExecutedSet[];
};
export type WorkoutExecution = {
  status: "inProgress" | "readyToFinish" | "completed";
  startedAt: number;
  completedAt?: number;
  exercises: ExecutedExercise[];
};
const activateNext = (execution: WorkoutExecution): WorkoutExecution => {
  const exercises = execution.exercises.map((exercise) => ({
    ...exercise,
    sets: exercise.sets.map((set) => ({ ...set, restEndsAt: undefined })),
  }));
  for (const exercise of exercises) {
    if (exercise.status === "completed") continue;
    const next = exercise.sets.find((set) => set.status === "upcoming");
    if (next) {
      exercise.status = "active";
      next.status = "active";
      return { ...execution, status: "inProgress", exercises };
    }
    exercise.status = "completed";
  }
  return { ...execution, status: "readyToFinish", exercises };
};
export const startWorkoutExecution = (
  workout: Workout,
  now = Date.now(),
): WorkoutExecution =>
  activateNext({
    status: "inProgress",
    startedAt: now,
    exercises: sort(workout.exercises).map((exercise) => ({
      exerciseId: exercise.id,
      status: "upcoming",
      sets: sort(exercise.plannedSets).map((set) => ({
        setId: set.id,
        status: "upcoming",
        repetitions: set.repetitions,
        weightKg: set.weightKg,
        restSeconds: set.restSeconds,
      })),
    })),
  });
export const updateExecutedSet = (
  execution: WorkoutExecution,
  exerciseId: string,
  setId: string,
  field: "repetitions" | "weightKg" | "restSeconds",
  value: number | null,
): WorkoutExecution => ({
  ...execution,
  exercises: execution.exercises.map((exercise) =>
    exercise.exerciseId !== exerciseId
      ? exercise
      : {
          ...exercise,
          sets: exercise.sets.map((set) =>
            set.setId !== setId || set.status !== "active"
              ? set
              : { ...set, [field]: value },
          ),
        },
  ),
});
export const startExecutedSetRest = (
  execution: WorkoutExecution,
  exerciseId: string,
  setId: string,
  now = Date.now(),
): WorkoutExecution => {
  const remaining = execution.exercises.some((exercise) =>
    exercise.exerciseId !== exerciseId
      ? exercise.sets.some(
          (set) => set.status === "upcoming" || set.status === "active",
        )
      : exercise.sets.some(
          (set) =>
            set.setId !== setId &&
            (set.status === "upcoming" || set.status === "active"),
        ),
  );
  if (!remaining) {
    const completed: WorkoutExecution = {
      ...execution,
      exercises: execution.exercises.map((exercise) =>
        exercise.exerciseId !== exerciseId
          ? exercise
          : {
              ...exercise,
              status: "completed",
              sets: exercise.sets.map((set) =>
                set.setId === setId
                  ? { ...set, status: "performed", restEndsAt: undefined }
                  : set,
              ),
            },
      ),
    };
    return { ...completed, status: "readyToFinish" };
  }
  return {
    ...execution,
    exercises: execution.exercises.map((exercise) =>
      exercise.exerciseId !== exerciseId
        ? exercise
        : {
            ...exercise,
            sets: exercise.sets.map((set) =>
              set.setId === setId && set.status === "active"
                ? {
                    ...set,
                    status: "resting",
                    restEndsAt: now + set.restSeconds * 1000,
                  }
                : set,
            ),
          },
    ),
  };
};
export const finishExecutedRest = (
  execution: WorkoutExecution,
): WorkoutExecution => {
  let current = "";
  const settled: WorkoutExecution = {
    ...execution,
    exercises: execution.exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) => {
        if (set.status !== "resting") return set;
        current = exercise.exerciseId;
        return { ...set, status: "performed", restEndsAt: undefined };
      }),
    })),
  };
  if (!current) return execution;
  const same = settled.exercises.find(
    (exercise) => exercise.exerciseId === current,
  )!;
  const next = same.sets.find((set) => set.status === "upcoming");
  if (next) {
    next.status = "active";
    same.status = "active";
    return settled;
  }
  same.status = "completed";
  return activateNext(settled);
};
export const skipExecutedExercise = (
  execution: WorkoutExecution,
  exerciseId: string,
): WorkoutExecution => {
  const skipped: WorkoutExecution = {
    ...execution,
    exercises: execution.exercises.map((exercise) =>
      exercise.exerciseId !== exerciseId
        ? exercise
        : {
            ...exercise,
            status: "completed",
            sets: exercise.sets.map((set) =>
              set.status === "upcoming" || set.status === "active"
                ? { ...set, status: "skipped", restEndsAt: undefined }
                : set,
            ),
          },
    ),
  };
  return activateNext(skipped);
};
