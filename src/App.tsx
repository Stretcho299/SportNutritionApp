import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import "./redesign-v2.css";
import { Icon } from "./Icon";
import { WorkoutProgress } from "./WorkoutProgress";
import {
  ConfirmationDialog,
  type ConfirmationRequest,
} from "./ConfirmationDialog";
import { SetValuePicker } from "./SetValuePicker";
import { BottomNavigation } from "./BottomNavigation";
import { BottomSheet, bottomSheetCloseDuration } from "./BottomSheet";
import { ExerciseNavigator } from "./ExerciseNavigator";
import { pickerValues } from "./pickerValues";
import {
  activateExecutedExercise,
  addSetToExecution,
  addExercise,
  addExerciseToExecution,
  addSet,
  completeWorkoutExecution,
  createWorkout,
  defaultRestSeconds,
  finishExecutedRest,
  loadWorkoutStore,
  type WorkoutStore,
  removeExecutedExercise,
  removeExecutedSet,
  reorder,
  saveWorkouts,
  skipExecutedExercise,
  sort,
  startExecutedSetRest,
  createWorkoutSession,
  updateExecutedSet,
  type ExecutedSet,
  type WorkoutExecution,
  type Workout,
} from "./storage/database";
type Screen = "list" | "workouts" | "preview" | "detail";
type Dialog =
  | null
  | "workout"
  | "exercise"
  | "renameWorkout"
  | "renameExercise"
  | "addMenu"
  | "organizeMenu"
  | "reorder";
