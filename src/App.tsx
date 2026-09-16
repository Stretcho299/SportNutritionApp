import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import { WorkoutProgress } from "./WorkoutProgress";
import {
  ConfirmationDialog,
  type ConfirmationRequest,
} from "./ConfirmationDialog";
import { SetValuePicker } from "./SetValuePicker";
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
  loadWorkouts,
  removeExecutedUpcomingSet,
  reorder,
  saveWorkouts,
  skipExecutedExercise,
  sort,
  startExecutedSetRest,
  startWorkoutExecution,
  updateExecutedSet,
  type ExecutedSet,
  type WorkoutExecution,
  type Workout,
} from "./storage/database";
type Screen = "list" | "detail";
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
  const [name, setName] = useState("");
  const [initialSetCount, setInitialSetCount] = useState("1");
  const [rest, setRest] = useState(String(defaultRestSeconds));
  const [clock, setClock] = useState(0);
  const [confirmation, setConfirmation] = useState<ConfirmationRequest | null>(
    null,
  );
  useEffect(() => {
    void loadWorkouts().then(setWorkouts);
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
  const restingSet = execution?.exercises
    .flatMap((item) => item.sets)
    .find((item) => item.status === "resting");
  const updateExecution = useCallback(
    (next: WorkoutExecution) =>
      update(
        workouts.map((w) =>
          w.id === workoutId ? { ...w, execution: next } : w,
        ),
      ),
    [update, workoutId, workouts],
  );
  const startExecution = () => {
    if (workout)
      updateExecution(startWorkoutExecution(workout, undefined, exerciseId));
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
    void loadWorkouts().then((latestWorkouts) => {
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
        onConfirm: () => updateExecution(completeWorkoutExecution(execution)),
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
  const close = () => {
    setDialog(null);
    setName("");
    setInitialSetCount("1");
    setRest(String(defaultRestSeconds));
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
        workout.execution?.status === "inProgress"
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
            setScreen("list");
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
              }
            : w,
        ),
      );
      setExerciseId(
        sort(workout.exercises).find((x) => x.id !== exercise.id)?.id ?? "",
      );
      setScreen("detail");
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
    if (execution) {
      updateExecution(
        updateExecutedSet(execution, exercise.id, id, field, value),
      );
    } else {
      editSet(id, field, value);
    }
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
                execution?.status === "inProgress"
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
    const firstSetId = sort(exercise.plannedSets)[0]?.id;
    if (execution?.status === "inProgress" && id === firstSetId) return;
    if (execution && current?.status !== "upcoming") return;
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
                  ? removeExecutedUpcomingSet(w.execution, exercise.id, id)
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
  const isWorkoutDetail = screen === "detail" && !!workout;
  const isMenu =
    dialog === "addMenu" || dialog === "organizeMenu" || dialog === "reorder";
  return (
    <main
      className={`app-shell${screen === "detail" && exercise ? " workout-detail" : ""}`}
    >
      <header
        className={`workout-control${screen === "list" ? " home-header" : ""}`}
      >
        <p>Sport Nutrition</p>
        <h1>{screen === "list" ? "Séances" : workout?.name}</h1>
        {screen !== "list" && (
          <button
            aria-label="Retour aux séances"
            className="link"
            onClick={() => setScreen("list")}
          >
            ‹ Retour
          </button>
        )}
        {isWorkoutDetail && (
          <div className="control-actions">
            <button
              aria-label="Gérer les exercices"
              onClick={() => setDialog("addMenu")}
            >
              ＋
            </button>
            <button
              aria-label="Réorganiser les exercices"
              onClick={() => setDialog("organizeMenu")}
            >
              ↕
            </button>
          </div>
        )}
      </header>
      {screen === "list" && (
        <>
          <button className="primary" onClick={() => setDialog("workout")}>
            Créer une séance
          </button>
          {workouts.length === 0 ? (
            <section className="empty">
              <h2>Aucune séance</h2>
              <span>Créez votre première séance.</span>
            </section>
          ) : (
            <ul className="workout-list">
              {workouts.map((item) => (
                <WorkoutRow
                  key={item.id}
                  workout={item}
                  onDelete={() => removeWorkout(item.id)}
                  onOpen={() => {
                    setWorkoutId(item.id);
                    setExerciseId(sort(item.exercises)[0]?.id ?? "");
                    setScreen("detail");
                  }}
                />
              ))}
            </ul>
          )}
        </>
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
            <div className="workout-preparation">
              <div className="workout-fixed-zones">
                <ul className="exercise-tabs" aria-label="Exercices">
                  {sort(workout.exercises).map((x, i) => (
                    <li
                      className={
                        (x.id === exerciseId ? "selected " : "") +
                        "execution-" +
                        (executionExercise(x.id)?.status ?? "upcoming")
                      }
                      key={x.id}
                    >
                      <button
                        className="exercise-tab"
                        aria-pressed={x.id === exerciseId}
                        onClick={() => setExerciseId(x.id)}
                      >
                        <span
                          className="exercise-tab-circle"
                          aria-hidden="true"
                        >
                          {execution
                            ? executionExercise(x.id)?.status === "completed"
                              ? "✓"
                              : executionExercise(x.id)?.status === "active"
                                ? "●"
                                : "○"
                            : "✦"}
                        </span>
                        <span className="exercise-tab-index" aria-hidden="true">
                          {i + 1}
                        </span>
                        <span className="sr-only">{x.name}</span>
                        <span className="sr-only">
                          {" "}
                          ·{" "}
                          {executionExercise(x.id)?.status === "completed"
                            ? "Terminé"
                            : executionExercise(x.id)?.status === "active"
                              ? "En cours"
                              : "À venir"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <section className="exercise-hero">
                  <div className="exercise-heading">
                    <p>EXERCICE SÉLECTIONNÉ</p>
                    <h2>{exercise?.name}</h2>
                  </div>
                  <div className="exercise-menu">
                    <button
                      aria-label="Actions de l’exercice"
                      onClick={() => {
                        setName(exercise.name);
                        setDialog("renameExercise");
                      }}
                    >
                      •••
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
                              "Les séries restantes seront ignorées et vous passerez à l’exercice suivant.",
                            confirmLabel: "Mettre fin",
                            onConfirm: () =>
                              updateExecution(
                                skipExecutedExercise(execution, exercise.id),
                              ),
                          })
                        }
                      >
                        Terminer l’exercice
                      </button>
                    ) : (
                      <button onClick={removeExercise}>Supprimer</button>
                    )}
                  </div>
                </section>
                <button
                  className="advanced"
                  type="button"
                  onClick={() =>
                    alert(
                      "Les supersets, trisets et circuits arriveront bientôt.",
                    )
                  }
                >
                  Options avancées
                </button>
                {!execution ? (
                  <button className="primary" onClick={startExecution}>
                    Démarrer la séance
                  </button>
                ) : execution.status === "readyToFinish" ? (
                  <button className="primary" onClick={finishWorkout}>
                    Terminer la séance
                  </button>
                ) : execution.status === "completed" ? (
                  <p className="execution-resume">Séance terminée</p>
                ) : (
                  <p className="execution-resume">
                    Séance en cours · Reprenez là où vous vous êtes arrêté.
                  </p>
                )}
                {execution && (
                  <WorkoutProgress
                    execution={execution}
                    workout={workout}
                    clock={clock}
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
                  {sort(exercise.plannedSets).map((s, i) => (
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
                      <h3>SÉRIE {i + 1}</h3>
                      {!execution && <p className="set-status">À venir</p>}
                      <div className="set-metrics">
                        <SetValuePicker
                          label="Répétitions"
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
                            value === null ? "—" : `${value} reps`
                          }
                          disabled={
                            !!execution &&
                            executionSet(s.id)?.status !== "active"
                          }
                          onSave={(value) =>
                            saveSetValue(s.id, "repetitions", value)
                          }
                        />
                        <SetValuePicker
                          label="Charge (kg)"
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
                            value === null ? "—" : `${value} kg`
                          }
                          disabled={
                            !!execution &&
                            executionSet(s.id)?.status !== "active"
                          }
                          onSave={(value) =>
                            saveSetValue(s.id, "weightKg", value)
                          }
                        />
                        <SetValuePicker
                          label="Repos (secondes)"
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
                          disabled={
                            !!execution &&
                            executionSet(s.id)?.status !== "active"
                          }
                          onSave={(value) =>
                            saveSetValue(s.id, "restSeconds", value)
                          }
                        />
                      </div>
                      <p className="rest-timer">
                        {formatRest(
                          executionSet(s.id)?.status === "resting"
                            ? Math.max(
                                0,
                                Math.ceil(
                                  ((executionSet(s.id)?.restEndsAt ?? clock) -
                                    clock) /
                                    1000,
                                ),
                              )
                            : (executionSet(s.id)?.restSeconds ??
                                s.restSeconds),
                        )}{" "}
                        ·{" "}
                        {executionSet(s.id)?.status === "resting"
                          ? "Repos en cours"
                          : execution
                            ? "Repos"
                            : "Repos prévu"}
                      </p>
                      {(executionSet(s.id)?.status === "active" ||
                        (executionSet(s.id)?.status === "upcoming" &&
                          i === 0)) && (
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
                          <span aria-hidden="true">▶</span>
                          <span className="sr-only">Lancer le repos</span>
                        </button>
                      )}
                      {executionSet(s.id)?.status === "resting" && (
                        <button
                          className="rest-icon-button rest-stop-button"
                          aria-label="Mettre fin au repos"
                          onClick={() => {
                            const activeSet = executionSet(s.id);
                            const remaining = Math.max(
                              0,
                              Math.ceil(
                                ((activeSet?.restEndsAt ?? clock) -
                                  Date.now()) /
                                  1000,
                              ),
                            );
                            requestConfirmation({
                              title: "Mettre fin au repos ?",
                              description: `Il reste ${remaining} ${remaining === 1 ? "seconde" : "secondes"}. La série sera considérée comme terminée et vous passerez à la suivante.`,
                              confirmLabel: "Mettre fin",
                              onConfirm: () =>
                                updateExecution(finishExecutedRest(execution!)),
                            });
                          }}
                        >
                          <span aria-hidden="true">■</span>
                          <span className="sr-only">Terminer le repos</span>
                        </button>
                      )}
                      {(!execution ||
                        (executionSet(s.id)?.status === "upcoming" &&
                          i > 0)) && (
                        <div className="order">
                          <button onClick={() => removeSet(s.id)}>
                            Supprimer
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
        <Sheet
          title={
            dialog === "addMenu"
              ? "Actions de la séance"
              : dialog === "organizeMenu"
                ? "Organisation de la séance"
                : "Réordonner les exercices"
          }
          onClose={close}
        >
          {dialog === "addMenu" ? (
            <>
              <button onClick={() => setDialog("exercise")}>
                Ajouter un exercice
              </button>
              <button className="danger" onClick={removeExercise}>
                Supprimer l’exercice
              </button>
              <button onClick={close}>Annuler</button>
            </>
          ) : dialog === "organizeMenu" ? (
            <>
              <button onClick={() => setDialog("reorder")}>
                Réordonner les exercices
              </button>
              <button
                onClick={() => {
                  setName(workout.name);
                  setDialog("renameWorkout");
                }}
              >
                Renommer la séance
              </button>
              <button onClick={close}>Annuler</button>
            </>
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
                        ↑
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
                        ↓
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <button onClick={close}>Terminer</button>
            </>
          )}
        </Sheet>
      )}
      {dialog && !isMenu && (
        <Sheet
          title={
            dialog === "exercise" || dialog === "renameExercise"
              ? "Exercice"
              : "Séance"
          }
          onClose={close}
        >
          <form onSubmit={submit}>
            <h2>
              {dialog === "exercise" || dialog === "renameExercise"
                ? "Exercice"
                : "Séance"}
            </h2>
            <label>
              Nom
              <input
                autoFocus
                aria-label="Nom"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
            {dialog === "exercise" && (
              <>
                <label>
                  Nombre de séries initiales
                  <input
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={initialSetCount}
                    onChange={(e) => setInitialSetCount(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Repos par défaut (secondes)
                  <input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    value={rest}
                    onChange={(e) => setRest(e.target.value)}
                    required
                  />
                </label>
              </>
            )}
            <button className="primary">Enregistrer</button>
            <button type="button" onClick={close}>
              Annuler
            </button>
          </form>
        </Sheet>
      )}
      <nav aria-label="Navigation principale">
        <button className="active">Séances</button>
        <button onClick={() => setScreen("list")}>Nutrition</button>
      </nav>
    </main>
  );
}

function WorkoutRow({
  workout,
  onOpen,
  onDelete,
}: {
  workout: Workout;
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
        Supprimer
      </button>
      <button
        className="row workout-card"
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
        <small
          className={`workout-badge ${workout.execution?.status ?? "planned"}`}
        >
          {workout.execution?.status === "completed"
            ? "✓ Terminée"
            : workout.execution
              ? "● En cours"
              : "Préparation"}
        </small>
        <strong>{workout.name}</strong>
        <small>
          {workout.exercises.length} exercice
          {workout.exercises.length > 1 ? "s" : ""}
        </small>
        <span className="row-arrow" aria-hidden="true">
          ›
        </span>
      </button>
    </li>
  );
}

function formatRest(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current
      ?.querySelector<HTMLElement>(
        "input:not(:disabled), button:not(:disabled)",
      )
      ?.focus();
    return () => previous?.focus();
  }, [title]);
  return (
    <div
      className="modal"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
          if (event.key === "Tab") {
            const fields = ref.current?.querySelectorAll<HTMLElement>(
              "button:not(:disabled), input:not(:disabled)",
            );
            if (!fields?.length) return;
            const first = fields[0],
              last = fields[fields.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            }
            if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
