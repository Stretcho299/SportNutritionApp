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
  permanentNote?: string;
};
export type WorkoutTemplate = {
  id: string;
  name: string;
  exercises: Exercise[];
};

// Compatibility view used by the existing UI while storage is split.
export type Workout = WorkoutTemplate & {
  execution?: WorkoutExecution;
  sessionNotes?: Record<string, string>;
};

export type WorkoutSession = {
  id: string;
  templateId: string;
  templateName: string;
  startedAt: number;
  completedAt: number | null;
  status: WorkoutExecution["status"] | "abandoned";
  abandonedAt?: number;
  sessionNotes?: Record<string, string>;
  snapshot: WorkoutTemplate;
  execution: WorkoutExecution;
};

export type WorkoutStore = {
  version: 2;
  templates: WorkoutTemplate[];
  sessions: WorkoutSession[];
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
    const request = indexedDB.open("sport-nutrition", 2);
    request.onupgradeneeded = () => request.result.createObjectStore("data");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
const emptyStore = (): WorkoutStore => ({
  version: 2,
  templates: [],
  sessions: [],
});

const clone = <T>(value: T): T =>
  typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));

const migrateStore = (raw: unknown): WorkoutStore => {
  if (raw && typeof raw === "object" && (raw as WorkoutStore).version === 2) {
    const store = raw as WorkoutStore;
    return {
      version: 2,
      templates: store.templates ?? [],
      sessions: store.sessions ?? [],
    };
  }
  if (!Array.isArray(raw)) return emptyStore();
  const templates: WorkoutTemplate[] = [];
  const sessions: WorkoutSession[] = [];
  for (const legacy of raw as Workout[]) {
    const template: WorkoutTemplate = {
      id: legacy.id,
      name: legacy.name,
      exercises: legacy.exercises,
    };
    const execution = legacy.execution;
    templates.push(template);
    if (execution) {
      const sessionId =
        execution.sessionId ?? `legacy-${template.id}-${execution.startedAt}`;
      const migratedExecution = { ...execution, sessionId };
      sessions.push({
        id: sessionId,
        templateId: template.id,
        templateName: template.name,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt ?? null,
        status: execution.status,
        snapshot: clone(template),
        sessionNotes: {},
        execution: migratedExecution,
      });
    }
  }
  return { version: 2, templates, sessions };
};

const readStoredValue = async (): Promise<unknown> => {
  if (!globalThis.indexedDB)
    return JSON.parse(localStorage.getItem(key) ?? "[]");
  const db = await open();
  return new Promise((resolve) => {
    const r = db.transaction("data").objectStore("data").get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => resolve(undefined);
  });
};

export async function loadWorkoutStore(): Promise<WorkoutStore> {
  const raw = await readStoredValue();
  const store = migrateStore(raw);
  // Persist the migrated envelope once; subsequent loads are idempotent.
  if (raw && Array.isArray(raw)) await saveWorkoutStore(store);
  return store;
}