export default function App() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [screen, setScreen] = useState<Screen>("list");
  const [workoutId, setWorkoutId] = useState("");
  const [exerciseId, setExerciseId] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [dialogClosing, setDialogClosing] = useState(false);
  const [name, setName] = useState("");
  const [initialSetCount, setInitialSetCount] = useState("1");
  const [rest, setRest] = useState(String(defaultRestSeconds));
  const [clock, setClock] = useState(Date.now);
  const [confirmation, setConfirmation] = useState<ConfirmationRequest | null>(
    null,
  );
  const [exerciseTransition, setExerciseTransition] = useState<
    "none" | "next" | "previous"
  >("none");
  const [outgoingExerciseVisual, setOutgoingExerciseVisual] = useState<{
    name: string;
    plannedSetCount: number;
  } | null>(null);
  const [screenTransition, setScreenTransition] = useState<"forward" | "back">(
    "forward",
  );
  const exerciseTransitionTimeout = useRef<number | undefined>(undefined);
  const dialogCloseTimeout = useRef<number | undefined>(undefined);
  const navigate = (next: Screen, direction: "forward" | "back") => {
    setScreenTransition(direction);
    setScreen(next);
  };
  useEffect(() => {
    void loadWorkoutStore().then((store: WorkoutStore) => {
      const active = store.sessions
        .filter((session) => session.status !== "completed")
        .sort((a, b) => b.startedAt - a.startedAt);
      setWorkouts(
        store.templates.map((template) => {
          const session = active.find(
            (item) => item.templateId === template.id,
          );
          return session
            ? {
                ...session.snapshot,
                exercises: session.snapshot.exercises.map((exercise) => {
                  const templateExercise = template.exercises.find(
                    (item) => item.id === exercise.id,
                  );
                  return templateExercise
                    ? {
                        ...exercise,
                        plannedSets: exercise.plannedSets.map((set) => {
                          const templateSet = templateExercise.plannedSets.find(
                            (item) => item.id === set.id,
                          );
                          return templateSet
                            ? {
                                ...set,
                                weightKg: templateSet.weightKg,
                                repetitions: templateSet.repetitions,
                                restSeconds: templateSet.restSeconds,
                              }
                            : set;
                        }),
                      }
                    : exercise;
                }),
                execution: session.execution,
              }
            : template;
        }),
      );
    });
  }, []);
  const update = useCallback((next: Workout[]) => {
    setWorkouts(next);
    void saveWorkouts(next);
  }, []);
  const workout = workouts.find((w) => w.id === workoutId);
  const exercise = workout?.exercises.find((e) => e.id === exerciseId);
  const execution = workout?.execution;
  const executionExercise = (id: string) =>
    execution?.exercises.find((item) => item.exerciseId === id);
  const executionSet = (id: string): ExecutedSet | undefined =>
    executionExercise(exercise?.id ?? "")?.sets.find(
      (item) => item.setId === id,
    );
  const restingExecutionExercise = execution?.exercises.find((item) =>
    item.sets.some((set) => set.status === "resting"),
  );
  const restingSet = restingExecutionExercise?.sets.find(
    (item) => item.status === "resting",
  );
  const restRemaining = restingSet?.restEndsAt
    ? Math.max(0, Math.ceil((restingSet.restEndsAt - clock) / 1000))
    : 0;
  const updateExecution = useCallback(
    (next: WorkoutExecution) =>
      update(
        workouts.map((w) =>
          w.id === workoutId ? { ...w, execution: next } : w,
        ),
      ),
    [update, workoutId, workouts],
  );
  const startExecution = (initialExerciseId = exerciseId) => {
    if (!workout || workout.execution) return;
    if (
      workouts.some(
        (item) =>
          item.execution &&
          (item.execution.status === "inProgress" ||
            item.execution.status === "readyToFinish"),
      )
    )
      return;
    updateExecution(
      createWorkoutSession(workout, undefined, initialExerciseId).execution,
    );
  };
  const startRest = (targetExerciseId: string, targetSetId: string) => {
    if (!execution) return;
    const currentSet = execution.exercises
      .find((item) => item.exerciseId === targetExerciseId)
      ?.sets.find((item) => item.setId === targetSetId);
    const immediateBase =
      currentSet?.status === "upcoming"
        ? activateExecutedExercise(execution, targetExerciseId)
        : execution;
    updateExecution(
      startExecutedSetRest(immediateBase, targetExerciseId, targetSetId),
    );

    // Re-read after the immediate local transition so another tab cannot
    // start from a stale snapshot and overwrite the session's active clock.
    void loadWorkoutStore().then((store) => {
      const latestWorkouts: Workout[] = store.templates.map((template) => {
        const session = store.sessions
          .filter(
            (item) =>
              item.templateId === template.id && item.status !== "completed",
          )
          .sort((a, b) => b.startedAt - a.startedAt)[0];
        return session
          ? { ...session.snapshot, execution: session.execution }
          : template;
      });
      const latestExecution = latestWorkouts.find(
        (item) => item.id === workoutId,
      )?.execution;
      if (!latestExecution) return;
      const latestResting = latestExecution.exercises
        .flatMap((item) => item.sets)
        .find((item) => item.status === "resting");
      if (latestResting && latestResting.setId !== targetSetId) {
        updateExecution(latestExecution);
      }
    });
  };
  useEffect(() => {
    const resting = execution?.exercises
      .flatMap((item) => item.sets)
      .find((item) => item.status === "resting");
    const restEndsAt = resting?.restEndsAt;
    if (!restEndsAt) return;
    const tick = () => {
      setClock(Date.now());
      if (restEndsAt <= Date.now())
        updateExecution(finishExecutedRest(execution!));
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [execution, updateExecution]);
  const finishWorkout = () => {
    if (execution)
      requestConfirmation({
        title: "Terminer la séance ?",
        description: "Cette séance sera clôturée définitivement.",
        confirmLabel: "Terminer",
        onConfirm: () => {
          updateExecution(completeWorkoutExecution(execution));
          setWorkouts((current) =>
            current.map((item) =>
              item.id === workoutId ? { ...item, execution: undefined } : item,
            ),
          );
        },
      });
  };
  const requestConfirmation = (request: ConfirmationRequest) =>
    setConfirmation({
      ...request,
      onConfirm: () => {
        setConfirmation(null);
        request.onConfirm();
      },
    });
  const finishCurrentRest = () => {
    if (!execution || !restingSet) return;
    const remaining = restRemaining;
    requestConfirmation({
      title: "Mettre fin au repos ?",
      description: `Il reste ${remaining} ${remaining === 1 ? "seconde" : "secondes"}. La série sera considérée comme terminée et vous passerez à la suivante.`,
      confirmLabel: "Mettre fin",
      onConfirm: () => updateExecution(finishExecutedRest(execution)),
    });
  };
  const close = () => {
    if (!dialog || dialogClosing) return;
    setDialogClosing(true);
    window.clearTimeout(dialogCloseTimeout.current);
    dialogCloseTimeout.current = window.setTimeout(() => {
      setDialog(null);
      setDialogClosing(false);
      setName("");
      setInitialSetCount("1");
      setRest(String(defaultRestSeconds));
    }, bottomSheetCloseDuration);
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (dialog === "workout" && name.trim())
      update([...workouts, createWorkout(name.trim())]);
    if (dialog === "renameWorkout" && workout && name.trim())
      update(
        workouts.map((w) =>
          w.id === workout!.id ? { ...w, name: name.trim() } : w,
        ),
      );
    if (dialog === "exercise" && workout && name.trim()) {
      if (
        !Number.isSafeInteger(Number(initialSetCount)) ||
        Number(initialSetCount) <= 0
      )
        return;
      const nextWorkout = addExercise(
        workout,
        name.trim(),
        Number(initialSetCount),
        Number(rest),
      );
      const addedExercise = nextWorkout.exercises.at(-1)!;
      const nextExecution =
        workout.execution && workout.execution.status !== "completed"
          ? addExerciseToExecution(workout.execution, addedExercise)
          : workout.execution;
      update(
        workouts.map((w) =>
          w.id === workout.id
            ? { ...nextWorkout, execution: nextExecution }
            : w,
        ),
      );
      if (!exercise) setExerciseId(addedExercise.id);
    }
    if (dialog === "renameExercise" && workout && exercise && name.trim())
      update(
        workouts.map((w) =>
          w.id === workout!.id
            ? {
                ...w,
                exercises: w.exercises.map((x) =>
                  x.id === exercise.id ? { ...x, name: name.trim() } : x,
                ),
              }
            : w,
        ),
      );
    close();
  };
  const removeWorkout = (id: string) => {
    const target = workouts.find((item) => item.id === id);
    if (target)
      requestConfirmation({
        title: "Supprimer cette séance ?",
        description: `« ${target.name} » et toutes ses données seront supprimés définitivement.`,
        confirmLabel: "Supprimer",
        onConfirm: () => {
          update(workouts.filter((item) => item.id !== id));
          if (workoutId === id) {
            setWorkoutId("");
            setExerciseId("");
            navigate("list", "back");
          }
        },
      });
  };
  const removeExercise = () => {
    if (!workout || !exercise) return;
    const progress = executionExercise(exercise.id);
    const hasData =
      exercise.plannedSets.some(
        (set) =>
          set.repetitions !== null ||
          set.weightKg !== null ||
          set.restSeconds !==
            (exercise.defaultRestSeconds ?? defaultRestSeconds),
      ) ||
      (progress?.status !== undefined && progress.status !== "upcoming");
    const remove = () => {
      update(
        workouts.map((w) =>
          w.id === workout!.id
            ? {
                ...w,
                exercises: sort(w.exercises)
                  .filter((x) => x.id !== exercise.id)
                  .map((x, position) => ({ ...x, position })),
                execution: w.execution
                  ? removeExecutedExercise(w.execution, exercise.id)
                  : undefined,
              }
            : w,
        ),
      );
      setExerciseId(
        sort(workout.exercises).find((x) => x.id !== exercise.id)?.id ?? "",
      );
      navigate("detail", "back");
      close();
    };
    if (hasData)
      requestConfirmation({
        title: "Supprimer cet exercice ?",
        description: `« ${exercise.name} » contient des valeurs ou une progression qui seront supprimées.`,
        confirmLabel: "Supprimer",
        onConfirm: remove,
      });
    else remove();
  };
  const editSet = (
    id: string,
    field: "repetitions" | "weightKg" | "restSeconds",
    value: number | null,
  ) => {
    if (!workout || !exercise || (field === "restSeconds" && value === null))
      return;
    update(
      workouts.map((w) =>
        w.id === workout.id
          ? {
              ...w,
              exercises: w.exercises.map((x) =>
                x.id === exercise.id
                  ? {
                      ...x,
                      plannedSets: x.plannedSets.map((s) =>
                        s.id === id ? { ...s, [field]: value } : s,
                      ),
                    }
                  : x,
              ),
            }
          : w,
      ),
    );
  };
  const saveSetValue = (
    id: string,
    field: "repetitions" | "weightKg" | "restSeconds",
    value: number,
  ) => {
    if (!workout || !exercise) return;
    if (!execution) {
      editSet(id, field, value);
      return;
    }
    const nextExecution = updateExecutedSet(
      execution,
      exercise.id,
      id,
      field,
      value,
    );
    update(
      workouts.map((w) =>
        w.id !== workout.id
          ? w
          : {
              ...w,
              exercises:
                field === "weightKg" ||
                field === "repetitions" ||
                field === "restSeconds"
                  ? w.exercises.map((item) =>
                      item.id !== exercise.id
                        ? item
                        : {
                            ...item,
                            plannedSets: item.plannedSets.map((set) =>
                              set.id === id ? { ...set, [field]: value } : set,
                            ),
                          },
                    )
                  : w.exercises,
              execution: nextExecution,
            },
      ),
    );
  };
  const appendSet = () => {
    if (!workout || !exercise) return;
    if (
      execution?.status === "inProgress" &&
      executionExercise(exercise.id)?.status === "completed"
    )
      return;
    const nextExercises = workout.exercises.map((x) =>
      x.id === exercise.id ? addSet(x) : x,
    );
    const nextExercise = nextExercises.find((x) => x.id === exercise.id)!;
    update(
      workouts.map((w) =>
        w.id !== workout.id
          ? w
          : {
              ...w,
              exercises: nextExercises,
              execution:
                execution && execution.status !== "completed"
                  ? addSetToExecution(
                      execution,
                      exercise.id,
                      nextExercise.plannedSets.at(-1)!,
                    )
                  : execution,
            },
      ),
    );
  };
  const removeSet = (id: string) => {
    if (!workout || !exercise) return;
    const current = executionSet(id);
    if (
      execution &&
      (!current ||
        current.status === "performed" ||
        current.status === "skipped")
    )
      return;
    const set = exercise.plannedSets.find((item) => item.id === id);
    if (!set) return;
    const hasData =
      set.repetitions !== null ||
      set.weightKg !== null ||
      set.restSeconds !== (exercise.defaultRestSeconds ?? defaultRestSeconds);
    const remove = () =>
      update(
        workouts.map((w) =>
          w.id !== workout.id
            ? w
            : {
                ...w,
                exercises: w.exercises.map((x) =>
                  x.id !== exercise.id
                    ? x
                    : {
                        ...x,
                        plannedSets: sort(x.plannedSets)
                          .filter((set) => set.id !== id)
                          .map((set, position) => ({ ...set, position })),
                      },
                ),
                execution: w.execution
                  ? removeExecutedSet(w.execution, exercise.id, id)
                  : undefined,
              },
        ),
      );
    if (hasData)
      requestConfirmation({
        title: "Supprimer cette série ?",
        description:
          "Les répétitions, la charge et le repos de cette série seront supprimés.",
        confirmLabel: "Supprimer",
        onConfirm: remove,
      });
    else remove();
  };
  const moveExercise = (from: number, to: number) => {
    if (!workout) return;
    update(
      workouts.map((w) =>
        w.id === workout.id
          ? (() => {
              const exercises = reorder(w.exercises, from, to);
              return {
                ...w,
                exercises,
                execution: w.execution
                  ? {
                      ...w.execution,
                      exercises: exercises.map((item) =>
                        w.execution!.exercises.find(
                          (entry) => entry.exerciseId === item.id,
                        )!,
                      ),
                    }
                  : undefined,
              };
            })()
          : w,
      ),
    );
  };
  const selectExercise = (nextExerciseId: string) => {
    const orderedExercises = sort(workout?.exercises ?? []);
    const previousIndex = orderedExercises.findIndex(
      (item) => item.id === exerciseId,
    );
    const nextIndex = orderedExercises.findIndex(
      (item) => item.id === nextExerciseId,
    );
    if (previousIndex >= 0 && nextIndex >= 0 && previousIndex !== nextIndex) {
      const outgoingExercise = orderedExercises[previousIndex];
      setOutgoingExerciseVisual({
        name: outgoingExercise.name,
        plannedSetCount: outgoingExercise.plannedSets.length,
      });
      setExerciseTransition(nextIndex > previousIndex ? "next" : "previous");
      window.clearTimeout(exerciseTransitionTimeout.current);
      exerciseTransitionTimeout.current = window.setTimeout(() => {
        setExerciseTransition("none");
        setOutgoingExerciseVisual(null);
      }, 340);
    }
    setExerciseId(nextExerciseId);
  };
  useEffect(
    () => () => {
      window.clearTimeout(exerciseTransitionTimeout.current);
      window.clearTimeout(dialogCloseTimeout.current);
    },
    [],
  );
  const isWorkoutDetail = screen === "detail" && !!workout;
  const activeWorkout = workouts.find(
    (item) =>
      item.execution?.status === "inProgress" ||
      item.execution?.status === "readyToFinish",
  );
  const preparedWorkouts = workouts.filter(
    (item) => item.id !== activeWorkout?.id,
  );
  const totalPlannedSets =
    workout?.exercises.reduce(
      (total, item) => total + item.plannedSets.length,
      0,
    ) ?? 0;
  const displayedSets = exercise ? sort(exercise.plannedSets) : [];
  const isFirstPendingSet = (setId: string) => {
    const index = displayedSets.findIndex((set) => set.id === setId);
    return (
      index >= 0 &&
      displayedSets.slice(0, index).every((set) => {
        const status = executionSet(set.id)?.status;
        return status === "performed" || status === "skipped";
      })
    );
  };
  const isMenu =
    dialog === "addMenu" || dialog === "organizeMenu" || dialog === "reorder";
  return (
    <main
      className={`app-shell screen-${screen}${screen === "detail" && exercise ? " workout-detail" : ""}`}
    >
      <header
        className={`workout-control${screen === "list" ? " home-header" : ""}`}
      >
        {screen === "list" ? (
          <div className="brand-lockup">
            <img src="/icons/app-logo.svg" alt="" width="42" height="42" />
            <div>
              <p>Sport Nutrition</p>
              <h1>Entraînement</h1>
            </div>
          </div>
        ) : (
          <>
            <button
              aria-label="Retour aux séances"
              className="link"
              onPointerUp={(event) => event.currentTarget.blur()}
              onClick={() => {
                if (screen === "workouts") navigate("list", "back");
                else if (screen === "preview") navigate("workouts", "back");
                else
                  navigate(
                    screen === "detail" && workout && !workout.execution
                      ? "preview"
                      : "list",
                    "back",
                  );
              }}
            >
              <Icon name="arrow-left" size={19} />
              <span className="sr-only">Retour</span>
            </button>
            <h1>{screen === "workouts" ? "Mes séances" : workout?.name}</h1>
            {isWorkoutDetail && (
              <div className="control-actions">
                <button
                  aria-label="Gérer les exercices"
                  onClick={() => setDialog("addMenu")}
                >
                  <Icon name="plus" />
                </button>
                <button
                  aria-label="Réorganiser les exercices"
                  onClick={() => setDialog("organizeMenu")}
                >
                  <Icon name="more" />
                </button>
              </div>
            )}
          </>
        )}
      </header>
      {screen === "list" && (
        <section
          className={`workout-library dashboard page-${screenTransition}`}
          aria-label="Entraînement"
        >
          <div className="library-heading">
            <span>Votre espace d’entraînement</span>
          </div>
          <div className="dashboard-grid">
            {activeWorkout && (
              <section
                className="active-workout-list"
                aria-label="Séance en cours"
              >
                <ul className="workout-list">
                  <WorkoutRow
                    workout={activeWorkout}
                    variant="active"
                    onDelete={() => removeWorkout(activeWorkout.id)}
                    onOpen={() => {
                      setWorkoutId(activeWorkout.id);
                      setExerciseId(sort(activeWorkout.exercises)[0]?.id ?? "");
                      navigate("detail", "forward");
                    }}
                  />
                </ul>
              </section>
            )}
            <button
              className="dashboard-tile sessions-tile"
              aria-label="Ouvrir Mes séances"
              onClick={() => navigate("workouts", "forward")}
            >
              <span className="dashboard-tile-art" aria-hidden="true">
                <Icon name="dumbbell" size={46} strokeWidth={1.45} />
                <Icon name="list" size={22} />
              </span>
              <span className="dashboard-tile-copy">
                <small>
                  {preparedWorkouts.length} prête
                  {preparedWorkouts.length > 1 ? "s" : ""}
                </small>
                <strong>Mes séances</strong>
              </span>
              <Icon name="chevron-right" size={18} />
            </button>
            <section
              className="dashboard-tile future-tile"
              aria-label="Calendrier bientôt disponible"
            >
              <span className="future-tile-icon" aria-hidden="true">
                <Icon name="calendar" size={30} />
              </span>
              <small>Bientôt</small>
              <strong>Calendrier</strong>
            </section>
            <section
              className="dashboard-tile future-tile"
              aria-label="Performances bientôt disponibles"
            >
              <span className="future-tile-icon" aria-hidden="true">
                <Icon name="performance" size={30} />
              </span>
              <small>—</small>
              <strong>Performances</strong>
            </section>
            <section
              className="dashboard-tile future-tile"
              aria-label="Trophées bientôt disponibles"
            >
              <span className="future-tile-icon" aria-hidden="true">
                <Icon name="trophy" size={30} />
              </span>
              <small>Bientôt</small>
              <strong>Trophées</strong>
            </section>
          </div>
        </section>
      )}
      {screen === "workouts" && (
        <section
          className={`workout-library sessions-library page-${screenTransition}`}
          aria-label="Mes séances"
        >
          <div className="sessions-library-heading">
            <div>
              <span>Programme</span>
              <h2>Mes séances</h2>
              <p>
                {preparedWorkouts.length} séance
                {preparedWorkouts.length > 1 ? "s" : ""} prête
                {preparedWorkouts.length > 1 ? "s" : ""}
              </p>
            </div>
            <button
              className="create-workout-icon"
              aria-label="Créer une séance"
              onClick={() => setDialog("workout")}
            >
              <Icon name="plus" size={21} />
            </button>
          </div>
          {preparedWorkouts.length ? (
            <ul className="workout-list sessions-library-list">
              {preparedWorkouts.map((item) => (
                <WorkoutRow
                  key={item.id}
                  workout={item}
                  variant="compact"
                  onDelete={() => removeWorkout(item.id)}
                  onOpen={() => {
                    setWorkoutId(item.id);
                    setExerciseId(sort(item.exercises)[0]?.id ?? "");
                    navigate("preview", "forward");
                  }}
                />
              ))}
            </ul>
          ) : (
            <section className="empty sessions-empty">
              <span className="empty-icon" aria-hidden="true">
                <Icon name="dumbbell" size={28} />
              </span>
              <h2>Aucune séance prête</h2>
              <span>Créez votre première séance.</span>
            </section>
          )}
        </section>
      )}
      {screen === "preview" && workout && (
        <section
          className={`workout-preview page-${screenTransition}`}
          aria-label={`Aperçu de ${workout.name}`}
        >
          <div className="preview-hero">
            <span className="preview-art" aria-hidden="true">
              <Icon name="dumbbell" size={34} strokeWidth={1.7} />
            </span>
            <div>
              <span>Prêt pour votre séance ?</span>
              <h2>{workout.name}</h2>
            </div>
          </div>
          <div className="preview-metrics">
            <div>
              <strong>{workout.exercises.length}</strong>
              <span>Exercices</span>
            </div>
            <div>
              <strong>{totalPlannedSets}</strong>
              <span>Séries prévues</span>
            </div>
            <div className="preview-metric-unavailable">
              <strong>—</strong>
              <span>Durée moyenne</span>
              <small>Pas encore de données</small>
            </div>
            <div className="preview-metric-unavailable">
              <strong>—</strong>
              <span>Calories moyennes</span>
              <small>Pas encore de données</small>
            </div>
          </div>
          <section
            className="preview-exercises"
            aria-label="Programme de la séance"
          >
            <header>
              <span>Programme</span>
              <strong>{workout.exercises.length}</strong>
            </header>
            {workout.exercises.length ? (
              <ol>
                {sort(workout.exercises).map((item, index) => (
                  <li key={item.id}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{item.name}</strong>
                    <small>
                      {item.plannedSets.length} série
                      {item.plannedSets.length > 1 ? "s" : ""}
                    </small>
                  </li>
                ))}
              </ol>
            ) : (
              <p>Ajoutez des exercices avant de démarrer.</p>
            )}
          </section>
          <div className="preview-actions">
            <button
              className="primary"
              onClick={() => {
                const firstExerciseId = sort(workout.exercises)[0]?.id ?? "";
                setExerciseId(firstExerciseId);
                navigate("detail", "forward");
              }}
            >
              <Icon name="edit" size={16} /> Refaire la séance
            </button>
          </div>
        </section>
      )}
      {screen === "detail" && workout && (
        <>
          {workout.exercises.length === 0 && (
            <section className="empty">
              <h2>Aucun exercice</h2>
              <span>
                Ajoutez votre premier exercice pour préparer cette séance.
              </span>
              <button className="primary" onClick={() => setDialog("exercise")}>
                Ajouter un exercice
              </button>
            </section>
          )}
          {exercise && (
            <div
              className={`workout-preparation transition-${exerciseTransition}`}
            >
              <div className="workout-fixed-zones">
                <ExerciseNavigator
                  exercises={sort(workout.exercises)}
                  selectedExerciseId={exerciseId}
                  statusFor={(id) => executionExercise(id)?.status}
                  onSelect={selectExercise}
                />
                <section className="exercise-hero">
                  <div className="exercise-identity-viewport">
                    {outgoingExerciseVisual &&
                      exerciseTransition !== "none" && (
                        <div
                          className="exercise-identity exercise-transition-outgoing"
                          aria-hidden="true"
                        >
                          <div className="exercise-art">
                            <Icon name="dumbbell" size={28} />
                          </div>
                          <div className="exercise-heading">
                            <h2>{outgoingExerciseVisual.name}</h2>
                            <p>
                              {outgoingExerciseVisual.plannedSetCount} série
                              {outgoingExerciseVisual.plannedSetCount > 1
                                ? "s"
                                : ""}
                            </p>
                          </div>
                        </div>
                      )}
                    <div className="exercise-identity exercise-transition-current">
                      <div className="exercise-art" aria-hidden="true">
                        <Icon name="dumbbell" size={28} />
                      </div>
                      <div className="exercise-heading">
                        <h2>{exercise.name}</h2>
                        <p>
                          {exercise.plannedSets.length} série
                          {exercise.plannedSets.length > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="exercise-menu">
                    <button
                      aria-label="Actions de l’exercice"
                      onClick={() => {
                        setName(exercise.name);
                        setDialog("renameExercise");
                      }}
                    >
                      <Icon name="more" size={18} />
                    </button>
                    {execution?.status === "inProgress" ? (
                      <button
                        disabled={
                          executionExercise(exercise.id)?.status === "completed"
                        }
                        onClick={() =>
                          requestConfirmation({
                            title: "Mettre fin à cet exercice ?",
                            description:
                              "Les séries restantes seront ignorées.",
                            confirmLabel: "Mettre fin",
                            onConfirm: () =>
                              updateExecution(
                                skipExecutedExercise(execution, exercise.id),
                              ),
                          })
                        }
                      >
                        <span>Terminer l’exercice</span>
                      </button>
                    ) : (
                      <button onClick={removeExercise}>Supprimer</button>
                    )}
                  </div>
                </section>
                <button
                  className="advanced"
                  type="button"
                  aria-expanded="false"
                >
                  <span>Options avancées</span>
                  <Icon name="chevron-down" size={15} />
                </button>
                {!execution ? (
                  <button className="primary" onClick={() => startExecution()}>
                    Démarrer la séance
                  </button>
                ) : execution.status === "readyToFinish" ? (
                  <button className="primary" onClick={finishWorkout}>
                    Terminer la séance
                  </button>
                ) : execution.status === "completed" ? (
                  <p className="execution-resume">Séance terminée</p>
                ) : null}
                {execution && (
                  <WorkoutProgress
                    execution={execution}
                    workout={workout}
                    clock={clock}
                    onFinishRest={finishCurrentRest}
                    selectedExerciseId={exercise.id}
                  />
                )}
              </div>
              <section
                className="planned-sets"
                aria-label={`Séries de ${exercise.name}`}
              >
                {exercise.plannedSets.length > 0 && (
                  <p className="set-exercise-name">{exercise.name}</p>
                )}
                <ul>
                  {displayedSets.map((s, i) => (
                    <li
                      className={
                        "set-block status-" +
                        (executionSet(s.id)?.status ?? "planned") +
                        (executionSet(s.id)?.status === "active"
                          ? " active"
                          : "")
                      }
                      key={s.id}
                    >
                      {execution && (
                        <p className="set-status">
                          {executionSet(s.id)?.status === "active"
                            ? "Série active"
                            : executionSet(s.id)?.status === "resting"
                              ? "Repos en cours"
                              : executionSet(s.id)?.status === "performed"
                                ? "Effectuée"
                                : executionSet(s.id)?.status === "skipped"
                                  ? "Skippée"
                                  : "À venir"}
                        </p>
                      )}
                      <h3 aria-label={`SÉRIE ${i + 1}`}>
                        {String(i + 1).padStart(2, "0")}
                      </h3>
                      {!execution && <p className="set-status">À venir</p>}
                      <div className="set-metrics">
                        <SetValuePicker
                          label="Répétitions"
                          displayLabel="Répétitions"
                          value={
                            executionSet(s.id)?.repetitions ?? s.repetitions
                          }
                          columns={[
                            {
                              label: "Répétitions",
                              values: pickerValues.repetitions,
                              value: Math.min(
                                24,
                                Math.max(
                                  0,
                                  executionSet(s.id)?.repetitions ??
                                    s.repetitions ??
                                    0,
                                ),
                              ),
                            },
                          ]}
                          formatValue={(value) =>
                            value === null ? "—" : String(value)
                          }
                          valueSuffix="reps"
                          disabled={execution?.status === "completed"}
                          onSave={(value) =>
                            saveSetValue(s.id, "repetitions", value)
                          }
                        />
                        <SetValuePicker
                          label="Charge (kg)"
                          displayLabel="Charge"
                          value={executionSet(s.id)?.weightKg ?? s.weightKg}
                          columns={[
                            {
                              label: "Kilogrammes",
                              values: pickerValues.weightKg,
                              value: Math.min(
                                300,
                                Math.max(
                                  0,
                                  executionSet(s.id)?.weightKg ??
                                    s.weightKg ??
                                    0,
                                ),
                              ),
                            },
                          ]}
                          formatValue={(value) =>
                            value === null ? "—" : String(value)
                          }
                          valueSuffix="kg"
                          disabled={execution?.status === "completed"}
                          onSave={(value) =>
                            saveSetValue(s.id, "weightKg", value)
                          }
                        />
                        <SetValuePicker
                          label="Repos"
                          value={
                            executionSet(s.id)?.restSeconds ?? s.restSeconds
                          }
                          columns={[
                            {
                              label: "Minutes",
                              values: pickerValues.minutes,
                              value: Math.min(
                                6,
                                Math.floor(
                                  (executionSet(s.id)?.restSeconds ??
                                    s.restSeconds) / 60,
                                ),
                              ),
                            },
                            {
                              label: "Secondes",
                              values: pickerValues.seconds,
                              value:
                                (executionSet(s.id)?.restSeconds ??
                                  s.restSeconds) % 60,
                            },
                          ]}
                          formatValue={(value) =>
                            value === null ? "—" : formatRest(value)
                          }
                          disabled={execution?.status === "completed"}
                          onSave={(value) =>
                            saveSetValue(s.id, "restSeconds", value)
                          }
                        />
                      </div>
                      {(executionSet(s.id)?.status === "active" ||
                        (executionSet(s.id)?.status === "upcoming" &&
                          isFirstPendingSet(s.id))) && (
                        <button
                          className="rest-icon-button rest-start-button"
                          aria-label="Lancer le repos"
                          disabled={!!restingSet && restingSet.setId !== s.id}
                          title={
                            restingSet && restingSet.setId !== s.id
                              ? "Un repos est déjà en cours"
                              : undefined
                          }
                          onClick={() => startRest(exercise.id, s.id)}
                        >
                          <Icon name="play" size={16} />
                          <span>Lancer le repos</span>
                        </button>
                      )}
                      {executionSet(s.id)?.status === "resting" && (
                        <button
                          className="rest-icon-button rest-stop-button"
                          aria-label="Mettre fin au repos"
                          onClick={finishCurrentRest}
                        >
                          <Icon name="stop" size={15} />
                          <span>Terminer le repos</span>
                        </button>
                      )}
                      {(!execution ||
                        (executionSet(s.id) &&
                          executionSet(s.id)?.status !== "performed" &&
                          executionSet(s.id)?.status !== "skipped")) && (
                        <div className="order">
                          <button onClick={() => removeSet(s.id)}>
                            <Icon name="trash" size={15} />
                            <span>Supprimer</span>
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                {(!execution ||
                  (execution.status === "inProgress" &&
                    executionExercise(exercise.id)?.status !==
                      "completed")) && (
                  <button className="primary add-set" onClick={appendSet}>
                    + Ajouter une série
                  </button>
                )}
              </section>
            </div>
          )}
        </>
      )}
      {confirmation && (
        <ConfirmationDialog
          request={confirmation}
          onCancel={() => setConfirmation(null)}
        />
      )}
      {dialog && isMenu && workout && (
        <BottomSheet
          title={
            dialog === "addMenu"
              ? "Actions de la séance"
              : dialog === "organizeMenu"
                ? "Organisation de la séance"
                : "Réordonner les exercices"
          }
          closing={dialogClosing}
          onClose={close}
        >
          {dialog === "addMenu" ? (
            <div className="action-sheet">
              <h2>Actions de la séance</h2>
              <div className="action-sheet-menu">
                <button onClick={() => setDialog("exercise")}>
                  <span className="action-sheet-icon" aria-hidden="true">
                    <Icon name="plus" size={19} />
                  </span>
                  <span>Ajouter un exercice</span>
                  <Icon name="chevron-right" size={17} />
                </button>
                <button className="danger" onClick={removeExercise}>
                  <span className="action-sheet-icon" aria-hidden="true">
                    <Icon name="trash" size={18} />
                  </span>
                  <span>Supprimer l’exercice</span>
                  <Icon name="chevron-right" size={17} />
                </button>
              </div>
              <button className="action-sheet-cancel" onClick={close}>
                Annuler
              </button>
            </div>
          ) : dialog === "organizeMenu" ? (
            <div className="action-sheet">
              <h2>Organisation</h2>
              <div className="action-sheet-menu">
                <button onClick={() => setDialog("reorder")}>
                  <span className="action-sheet-icon" aria-hidden="true">
                    <Icon name="reorder" size={19} />
                  </span>
                  <span>Réordonner les exercices</span>
                  <Icon name="chevron-right" size={17} />
                </button>
                <button
                  onClick={() => {
                    setName(workout.name);
                    setDialog("renameWorkout");
                  }}
                >
                  <span className="action-sheet-icon" aria-hidden="true">
                    <Icon name="edit" size={18} />
                  </span>
                  <span>Renommer la séance</span>
                  <Icon name="chevron-right" size={17} />
                </button>
              </div>
              <button className="action-sheet-cancel" onClick={close}>
                Annuler
              </button>
            </div>
          ) : (
            <>
              <h2>Réordonner les exercices</h2>
              {workout.exercises.length === 0 && (
                <p>Aucun exercice à réordonner.</p>
              )}
              <ul aria-label="Ordre des exercices" className="reorder-list">
                {sort(workout.exercises).map((x, i) => (
                  <li key={x.id}>
                    <strong>{x.name}</strong>
                    <div className="order">
                      <button
                        aria-label={`Monter ${x.name}`}
                        disabled={
                          i === 0 ||
                          executionExercise(x.id)?.status === "completed" ||
                          executionExercise(
                            sort(workout.exercises)[i - 1]?.id ?? "",
                          )?.status === "completed"
                        }
                        onClick={() => moveExercise(i, i - 1)}
                      >
                        <Icon name="chevron-up" />
                      </button>
                      <button
                        aria-label={`Descendre ${x.name}`}
                        disabled={
                          i === workout.exercises.length - 1 ||
                          executionExercise(x.id)?.status === "completed" ||
                          executionExercise(
                            sort(workout.exercises)[i + 1]?.id ?? "",
                          )?.status === "completed"
                        }
                        onClick={() => moveExercise(i, i + 1)}
                      >
                        <Icon name="chevron-down" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <button onClick={close}>Terminer</button>
            </>
          )}
        </BottomSheet>
      )}
      {dialog && !isMenu && (
        <BottomSheet
          title={
            dialog === "exercise" || dialog === "renameExercise"
              ? "Exercice"
              : "Séance"
          }
          closing={dialogClosing}
          onClose={close}
        >
          <form className="sheet-form" onSubmit={submit}>
            <h2>
              {dialog === "exercise" || dialog === "renameExercise"
                ? "Exercice"
                : "Séance"}
            </h2>
            <label>
              Nom
              <input
                aria-label="Nom"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
            {dialog === "exercise" && (
              <div className="compact-form-fields">
                <SetValuePicker
                  label="Nombre de séries initiales"
                  displayLabel="Séries"
                  value={Number(initialSetCount)}
                  columns={[
                    {
                      label: "Séries",
                      values: pickerValues.sets,
                      value: Number(initialSetCount),
                    },
                  ]}
                  formatValue={(value) => String(value ?? 1)}
                  onSave={(value) => setInitialSetCount(String(value))}
                />
                <SetValuePicker
                  label="Repos par défaut"
                  displayLabel="Repos"
                  value={Number(rest)}
                  columns={[
                    {
                      label: "Minutes",
                      values: pickerValues.minutes,
                      value: Math.min(6, Math.floor(Number(rest) / 60)),
                    },
                    {
                      label: "Secondes",
                      values: pickerValues.seconds,
                      value: Number(rest) % 60,
                    },
                  ]}
                  formatValue={(value) => formatRest(value ?? 0)}
                  onSave={(value) => setRest(String(value))}
                />
              </div>
            )}
            <button className="primary">Enregistrer</button>
            <button type="button" onClick={close}>
              Annuler
            </button>
          </form>
        </BottomSheet>
      )}
      <BottomNavigation onWorkouts={() => setScreen("list")} />
    </main>
  );
}

function WorkoutRow({
  workout,
  variant = "compact",
  onOpen,
  onDelete,
}: {
  workout: Workout;
  variant?: "active" | "compact";
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const startX = useRef<number | null>(null);
  const moved = useRef(false);
  const move = (clientX: number) => {
    if (startX.current === null) return;
    const distance = clientX - startX.current;
    if (Math.abs(distance) > 8) moved.current = true;
    if (distance < -36) setOpen(true);
    if (distance > 36) setOpen(false);
  };
  const executionSets = workout.execution?.exercises.flatMap(
    (exercise) => exercise.sets,
  );
  const settledSets =
    executionSets?.filter(
      (set) => set.status === "performed" || set.status === "skipped",
    ).length ?? 0;
  const isActive =
    workout.execution?.status === "inProgress" ||
    workout.execution?.status === "readyToFinish";
  return (
    <li
      className={"workout-swipe" + (open ? " open" : "")}
      onPointerDown={(event) => {
        startX.current = event.clientX;
        moved.current = false;
      }}
      onPointerMove={(event) => move(event.clientX)}
      onPointerUp={(event) => {
        move(event.clientX);
        startX.current = null;
      }}
      onPointerCancel={() => {
        startX.current = null;
      }}
    >
      <button
        aria-label={"Supprimer " + workout.name}
        className="workout-delete"
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
      >
        <Icon name="trash" size={15} />
        <span>Supprimer</span>
      </button>
      <button
        className={`row workout-card workout-card-${variant}${isActive ? " workout-card-active" : ""}`}
        onClick={() => {
          if (moved.current) {
            moved.current = false;
            return;
          }
          if (open) {
            setOpen(false);
            return;
          }
          onOpen();
        }}
      >
        {isActive && variant === "active" && (
          <span className="active-session-heading">
            <span className="active-session-dot" aria-hidden="true" />
            <span>Séance en cours</span>
          </span>
        )}
        <span className="workout-card-art" aria-hidden="true">
          <Icon name="dumbbell" size={24} />
        </span>
        <span className="workout-card-content">
          {variant !== "active" && (
            <small
              className={`workout-badge ${workout.execution?.status ?? "planned"}`}
            >
              Préparée
            </small>
          )}
          <strong>{workout.name}</strong>
          <small>
            {isActive && executionSets
              ? `${settledSets} / ${executionSets.length} séries`
              : `${workout.exercises.length} exercice${workout.exercises.length > 1 ? "s" : ""}`}
          </small>
          {isActive && executionSets && (
            <span className="workout-card-progress">
              <span
                style={{
                  width: `${executionSets.length ? (settledSets / executionSets.length) * 100 : 0}%`,
                }}
              />
            </span>
          )}
        </span>
        <span className="workout-card-cta">
          {isActive ? "Reprendre" : "Aperçu"} <span aria-hidden="true">→</span>
        </span>
      </button>
    </li>
  );
}

function formatRest(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