export async function saveWorkoutStore(store: WorkoutStore) {
  if (
    store.sessions.filter(
      (session) =>
        session.status === "inProgress" || session.status === "readyToFinish",
    ).length > 1
  ) {
    throw new Error("Une seule séance peut être active à la fois");
  }
  const normalized: WorkoutStore = {
    version: 2,
    templates: store.templates,
    sessions: store.sessions,
  };
  if (!globalThis.indexedDB) {
    localStorage.setItem(key, JSON.stringify(normalized));
    return;
  }
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("data", "readwrite");
    transaction.objectStore("data").put(normalized, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function loadWorkouts(): Promise<Workout[]> {
  const store = await loadWorkoutStore();
  return store.templates.map((template) => {
    const latest = store.sessions
      .filter(
        (session) =>
          session.templateId === template.id && session.status !== "abandoned",
      )
      .sort((a, b) => b.startedAt - a.startedAt)[0];
    if (!latest) return template;
    const execution = { ...latest.execution };
    delete execution.sessionId;
    return {
      ...template,
      execution,
      sessionNotes: latest.sessionNotes ?? {},
    };
  });
}

const mergeSessionSnapshot = (
  previous: WorkoutTemplate,
  current: Workout,
): WorkoutTemplate => ({
  ...previous,
  exercises: current.exercises.map((exercise) => {
    const previousExercise = previous.exercises.find(
      (item) => item.id === exercise.id,
    );
    if (!previousExercise) return clone(exercise);
    return {
      ...exercise,
      plannedSets: exercise.plannedSets.map((set) => {
        const previousSet = previousExercise.plannedSets.find(
          (item) => item.id === set.id,
        );
        return previousSet
          ? {
              ...set,
              weightKg: previousSet.weightKg,
              repetitions: previousSet.repetitions,
              restSeconds: previousSet.restSeconds,
            }
          : set;
      }),
    };
  }),
});

const syncTemplateWorkValues = (
  previous: WorkoutTemplate,
  execution: WorkoutExecution,
): WorkoutTemplate => ({
  ...previous,
  exercises: previous.exercises.map((exercise) => {
    const executedExercise = execution.exercises.find(
      (item) => item.exerciseId === exercise.id,
    );
    if (!executedExercise) return exercise;
    return {
      ...exercise,
      plannedSets: exercise.plannedSets.map((set) => {
        const executedSet = executedExercise.sets.find(
          (item) => item.setId === set.id,
        );
        return executedSet
          ? {
              ...set,
              weightKg: executedSet.weightKg,
              repetitions: executedSet.repetitions,
              restSeconds: executedSet.restSeconds,
            }
          : set;
      }),
    };
  }),
});

async function persistWorkouts(workouts: Workout[]) {
  const existing = globalThis.indexedDB
    ? await loadWorkoutStore()
    : migrateStore(JSON.parse(localStorage.getItem(key) ?? "[]"));
  const templates = workouts.map((workout) => {
    const template: WorkoutTemplate = {
      id: workout.id,
      name: workout.name,
      exercises: workout.exercises,
    };
    return workout.execution
      ? syncTemplateWorkValues(template, workout.execution)
      : template;
  });
  const sessions = [...existing.sessions];
  for (const workout of workouts) {
    if (!workout.execution) continue;
    const sessionId =
      workout.execution.sessionId ??
      `compat-${workout.id}-${workout.execution.startedAt}`;
    const index = sessions.findIndex((session) => session.id === sessionId);
    if (
      index >= 0 &&
      (sessions[index].status === "completed" ||
        sessions[index].status === "abandoned")
    )
      continue;
    const session: WorkoutSession = {
      id: sessionId,
      templateId: workout.id,
      templateName: workout.name,
      startedAt: workout.execution.startedAt,
      completedAt: workout.execution.completedAt ?? null,
      status: workout.execution.status,
      snapshot:
        index >= 0
          ? mergeSessionSnapshot(sessions[index].snapshot, workout)
          : clone({
              id: workout.id,
              name: workout.name,
              exercises: workout.exercises,
            }),
      execution: { ...normalizeExecution(workout.execution), sessionId },
      sessionNotes:
        workout.sessionNotes ??
        (index >= 0 ? sessions[index].sessionNotes : undefined) ??
        {},
    };
    if (index >= 0) sessions[index] = session;
    else sessions.push(session);
  }
  const nextStore = { version: 2 as const, templates, sessions };
  if (!globalThis.indexedDB) {
    await saveWorkoutStore(nextStore);
    return;
  }
  await saveWorkoutStore(nextStore);
}

let saveWorkoutsQueue: Promise<void> = Promise.resolve();

export function saveWorkouts(workouts: Workout[]) {
  if (!globalThis.indexedDB) return persistWorkouts(workouts);
  saveWorkoutsQueue = saveWorkoutsQueue.then(() => persistWorkouts(workouts));
  return saveWorkoutsQueue;
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
  restDurationSeconds?: number;
};
export type ExecutedExercise = {
  exerciseId: string;
  status: ExerciseExecutionStatus;
  sets: ExecutedSet[];
};
export type WorkoutExecution = {
  sessionId?: string;
  status: "inProgress" | "readyToFinish" | "completed";
  startedAt: number;
  completedAt?: number;
  exercises: ExecutedExercise[];
  archivedExercises?: ExecutedExercise[];
};
const isTerminalSet = (set: ExecutedSet) =>
  set.status === "performed" || set.status === "skipped";

const normalizeExecution = (execution: WorkoutExecution): WorkoutExecution => {
  if (execution.status === "completed") return execution;
  let restingSeen = false;
  const exercises: ExecutedExercise[] = execution.exercises.map((exercise) => {
    const sets = exercise.sets.map((set) => {
      if (set.status !== "resting") return set;
      if (restingSeen)
        return { ...set, status: "active" as const, restEndsAt: undefined };
      restingSeen = true;
      return set;
    });
    const completed = sets.length === 0 || sets.every(isTerminalSet);
    return {
      ...exercise,
      sets,
      status: completed
        ? "completed"
        : sets.some(
              (set) =>
                set.status === "active" ||
                set.status === "resting" ||
                set.status === "performed",
            )
          ? "active"
          : "upcoming",
    };
  });
  return {
    ...execution,
    status: exercises.every((exercise) => exercise.status === "completed")
      ? "readyToFinish"
      : "inProgress",
    exercises,
  };
};

export const activateExecutedExercise = (
  execution: WorkoutExecution,
  exerciseId: string,
): WorkoutExecution => {
  if (execution.status !== "inProgress") return execution;
  const normalized = normalizeExecution(execution);
  if (normalized.status !== "inProgress") return normalized;
  return {
    ...normalized,
    exercises: normalized.exercises.map((exercise) => {
      if (exercise.exerciseId !== exerciseId || exercise.status === "completed")
        return exercise;
      if (
        exercise.sets.some(
          (set) => set.status === "active" || set.status === "resting",
        )
      )
        return { ...exercise, status: "active" };
      const next = exercise.sets.find((set) => set.status === "upcoming");
      return next
        ? {
            ...exercise,
            status: "active",
            sets: exercise.sets.map((set) =>
              set.setId === next.setId ? { ...set, status: "active" } : set,
            ),
          }
        : exercise;
    }),
  };
};

export const startWorkoutExecution = (
  workout: Workout,
  now = Date.now(),
  initialExerciseId?: string,
): WorkoutExecution => {
  if (workout.execution) return workout.execution;
  const execution: WorkoutExecution = {
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
  };
  const initialExercise =
    execution.exercises.find((item) => item.exerciseId === initialExerciseId) ??
    execution.exercises[0];
  return initialExercise
    ? activateExecutedExercise(execution, initialExercise.exerciseId)
    : normalizeExecution(execution);
};

export const createWorkoutSession = (
  template: WorkoutTemplate,
  now = Date.now(),
  initialExerciseId?: string,
): WorkoutSession => {
  const sessionId = id();
  const snapshot: WorkoutTemplate = {
    id: template.id,
    name: template.name,
    exercises: clone(template.exercises),
  };
  const execution = {
    ...startWorkoutExecution(template, now, initialExerciseId),
    sessionId,
  };
  return {
    id: sessionId,
    templateId: template.id,
    templateName: template.name,
    startedAt: now,
    completedAt: null,
    status: execution.status,
    snapshot,
    sessionNotes: {},
    execution,
  };
};

export const hasActiveWorkoutSession = (store: WorkoutStore): boolean =>
  store.sessions.some(
    (session) =>
      session.status === "inProgress" || session.status === "readyToFinish",
  );

export async function abandonWorkoutSession(
  sessionId: string,
  now = Date.now(),
): Promise<WorkoutSession> {
  await saveWorkoutsQueue;
  const store = await loadWorkoutStore();
  const session = store.sessions.find((item) => item.id === sessionId);
  if (
    !session ||
    (session.status !== "inProgress" && session.status !== "readyToFinish")
  )
    throw new Error("Seule une séance active peut être abandonnée");
  const abandoned: WorkoutSession = {
    ...session,
    status: "abandoned",
    abandonedAt: now,
  };
  await saveWorkoutStore({
    ...store,
    sessions: store.sessions.map((item) =>
      item.id === sessionId ? abandoned : item,
    ),
  });
  return abandoned;
}

export const addExerciseToExecution = (
  execution: WorkoutExecution,
  exercise: Exercise,
): WorkoutExecution => {
  if (execution.status === "completed") return execution;
  if (execution.exercises.some((item) => item.exerciseId === exercise.id))
    return execution;
  return normalizeExecution({
    ...execution,
    exercises: [
      ...execution.exercises,
      {
        exerciseId: exercise.id,
        status: "upcoming",
        sets: sort(exercise.plannedSets).map((set) => ({
          setId: set.id,
          status: "upcoming",
          repetitions: set.repetitions,
          weightKg: set.weightKg,
          restSeconds: set.restSeconds,
        })),
      },
    ],
  });
};

export const updateExecutedSet = (
  execution: WorkoutExecution,
  exerciseId: string,
  setId: string,
  field: "repetitions" | "weightKg" | "restSeconds",
  value: number | null,
): WorkoutExecution => {
  if (execution.status === "completed") return execution;
  return {
    ...execution,
    exercises: execution.exercises.map((exercise) =>
      exercise.exerciseId !== exerciseId
        ? exercise
        : {
            ...exercise,
            sets: exercise.sets.map((set) =>
              set.setId !== setId ? set : { ...set, [field]: value },
            ),
          },
    ),
  };
};

export const addSetToExecution = (
  execution: WorkoutExecution,
  exerciseId: string,
  set: PlannedSet,
): WorkoutExecution => {
  if (execution.status === "completed") return execution;
  return normalizeExecution({
    ...execution,
    status: "inProgress",
    exercises: execution.exercises.map((exercise) =>
      exercise.exerciseId !== exerciseId
        ? exercise
        : {
            ...exercise,
            status:
              exercise.status === "completed" ? "upcoming" : exercise.status,
            sets: [
              ...exercise.sets,
              {
                setId: set.id,
                status: "upcoming",
                repetitions: set.repetitions,
                weightKg: set.weightKg,
                restSeconds: set.restSeconds,
              },
            ],
          },
    ),
  });
};

export const startExecutedSetRest = (
  execution: WorkoutExecution,
  exerciseId: string,
  setId: string,
  now = Date.now(),
): WorkoutExecution => {
  if (execution.status !== "inProgress") return execution;
  if (
    execution.exercises.some((exercise) =>
      exercise.sets.some((set) => set.status === "resting"),
    )
  )
    return execution;
  const target = execution.exercises
    .find((exercise) => exercise.exerciseId === exerciseId)
    ?.sets.find((set) => set.setId === setId);
  if (target?.status !== "active") return execution;
  const remaining = execution.exercises.some((exercise) =>
    exercise.sets.some((set) =>
      set.setId === setId && exercise.exerciseId === exerciseId
        ? false
        : !isTerminalSet(set),
    ),
  );
  if (!remaining)
    return normalizeExecution({
      ...execution,
      exercises: execution.exercises.map((exercise) =>
        exercise.exerciseId !== exerciseId
          ? exercise
          : {
              ...exercise,
              sets: exercise.sets.map((set) =>
                set.setId === setId
                  ? { ...set, status: "performed", restEndsAt: undefined }
                  : set,
              ),
            },
      ),
    });
  return normalizeExecution({
    ...execution,
    exercises: execution.exercises.map((exercise) =>
      exercise.exerciseId !== exerciseId
        ? exercise
        : {
            ...exercise,
            sets: exercise.sets.map((set) =>
              set.setId === setId
                ? {
                    ...set,
                    status: "resting",
                    restEndsAt: now + set.restSeconds * 1000,
                    restDurationSeconds: set.restSeconds,
                  }
                : set,
            ),
          },
    ),
  });
};

export const finishExecutedRest = (
  execution: WorkoutExecution,
): WorkoutExecution => {
  if (execution.status !== "inProgress") return execution;
  let current = "";
  const settled = normalizeExecution({
    ...execution,
    exercises: execution.exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) => {
        if (set.status !== "resting") return set;
        current = exercise.exerciseId;
        return { ...set, status: "performed", restEndsAt: undefined };
      }),
    })),
  });
  if (!current) return execution;
  const currentExercise = settled.exercises.find(
    (exercise) => exercise.exerciseId === current,
  )!;
  return currentExercise.status === "completed"
    ? settled
    : activateExecutedExercise(settled, current);
};

export const skipExecutedExercise = (
  execution: WorkoutExecution,
  exerciseId: string,
): WorkoutExecution => {
  if (execution.status !== "inProgress") return execution;
  const target = execution.exercises.find(
    (exercise) => exercise.exerciseId === exerciseId,
  );
  if (!target || target.status === "completed") return execution;
  const skipped = normalizeExecution({
    ...execution,
    exercises: execution.exercises.map((exercise) =>
      exercise.exerciseId !== exerciseId
        ? exercise
        : {
            ...exercise,
            sets: exercise.sets.map((set) =>
              set.status === "upcoming" || set.status === "active"
                ? { ...set, status: "skipped", restEndsAt: undefined }
                : set.status === "resting"
                  ? { ...set, status: "performed", restEndsAt: undefined }
                  : set,
            ),
          },
    ),
  });
  return skipped;
};

export const removeExecutedSet = (
  execution: WorkoutExecution,
  exerciseId: string,
  setId: string,
): WorkoutExecution => {
  if (execution.status !== "inProgress") return execution;
  const target = execution.exercises
    .find((exercise) => exercise.exerciseId === exerciseId)
    ?.sets.find((set) => set.setId === setId);
  if (!target || isTerminalSet(target)) return execution;
  return normalizeExecution({
    ...execution,
    exercises: execution.exercises.map((exercise) =>
      exercise.exerciseId !== exerciseId
        ? exercise
        : {
            ...exercise,
            sets: exercise.sets.filter((set) => set.setId !== setId),
          },
    ),
  });
};

export const removeExecutedUpcomingSet = removeExecutedSet;

export const removeExecutedExercise = (
  execution: WorkoutExecution,
  exerciseId: string,
): WorkoutExecution => {
  if (execution.status !== "inProgress") return execution;
  const target = execution.exercises.find(
    (exercise) => exercise.exerciseId === exerciseId,
  );
  if (!target) return execution;
  const performed = target.sets.filter(isTerminalSet);
  return normalizeExecution({
    ...execution,
    exercises: execution.exercises.filter(
      (exercise) => exercise.exerciseId !== exerciseId,
    ),
    archivedExercises: performed.length
      ? [
          ...(execution.archivedExercises ?? []),
          { ...target, status: "completed", sets: performed },
        ]
      : execution.archivedExercises,
  });
};

export const completeWorkoutExecution = (
  execution: WorkoutExecution,
  now = Date.now(),
): WorkoutExecution =>
  execution.status === "readyToFinish"
    ? { ...execution, status: "completed", completedAt: now }
    : execution;
