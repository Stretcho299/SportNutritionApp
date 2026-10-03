import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type AnimationEvent,
} from "react";
import "./App.css";
import "./redesign-v2.css";
import { Icon } from "./Icon";
import { WorkoutProgress } from "./WorkoutProgress";
import { ActiveWorkoutCapsule } from "./ActiveWorkoutCapsule";
import {
  ConfirmationDialog,
  type ConfirmationRequest,
} from "./ConfirmationDialog";
import { SetValuePicker } from "./SetValuePicker";
import { BottomNavigation } from "./BottomNavigation";
import { BottomSheet, bottomSheetCloseDuration } from "./BottomSheet";
import { ExerciseNavigator } from "./ExerciseNavigator";
import { OrientationGuard } from "./OrientationGuard";
import { pickerValues } from "./pickerValues";
import {
  officialExercises,
  searchExercises,
  muscleGroupLabels,
  equipmentLabels,
  defaultMuscleTargetForGroup,
  muscleTargetLabels,
  muscleTargetGroup,
  createCustomExercise,
  updateCustomExercise,
  deleteCustomExercise,
  type ExerciseDefinition,
  type MuscleGroup,
  type MuscleTarget,
  type Equipment,
} from "./exercises/catalog";
import {
  activateExecutedExercise,
  canReplaceExecutedExercise,
  abandonWorkoutSession,
  addSetToExecution,
  addExercise,
  addExerciseToExecution,
  addSet,
  completeWorkoutExecution,
  createWorkout,
  defaultInitialSetCount,
  defaultRestSeconds,
  hasCompletedWorkoutSession,
  legacyDefaultRestSeconds,
  finishExecutedRest,
  loadWorkoutStore,
  type WorkoutStore,
  removeExecutedExercise,
  removeExecutedSet,
  reorder,
  saveWorkouts,
  saveCustomDefinitions,
  saveCustomDefinitionAndUpdateTemplates,
  replaceExerciseDefinition,
  updateCustomDefinitionInWorkout,
  skipExecutedExercise,
  sort,
  startExecutedSetRest,
  createWorkoutSession,
  setIdsFromSelection,
  updateExecutedSets,
  updatePlannedSetValues,
  type ExecutedSet,
  type WorkoutExecution,
  type Workout,
} from "./storage/database";
type Screen = "list" | "workouts" | "preview" | "detail";
const timestampNow = () => Date.now();
type Dialog =
  | null
  | "workout"
  | "exercise"
  | "catalog"
  | "customExercise"
  | "editCustomExercise"
  | "renameWorkout"
  | "renameExercise"
  | "addMenu"
  | "organizeMenu"
  | "exerciseNotes"
  | "reorder";
export default function App() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [customDefinitions, setCustomDefinitions] = useState<
    ExerciseDefinition[]
  >([]);
  const [selectedDefinition, setSelectedDefinition] =
    useState<ExerciseDefinition | null>(null);
  const [catalogMode, setCatalogMode] = useState<"add" | "replace">("add");
  const [replacementExerciseId, setReplacementExerciseId] = useState<
    string | null
  >(null);
  const [customEditReturn, setCustomEditReturn] = useState<
    "catalog" | "detail"
  >("catalog");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogMuscle, setCatalogMuscle] = useState<MuscleGroup | "">("");
  const [catalogEquipment, setCatalogEquipment] = useState<Equipment | "">("");
  const [customMenuId, setCustomMenuId] = useState<string | null>(null);
  const [customMuscle, setCustomMuscle] = useState<MuscleTarget>(
    defaultMuscleTargetForGroup.pectoraux,
  );
  const [customSecondaries, setCustomSecondaries] = useState<MuscleTarget[]>(
    [],
  );
  const [customEquipment, setCustomEquipment] = useState<Equipment | "">("");
  const [completedTemplateIds, setCompletedTemplateIds] = useState<string[]>(
    [],
  );
  const [screen, setScreen] = useState<Screen>("list");
  const [workoutId, setWorkoutId] = useState("");
  const [exerciseId, setExerciseId] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [dialogClosing, setDialogClosing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [reorderDraftIds, setReorderDraftIds] = useState<string[] | null>(null);
  const [name, setName] = useState("");
  const [initialSetCount, setInitialSetCount] = useState(
    String(defaultInitialSetCount),
  );
  const [rest, setRest] = useState(String(defaultRestSeconds));
  const [permanentNoteDraft, setPermanentNoteDraft] = useState("");
  const [sessionNoteDraft, setSessionNoteDraft] = useState("");
  const [clock, setClock] = useState(Date.now);
  const [headerScrolled, setHeaderScrolled] = useState(false);
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
  const [screenTransition, setScreenTransition] = useState<
    "forward" | "back" | null
  >(null);
  const exerciseTransitionTimeout = useRef<number | undefined>(undefined);
  const dialogCloseTimeout = useRef<number | undefined>(undefined);
  const transitionDialog = (next: Dialog) => {
    window.clearTimeout(dialogCloseTimeout.current);
    dialogCloseTimeout.current = undefined;
    setDialogClosing(false);
    setDialog(next);
  };
  const navigate = (next: Screen, direction: "forward" | "back") => {
    if (next !== screen) setScreenTransition(direction);
    setScreen(next);
  };
  useEffect(() => {
    void loadWorkoutStore().then((store: WorkoutStore) => {
      setCustomDefinitions(store.customDefinitions ?? []);
      setCompletedTemplateIds(
        store.templates
          .filter((template) =>
            hasCompletedWorkoutSession(store.sessions, template.id),
          )
          .map((template) => template.id),
      );
      const active = store.sessions
        .filter(
          (session) =>
            session.status === "inProgress" ||
            session.status === "readyToFinish",
        )
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
                sessionNotes: session.sessionNotes ?? {},
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
  const updateCustomDefinitions = (next: ExerciseDefinition[]) => {
    setCustomDefinitions(next);
    void saveCustomDefinitions(next);
  };
  const catalogResults = searchExercises(
    [...officialExercises, ...customDefinitions],
    {
      query: catalogQuery,
      muscleGroup: catalogMuscle || undefined,
      equipment: catalogEquipment || undefined,
    },
  );
  const customCatalogResults = catalogResults.filter(
    (definition) => definition.source === "custom",
  );
  const officialCatalogResults = catalogResults.filter(
    (definition) => definition.source === "official",
  );
  const openCatalog = (
    mode: "add" | "replace" = "add",
    occurrenceId: string | null = null,
  ) => {
    setCatalogMode(mode);
    setReplacementExerciseId(occurrenceId);
    transitionDialog("catalog");
  };
  const selectDefinition = (definition: ExerciseDefinition) => {
    if (
      catalogMode === "replace" &&
      replacementExerciseId &&
      workout &&
      (!workout.execution ||
        canReplaceExecutedExercise(workout.execution, replacementExerciseId))
    ) {
      const nextWorkout = replaceExerciseDefinition(
        workout,
        replacementExerciseId,
        definition,
      );
      update(
        workouts.map((item) => (item.id === workout.id ? nextWorkout : item)),
      );
      close();
      return;
    }
    if (catalogMode === "replace") return;
    setSelectedDefinition(definition);
    setName(definition.name);
    transitionDialog("exercise");
  };
  const openCustomForm = (
    definition?: ExerciseDefinition,
    returnTo: "catalog" | "detail" = "catalog",
  ) => {
    setSelectedDefinition(definition ?? null);
    setCustomEditReturn(returnTo);
    setName(definition?.name ?? catalogQuery.trim());
    setCustomMuscle(
      definition?.muscleTargets.find((target) => target.role === "primary")
        ?.muscle ?? defaultMuscleTargetForGroup.pectoraux,
    );
    setCustomSecondaries(
      definition?.muscleTargets
        .filter((target) => target.role === "secondary")
        .map((target) => target.muscle) ?? [],
    );
    setCustomEquipment(definition?.equipment[0] ?? "");
    transitionDialog(definition ? "editCustomExercise" : "customExercise");
  };
  const requestCustomDeletion = (definition: ExerciseDefinition) => {
    requestConfirmation({
      title: "Supprimer cet exercice personnalisé ?",
      description: `« ${definition.name} » disparaîtra du catalogue. Les séances et exercices déjà ajoutés seront conservés.`,
      confirmLabel: "Supprimer",
      destructive: true,
      onConfirm: () => {
        updateCustomDefinitions(
          deleteCustomExercise(customDefinitions, definition.id),
        );
        if (selectedDefinition?.id === definition.id)
          setSelectedDefinition(null);
      },
    });
  };
  const workout = workouts.find((w) => w.id === workoutId);
  const activeWorkout = workouts.find(
    (item) =>
      item.execution?.status === "inProgress" ||
      item.execution?.status === "readyToFinish",
  );
  const exercise = workout?.exercises.find((e) => e.id === exerciseId);
  const execution = workout?.execution;
  const clockExecution = activeWorkout?.execution ?? execution;
  const clockEnabled = Boolean(
    clockExecution && clockExecution.status !== "completed",
  );
  const clockSessionId = clockExecution?.sessionId;
  const clockStartedAt = clockExecution?.startedAt;
  const clockExecutionStatus = clockExecution?.status;
  const notePreview =
    (execution && execution.status !== "completed"
      ? workout?.sessionNotes?.[exercise?.id ?? ""]?.trim()
      : "") ||
    exercise?.permanentNote?.trim() ||
    "";
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
    const startedAt = timestampNow();
    setClock(startedAt);
    const session = createWorkoutSession(workout, startedAt, initialExerciseId);
    update(
      workouts.map((item) =>
        item.id === workout.id
          ? {
              ...item,
              execution: session.execution,
              sessionNotes: session.sessionNotes,
            }
          : item,
      ),
    );
  };
  const openExerciseNotes = () => {
    if (!exercise || !workout) return;
    setPermanentNoteDraft(exercise.permanentNote ?? "");
    setSessionNoteDraft(
      execution && execution.status !== "completed"
        ? (workout.sessionNotes?.[exercise.id] ?? "")
        : "",
    );
    transitionDialog("exerciseNotes");
  };
  const editCurrentExercise = () => {
    if (
      !exercise ||
      (execution && !canReplaceExecutedExercise(execution, exercise.id))
    )
      return;
    const source = exercise.definitionSnapshot?.source;
    if (execution) {
      // Legacy occurrences have no catalogue identity; keep them unchanged
      // during execution rather than assigning one implicitly.
      if (source === "official" || source === "custom")
        openCatalog("replace", exercise.id);
      return;
    }
    if (source === "official") {
      openCatalog("replace", exercise.id);
      return;
    }
    if (source === "custom") {
      const definition =
        customDefinitions.find(
          (item) => item.id === exercise.exerciseDefinitionId,
        ) ?? exercise.definitionSnapshot;
      openCustomForm(definition, "detail");
      return;
    }
    setName(exercise.name);
    transitionDialog("renameExercise");
  };
  const startRest = (targetExerciseId: string, targetSetId: string) => {
    if (!execution) return;
    const now = timestampNow();
    setClock(now);
    const currentSet = execution.exercises
      .find((item) => item.exerciseId === targetExerciseId)
      ?.sets.find((item) => item.setId === targetSetId);
    const immediateBase =
      currentSet?.status === "upcoming"
        ? activateExecutedExercise(execution, targetExerciseId)
        : execution;
    updateExecution(
      startExecutedSetRest(immediateBase, targetExerciseId, targetSetId, now),
    );

    // Re-read after the immediate local transition so another tab cannot
    // start from a stale snapshot and overwrite the session's active clock.
    void loadWorkoutStore().then((store) => {
      const latestWorkouts: Workout[] = store.templates.map((template) => {
        const session = store.sessions
          .filter(
            (item) =>
              item.templateId === template.id &&
              (item.status === "inProgress" || item.status === "readyToFinish"),
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
    if (!clockEnabled) return;
    const syncClock = () => setClock(Date.now());
    const syncWhenVisible = () => {
      if (document.visibilityState === "visible") syncClock();
    };
    syncClock();
    const interval = window.setInterval(syncClock, 1000);
    window.addEventListener("focus", syncClock);
    window.addEventListener("pageshow", syncClock);
    document.addEventListener("visibilitychange", syncWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", syncClock);
      window.removeEventListener("pageshow", syncClock);
      document.removeEventListener("visibilitychange", syncWhenVisible);
    };
  }, [clockEnabled, clockSessionId, clockStartedAt, clockExecutionStatus]);
  useEffect(() => {
    const resting = execution?.exercises
      .flatMap((item) => item.sets)
      .find((item) => item.status === "resting");
    const restEndsAt = resting?.restEndsAt;
    if (!restEndsAt) return;
    const tick = () => {
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
          setCompletedTemplateIds((current) =>
            current.includes(workoutId) ? current : [...current, workoutId],
          );
          setWorkouts((current) =>
            current.map((item) =>
              item.id === workoutId ? { ...item, execution: undefined } : item,
            ),
          );
        },
      });
  };
  const abandonWorkout = () => {
    if (!workout || !execution?.sessionId) return;
    const activeWorkoutId = workout.id;
    const sessionId = execution.sessionId;
    requestConfirmation({
      title: "Abandonner la séance ?",
      description:
        "Cette séance sera abandonnée. Votre séance préparée restera disponible pour une prochaine fois.",
      confirmLabel: "Abandonner la séance",
      onConfirm: () => {
        void abandonWorkoutSession(sessionId).then(() => {
          setWorkouts((current) =>
            current.map((item) =>
              item.id === activeWorkoutId
                ? { ...item, execution: undefined }
                : item,
            ),
          );
          setWorkoutId("");
          setExerciseId("");
          close();
          navigate("list", "back");
        });
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
      dialogCloseTimeout.current = undefined;
      setReorderDraftIds(null);
      setName("");
      setInitialSetCount(String(defaultInitialSetCount));
      setRest(String(defaultRestSeconds));
      setSelectedDefinition(null);
      setCatalogMode("add");
      setReplacementExerciseId(null);
      setCatalogQuery("");
      setCatalogMuscle("");
      setCatalogEquipment("");
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
    if (dialog === "exercise" && workout && selectedDefinition) {
      if (
        !Number.isSafeInteger(Number(initialSetCount)) ||
        Number(initialSetCount) <= 0
      )
        return;
      const nextWorkout = addExercise(
        workout,
        selectedDefinition.name,
        Number(initialSetCount),
        Number(rest),
        selectedDefinition,
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
    if (
      (dialog === "customExercise" || dialog === "editCustomExercise") &&
      name.trim()
    ) {
      const input = {
        name: name.trim(),
        primaryMuscle: customMuscle,
        secondaryMuscles: customSecondaries,
        equipment: customEquipment ? [customEquipment] : [],
      };
      const definition =
        dialog === "editCustomExercise" && selectedDefinition
          ? updateCustomExercise(selectedDefinition, input)
          : createCustomExercise(input, [
              ...officialExercises,
              ...customDefinitions,
            ]);
      if (dialog === "customExercise") {
        updateCustomDefinitions([...customDefinitions, definition]);
        selectDefinition(definition);
        return;
      }
      setCustomDefinitions((current) =>
        current.some((item) => item.id === definition.id)
          ? current.map((item) =>
              item.id === definition.id ? definition : item,
            )
          : [...current, definition],
      );
      void saveCustomDefinitionAndUpdateTemplates(definition);
      setWorkouts((current) =>
        current.map((item) =>
          item.execution
            ? item
            : updateCustomDefinitionInWorkout(item, definition),
        ),
      );
      if (customEditReturn === "catalog") transitionDialog("catalog");
      else close();
      return;
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
    if (dialog === "exerciseNotes" && workout && exercise) {
      const permanentNote = permanentNoteDraft.trim() || undefined;
      const sessionNote = sessionNoteDraft.trim();
      update(
        workouts.map((item) => {
          if (item.id !== workout.id) return item;
          const sessionNotes = { ...(item.sessionNotes ?? {}) };
          if (execution && execution.status !== "completed") {
            if (sessionNote) sessionNotes[exercise.id] = sessionNote;
            else delete sessionNotes[exercise.id];
          }
          return {
            ...item,
            exercises: item.exercises.map((target) =>
              target.id === exercise.id ? { ...target, permanentNote } : target,
            ),
            sessionNotes,
          };
        }),
      );
    }
    close();
  };
  const removeWorkout = (id: string) => {
    const target = workouts.find((item) => item.id === id);
    if (!target) return;
    update(workouts.filter((item) => item.id !== id));
    if (workoutId === id) {
      setWorkoutId("");
      setExerciseId("");
      navigate("list", "back");
    }
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
            (exercise.defaultRestSeconds ?? legacyDefaultRestSeconds),
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
        destructive: true,
        onConfirm: remove,
      });
    else remove();
  };
  const saveSetValue = (
    id: string,
    field: "repetitions" | "weightKg" | "restSeconds",
    value: number,
    applyToFollowing = false,
  ) => {
    if (!workout || !exercise || execution?.status === "completed") return;
    const setIds = setIdsFromSelection(
      exercise.plannedSets,
      id,
      applyToFollowing,
    );
    if (setIds.length === 0) return;
    const nextExercise = updatePlannedSetValues(exercise, setIds, field, value);
    const nextExecution = execution
      ? updateExecutedSets(execution, exercise.id, setIds, field, value)
      : undefined;
    update(
      workouts.map((item) =>
        item.id !== workout.id
          ? item
          : {
              ...item,
              exercises: item.exercises.map((currentExercise) =>
                currentExercise.id === exercise.id
                  ? nextExercise
                  : currentExercise,
              ),
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
  const removeExerciseAfterLastSet = () => {
    if (!workout || !exercise) return;
    const ordered = sort(workout.exercises);
    const index = ordered.findIndex((item) => item.id === exercise.id);
    const remaining = ordered
      .filter((item) => item.id !== exercise.id)
      .map((item, position) => ({ ...item, position }));
    const nextExerciseId =
      remaining[index]?.id ?? remaining[index - 1]?.id ?? "";
    update(
      workouts.map((w) =>
        w.id !== workout.id
          ? w
          : {
              ...w,
              exercises: remaining,
              execution: w.execution
                ? removeExecutedExercise(w.execution, exercise.id)
                : undefined,
            },
      ),
    );
    setExerciseId(nextExerciseId);
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
      set.restSeconds !==
        (exercise.defaultRestSeconds ?? legacyDefaultRestSeconds);
    const remove = () => {
      if (exercise.plannedSets.length === 1) {
        removeExerciseAfterLastSet();
        return;
      }
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
    };
    if (hasData)
      requestConfirmation({
        title:
          exercise.plannedSets.length === 1
            ? "Supprimer cet exercice ?"
            : "Supprimer cette série ?",
        description:
          exercise.plannedSets.length === 1
            ? `« ${exercise.name} » sera supprimé de la séance.`
            : "Les répétitions, la charge et le repos de cette série seront supprimés.",
        confirmLabel: "Supprimer",
        destructive: true,
        onConfirm: remove,
      });
    else remove();
  };
  const canMoveExercise = (from: number, to: number) => {
    if (!workout || execution?.status === "completed") return false;
    return (
      from >= 0 &&
      to >= 0 &&
      from < workout.exercises.length &&
      to < workout.exercises.length
    );
  };
  const openReorderSheet = () => {
    if (!workout) return;
    setReorderDraftIds(sort(workout.exercises).map((item) => item.id));
    transitionDialog("reorder");
  };
  const moveReorderDraft = (index: number, delta: -1 | 1) => {
    if (!reorderDraftIds || execution?.status === "completed") return;
    const target = index + delta;
    if (target < 0 || target >= reorderDraftIds.length) return;
    const next = [...reorderDraftIds];
    [next[index], next[target]] = [next[target], next[index]];
    setReorderDraftIds(next);
  };
  const saveReorderDraft = () => {
    if (!workout || !reorderDraftIds) return;
    const byId = new Map(workout.exercises.map((item) => [item.id, item]));
    const exercises = reorderDraftIds
      .map((id) => byId.get(id))
      .filter((item): item is Workout["exercises"][number] => !!item)
      .map((item, position) => ({ ...item, position }));
    update(
      workouts.map((w) =>
        w.id !== workout.id
          ? w
          : {
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
            },
      ),
    );
    setReorderDraftIds(null);
    close();
  };
  const moveExercise = (from: number, to: number) => {
    if (!workout || !canMoveExercise(from, to)) return;
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
  const selectExercise = (nextExerciseId: string, animate = true) => {
    const orderedExercises = sort(workout?.exercises ?? []);
    const previousIndex = orderedExercises.findIndex(
      (item) => item.id === exerciseId,
    );
    const nextIndex = orderedExercises.findIndex(
      (item) => item.id === nextExerciseId,
    );
    if (
      animate &&
      previousIndex >= 0 &&
      nextIndex >= 0 &&
      previousIndex !== nextIndex
    ) {
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
    if (!animate) {
      window.clearTimeout(exerciseTransitionTimeout.current);
      setExerciseTransition("none");
      setOutgoingExerciseVisual(null);
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
  const isActiveWorkoutDetail =
    isWorkoutDetail && workoutId === activeWorkout?.id;
  const isOverlayOpen = !!dialog || !!confirmation || pickerOpen;
  const hasActiveWorkout = !!activeWorkout?.execution;
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
  useEffect(() => {
    if (screen === "detail") return;
    const readScrollPosition = () => {
      const top = document.scrollingElement?.scrollTop ?? window.scrollY;
      setHeaderScrolled(top > 8);
    };
    readScrollPosition();
    window.addEventListener("scroll", readScrollPosition, { passive: true });
    return () => window.removeEventListener("scroll", readScrollPosition);
  }, [screen]);

  const handleWorkoutsTab = () => {
    if (screen !== "list") {
      setScreenTransition(null);
      setScreen("list");
      return;
    }
    const currentScrollTop =
      document.scrollingElement?.scrollTop ?? window.scrollY;
    if (currentScrollTop <= 0) return;
    const reducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    window.scrollTo({ top: 0, behavior: reducedMotion ? "instant" : "smooth" });
  };

  const pageMotionClass = screenTransition ? ` page-${screenTransition}` : "";
  const clearPageMotion = (event: AnimationEvent<HTMLElement>) => {
    if (
      !(event.target instanceof HTMLElement) ||
      event.target.parentElement !== event.currentTarget ||
      (event.animationName !== "page-forward-in" &&
        event.animationName !== "page-back-in")
    ) {
      return;
    }
    const finishedDirection =
      event.animationName === "page-forward-in" ? "forward" : "back";
    setScreenTransition((current) =>
      current === finishedDirection ? null : current,
    );
  };

  return (
    <main
      className={`app-shell screen-${screen}${screen === "detail" && exercise ? " workout-detail" : ""}`}
      onAnimationEndCapture={clearPageMotion}
    >
      <header
        className={`workout-control${screen === "list" ? " home-header" : ""}`}
        data-compact-header={screen !== "detail" ? "true" : undefined}
        data-scrolled={
          screen !== "detail" && headerScrolled ? "true" : undefined
        }
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
                else if (screen === "detail" && workout && !workout.execution)
                  navigate(
                    completedTemplateIds.includes(workout.id)
                      ? "preview"
                      : "workouts",
                    "back",
                  );
                else navigate("list", "back");
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
                  onClick={() => transitionDialog("addMenu")}
                >
                  <Icon name="plus" />
                </button>
                <button
                  aria-label="Réorganiser les exercices"
                  onClick={() => transitionDialog("organizeMenu")}
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
          className={`workout-library dashboard${pageMotionClass}`}
          aria-label="Entraînement"
        >
          <div className="library-heading">
            <span>Votre espace d’entraînement</span>
          </div>
          <div className="dashboard-grid">
            <button
              className="dashboard-tile sessions-tile"
              aria-label="Ouvrir Mes séances"
              onClick={() => navigate("workouts", "forward")}
            >
              <span className="dashboard-tile-art" aria-hidden="true">
                <Icon name="dumbbell" size={72} strokeWidth={1.45} />
                <Icon name="list" size={28} />
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
              <small>Bientôt</small>
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
          className={`workout-library sessions-library${pageMotionClass}`}
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
              onClick={() => transitionDialog("workout")}
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
                    navigate(
                      completedTemplateIds.includes(item.id)
                        ? "preview"
                        : "detail",
                      "forward",
                    );
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
          className={`workout-preview${pageMotionClass}`}
          aria-label={`Aperçu de ${workout.name}`}
        >
          <div className="preview-hero">
            <span className="preview-art" aria-hidden="true">
              <Icon name="dumbbell" size={34} strokeWidth={1.7} />
            </span>
            <div>
              <span>Prêt pour votre séance ?</span>
              <h2>{workout.name}</h2>
              {!completedTemplateIds.includes(workout.id) && (
                <small className="preview-first-session">Première séance</small>
              )}
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
            {completedTemplateIds.includes(workout.id) && (
              <>
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
              </>
            )}
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
              <Icon name="edit" size={16} /> PRÉPARER LA SÉANCE
            </button>
          </div>
        </section>
      )}
      {screen === "detail" && workout && (
        <>
          {workout.exercises.length === 0 && (
            <section className={`empty${pageMotionClass}`}>
              <h2>Aucun exercice</h2>
              <span>
                Ajoutez votre premier exercice pour préparer cette séance.
              </span>
              <button className="primary" onClick={() => openCatalog()}>
                Ajouter un exercice
              </button>
            </section>
          )}
          {exercise && (
            <div
              className={`workout-preparation transition-${exerciseTransition}${pageMotionClass}`}
            >
              <div className="workout-fixed-zones">
                <ExerciseNavigator
                  exercises={sort(workout.exercises)}
                  selectedExerciseId={exerciseId}
                  statusFor={(id) => executionExercise(id)?.status}
                  onSelect={selectExercise}
                  onReorder={moveExercise}
                  canDrag={(index) => canMoveExercise(index, index)}
                  canReorder={canMoveExercise}
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
                        <button
                          className={
                            "exercise-note-trigger" +
                            (notePreview ? " has-note" : "")
                          }
                          aria-label={
                            notePreview
                              ? "Notes de l’exercice"
                              : "Ajouter une note"
                          }
                          disabled={execution?.status === "completed"}
                          onClick={openExerciseNotes}
                        >
                          <Icon name="file-text" size={14} />
                          <span>{notePreview || "Ajouter une note"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="exercise-menu">
                    <button
                      aria-label={
                        execution &&
                        exercise.definitionSnapshot?.source !== "official" &&
                        exercise.definitionSnapshot?.source !== "custom"
                          ? "Exercice non modifiable pendant la séance"
                          : execution ||
                              exercise.definitionSnapshot?.source === "official"
                            ? "Changer l’exercice"
                            : exercise.definitionSnapshot?.source === "custom"
                              ? "Modifier l’exercice"
                              : "Renommer l’exercice"
                      }
                      title={
                        execution
                          ? exercise.definitionSnapshot?.source !==
                              "official" &&
                            exercise.definitionSnapshot?.source !== "custom"
                            ? "Exercice legacy non modifiable pendant la séance"
                            : !canReplaceExecutedExercise(
                                  execution,
                                  exercise.id,
                                )
                              ? "Exercice non modifiable après validation d’une série"
                              : undefined
                          : undefined
                      }
                      disabled={
                        !!execution &&
                        (exercise.definitionSnapshot?.source !== "official" &&
                        exercise.definitionSnapshot?.source !== "custom"
                          ? true
                          : !canReplaceExecutedExercise(execution, exercise.id))
                      }
                      onClick={editCurrentExercise}
                    >
                      <Icon name="edit" size={18} />
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
                      <button className="danger" onClick={removeExercise}>
                        Supprimer
                      </button>
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
                          onOverlayChange={setPickerOpen}
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
                          followingSeriesLabel={
                            i < displayedSets.length - 1
                              ? `Séries ${i + 1} → ${displayedSets.length}`
                              : undefined
                          }
                          onSave={(value, applyToFollowing) =>
                            saveSetValue(
                              s.id,
                              "repetitions",
                              value,
                              applyToFollowing,
                            )
                          }
                        />
                        <SetValuePicker
                          onOverlayChange={setPickerOpen}
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
                          followingSeriesLabel={
                            i < displayedSets.length - 1
                              ? `Séries ${i + 1} → ${displayedSets.length}`
                              : undefined
                          }
                          onSave={(value, applyToFollowing) =>
                            saveSetValue(
                              s.id,
                              "weightKg",
                              value,
                              applyToFollowing,
                            )
                          }
                        />
                        <SetValuePicker
                          onOverlayChange={setPickerOpen}
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
                          followingSeriesLabel={
                            i < displayedSets.length - 1
                              ? `Séries ${i + 1} → ${displayedSets.length}`
                              : undefined
                          }
                          onSave={(value, applyToFollowing) =>
                            saveSetValue(
                              s.id,
                              "restSeconds",
                              value,
                              applyToFollowing,
                            )
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
                          <button
                            className="danger"
                            onClick={() => removeSet(s.id)}
                          >
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
          key={dialog}
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
                <button onClick={() => openCatalog()}>
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
            </div>
          ) : dialog === "organizeMenu" ? (
            <div className="action-sheet">
              <h2>Organisation</h2>
              <div className="action-sheet-menu">
                <button onClick={openReorderSheet}>
                  <span className="action-sheet-icon" aria-hidden="true">
                    <Icon name="reorder" size={19} />
                  </span>
                  <span>Réordonner les exercices</span>
                  <Icon name="chevron-right" size={17} />
                </button>
                <button
                  onClick={() => {
                    setName(workout.name);
                    transitionDialog("renameWorkout");
                  }}
                >
                  <span className="action-sheet-icon" aria-hidden="true">
                    <Icon name="edit" size={18} />
                  </span>
                  <span>Renommer la séance</span>
                  <Icon name="chevron-right" size={17} />
                </button>
                {(execution?.status === "inProgress" ||
                  execution?.status === "readyToFinish") && (
                  <button className="danger" onClick={abandonWorkout}>
                    <span className="action-sheet-icon" aria-hidden="true">
                      <Icon name="trash" size={18} />
                    </span>
                    <span>Abandonner la séance</span>
                    <Icon name="chevron-right" size={17} />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <h2>Réordonner les exercices</h2>
              {workout.exercises.length === 0 && (
                <p>Aucun exercice à réordonner.</p>
              )}
              <ul aria-label="Ordre des exercices" className="reorder-list">
                {(
                  reorderDraftIds ??
                  sort(workout.exercises).map((item) => item.id)
                )
                  .map((id) => workout.exercises.find((item) => item.id === id))
                  .filter(
                    (item): item is Workout["exercises"][number] => !!item,
                  )
                  .map((x, i, ordered) => (
                    <li key={x.id}>
                      <strong>{x.name}</strong>
                      <div className="order">
                        <button
                          aria-label={`Monter ${x.name}`}
                          disabled={
                            i === 0 || execution?.status === "completed"
                          }
                          onClick={() => moveReorderDraft(i, -1)}
                        >
                          <Icon name="chevron-up" />
                        </button>
                        <button
                          aria-label={`Descendre ${x.name}`}
                          disabled={
                            i === ordered.length - 1 ||
                            execution?.status === "completed"
                          }
                          onClick={() => moveReorderDraft(i, 1)}
                        >
                          <Icon name="chevron-down" />
                        </button>
                      </div>
                    </li>
                  ))}
              </ul>
              <button
                className="primary reorder-save"
                onClick={saveReorderDraft}
              >
                ENREGISTRER
              </button>
            </>
          )}
        </BottomSheet>
      )}
      {dialog === "catalog" && (
        <BottomSheet
          key={`catalog-${catalogMode}`}
          title={
            catalogMode === "replace"
              ? "Changer l’exercice"
              : "Catalogue d’exercices"
          }
          className="catalog-dialog"
          closing={dialogClosing}
          onClose={close}
        >
          <div className="catalog-sheet">
            <h2>
              {catalogMode === "replace"
                ? "Changer l’exercice"
                : "Ajouter un exercice"}
            </h2>
            <label className="catalog-search-label">
              Rechercher
              <span className="catalog-search-icon">
                <Icon name="search" size={17} />
              </span>
              <input
                aria-label="Rechercher un exercice"
                type="search"
                value={catalogQuery}
                onChange={(event) => setCatalogQuery(event.target.value)}
                autoComplete="off"
              />
            </label>
            <div className="catalog-filters">
              <label>
                Muscle
                <select
                  aria-label="Filtrer par muscle"
                  className={catalogMuscle ? "is-filtered" : ""}
                  value={catalogMuscle}
                  onChange={(event) =>
                    setCatalogMuscle(event.target.value as MuscleGroup | "")
                  }
                >
                  <option value="">Tous les muscles</option>
                  {Object.entries(muscleGroupLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Matériel
                <select
                  aria-label="Filtrer par matériel"
                  className={catalogEquipment ? "is-filtered" : ""}
                  value={catalogEquipment}
                  onChange={(event) =>
                    setCatalogEquipment(event.target.value as Equipment | "")
                  }
                >
                  <option value="">Tout le matériel</option>
                  {Object.entries(equipmentLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <ul className="catalog-results" aria-label="Résultats du catalogue">
              {[
                { title: "Mes exercices", items: customCatalogResults },
                { title: "Catalogue", items: officialCatalogResults },
              ]
                .filter((section) => section.items.length > 0)
                .map((section) => (
                  <li className="catalog-section" key={section.title}>
                    <div className="catalog-section-heading">
                      <h3>{section.title}</h3>
                      <span>{section.items.length}</span>
                    </div>
                    <ul className="catalog-section-list">
                      {section.items.map((definition) => (
                        <li key={definition.id}>
                          <div className="catalog-card">
                            <button
                              type="button"
                              className="catalog-result"
                              aria-label={`${definition.name}, ${definition.muscleTargets
                                .filter((target) => target.role === "primary")
                                .map(
                                  (target) => muscleTargetLabels[target.muscle],
                                )
                                .join(", ")} · ${
                                definition.equipment
                                  .map(
                                    (equipment) => equipmentLabels[equipment],
                                  )
                                  .join(", ") || "Sans matériel"
                              }`}
                              onClick={() => selectDefinition(definition)}
                            >
                              <span
                                className="catalog-exercise-visual"
                                data-illustration-id={definition.illustrationId}
                                aria-hidden="true"
                              >
                                <Icon name="dumbbell" size={24} />
                              </span>
                              <span className="catalog-result-copy">
                                <strong>{definition.name}</strong>
                                <small>
                                  {definition.muscleTargets
                                    .filter(
                                      (target) => target.role === "primary",
                                    )
                                    .map(
                                      (target) =>
                                        muscleTargetLabels[target.muscle],
                                    )
                                    .join(", ")}{" "}
                                  ·{" "}
                                  {definition.equipment
                                    .map(
                                      (equipment) => equipmentLabels[equipment],
                                    )
                                    .join(", ") || "Sans matériel"}
                                </small>
                              </span>
                            </button>
                            {definition.source === "custom" && (
                              <div
                                className="catalog-custom-menu-wrap"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  className="catalog-custom-menu-trigger"
                                  aria-label={`Options ${definition.name}`}
                                  aria-haspopup="menu"
                                  aria-expanded={customMenuId === definition.id}
                                  onClick={() =>
                                    setCustomMenuId((current) =>
                                      current === definition.id
                                        ? null
                                        : definition.id,
                                    )
                                  }
                                >
                                  <Icon name="more" size={19} />
                                </button>
                                {customMenuId === definition.id && (
                                  <div
                                    className="catalog-custom-menu"
                                    role="menu"
                                    aria-label={`Actions ${definition.name}`}
                                  >
                                    <button
                                      type="button"
                                      role="menuitem"
                                      aria-label={`Modifier ${definition.name}`}
                                      onClick={() => {
                                        setCustomMenuId(null);
                                        openCustomForm(definition);
                                      }}
                                    >
                                      Modifier
                                    </button>
                                    <button
                                      type="button"
                                      role="menuitem"
                                      className="danger"
                                      aria-label={`Supprimer ${definition.name}`}
                                      onClick={() => {
                                        setCustomMenuId(null);
                                        requestCustomDeletion(definition);
                                      }}
                                    >
                                      Supprimer
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              {catalogResults.length === 0 && (
                <li className="catalog-empty">Aucun exercice trouvé</li>
              )}
            </ul>
            <button
              type="button"
              className="catalog-create"
              onClick={() => openCustomForm()}
            >
              + Créer un exercice personnalisé
            </button>
          </div>
        </BottomSheet>
      )}
      {(dialog === "customExercise" || dialog === "editCustomExercise") && (
        <BottomSheet
          key={dialog}
          title={
            dialog === "customExercise"
              ? "Créer un exercice personnalisé"
              : "Modifier un exercice personnalisé"
          }
          closing={dialogClosing}
          onClose={close}
        >
          <form className="sheet-form custom-exercise-form" onSubmit={submit}>
            <h2>
              {dialog === "customExercise"
                ? "Créer un exercice personnalisé"
                : "Modifier un exercice personnalisé"}
            </h2>
            <label>
              Nom
              <input
                aria-label="Nom"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </label>
            <label>
              Muscle principal
              <select
                aria-label="Muscle principal"
                value={customMuscle}
                onChange={(event) => {
                  const nextPrimary = event.target.value as MuscleTarget;
                  setCustomMuscle(nextPrimary);
                  setCustomSecondaries((current) =>
                    current.filter((muscle) => muscle !== nextPrimary),
                  );
                }}
                required
              >
                {Object.entries(muscleTargetLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label} (
                    {
                      muscleGroupLabels[
                        muscleTargetGroup[value as MuscleTarget]
                      ]
                    }
                    )
                  </option>
                ))}
              </select>
            </label>
            <details className="custom-secondary-picker">
              <summary>
                Muscles secondaires ({customSecondaries.length})
              </summary>
              <div
                className="custom-secondary-options"
                role="group"
                aria-label="Muscles secondaires"
              >
                {Object.entries(muscleTargetLabels)
                  .filter(([value]) => value !== customMuscle)
                  .map(([value, label]) => {
                    const muscle = value as MuscleTarget;
                    return (
                      <label key={muscle}>
                        <input
                          type="checkbox"
                          checked={customSecondaries.includes(muscle)}
                          onChange={(event) =>
                            setCustomSecondaries((current) =>
                              event.target.checked
                                ? [...new Set([...current, muscle])]
                                : current.filter((item) => item !== muscle),
                            )
                          }
                        />
                        <span>{label}</span>
                      </label>
                    );
                  })}
              </div>
            </details>
            <label>
              Matériel
              <select
                aria-label="Matériel"
                value={customEquipment}
                onChange={(event) =>
                  setCustomEquipment(event.target.value as Equipment | "")
                }
              >
                <option value="">Aucun</option>
                {Object.entries(equipmentLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary">Enregistrer</button>
          </form>
        </BottomSheet>
      )}
      {dialog &&
        !isMenu &&
        dialog !== "catalog" &&
        dialog !== "customExercise" &&
        dialog !== "editCustomExercise" && (
          <BottomSheet
            key={dialog}
            title={
              dialog === "exerciseNotes"
                ? "Notes de l’exercice"
                : dialog === "exercise" || dialog === "renameExercise"
                  ? "Exercice"
                  : "Séance"
            }
            closing={dialogClosing}
            onClose={close}
          >
            <form
              className={
                dialog === "exerciseNotes"
                  ? "sheet-form notes-form"
                  : "sheet-form"
              }
              onSubmit={submit}
            >
              <h2>
                {dialog === "exerciseNotes"
                  ? "Notes de l’exercice"
                  : dialog === "exercise" || dialog === "renameExercise"
                    ? "Exercice"
                    : "Séance"}
              </h2>
              {dialog === "exerciseNotes" ? (
                <>
                  <div className="exercise-note-field">
                    <label htmlFor="exercise-permanent-note">
                      NOTE PERMANENTE
                    </label>
                    <textarea
                      id="exercise-permanent-note"
                      rows={2}
                      value={permanentNoteDraft}
                      disabled={execution?.status === "completed"}
                      onChange={(event) =>
                        setPermanentNoteDraft(event.target.value)
                      }
                    />
                    <small>Reprise dans les prochaines séances</small>
                  </div>
                  <div className="exercise-note-field">
                    <label htmlFor="exercise-session-note">
                      NOTE DE CETTE SÉANCE
                    </label>
                    <textarea
                      id="exercise-session-note"
                      rows={2}
                      value={sessionNoteDraft}
                      disabled={!execution || execution.status === "completed"}
                      onChange={(event) =>
                        setSessionNoteDraft(event.target.value)
                      }
                    />
                    <small>
                      {execution && execution.status !== "completed"
                        ? "Uniquement pour cette séance"
                        : "Disponible pendant une séance"}
                    </small>
                  </div>
                </>
              ) : (
                <>
                  {dialog === "exercise" ? (
                    <section
                      className="selected-exercise-card"
                      aria-label="Exercice sélectionné"
                    >
                      <span>EXERCICE SÉLECTIONNÉ</span>
                      <strong>{selectedDefinition?.name}</strong>
                      <small>
                        {selectedDefinition?.muscleTargets
                          .filter((target) => target.role === "primary")
                          .map((target) => muscleTargetLabels[target.muscle])
                          .join(", ")}{" "}
                        ·{" "}
                        {selectedDefinition?.equipment
                          .map((item) => equipmentLabels[item])
                          .join(", ") || "Sans matériel"}
                      </small>
                      <button type="button" onClick={() => openCatalog()}>
                        Changer
                      </button>
                    </section>
                  ) : (
                    <label>
                      Nom
                      <input
                        aria-label="Nom"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        required
                      />
                    </label>
                  )}
                  {dialog === "exercise" && (
                    <div className="compact-form-fields">
                      <SetValuePicker
                        onOverlayChange={setPickerOpen}
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
                        onOverlayChange={setPickerOpen}
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
                </>
              )}
              <button
                className="primary"
                disabled={execution?.status === "completed"}
              >
                {dialog === "exerciseNotes" ? "ENREGISTRER" : "Enregistrer"}
              </button>
            </form>
          </BottomSheet>
        )}
      <BottomNavigation
        onWorkouts={handleWorkoutsTab}
        isModalOpen={isOverlayOpen}
      />
      {hasActiveWorkout && activeWorkout?.execution && (
        <ActiveWorkoutCapsule
          name={activeWorkout.name}
          execution={activeWorkout.execution}
          now={clock}
          visible={!isActiveWorkoutDetail && !isOverlayOpen}
          onResume={() => {
            setWorkoutId(activeWorkout.id);
            setExerciseId(sort(activeWorkout.exercises)[0]?.id ?? "");
            navigate("detail", "forward");
          }}
        />
      )}
      <OrientationGuard />
    </main>
  );
}

const maxWorkoutSwipeOvershoot = 18;
const workoutSwipeDamping = 70;

function getResistedWorkoutSwipeOffset(rawOffset: number, revealWidth: number) {
  const distance = Math.max(0, -rawOffset);
  if (distance <= revealWidth) return -distance;

  const overshoot = distance - revealWidth;
  const resistedOvershoot =
    maxWorkoutSwipeOvershoot * (1 - Math.exp(-overshoot / workoutSwipeDamping));
  return -(revealWidth + resistedOvershoot);
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
  const [dragging, setDragging] = useState(false);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const gesture = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startTime: number;
    baseOffset: number;
    mode: "pending" | "horizontal" | "vertical";
  } | null>(null);
  const moved = useRef(false);
  const revealWidth = 102;
  const settle = (nextOpen: boolean) => {
    setOpen(nextOpen);
    setDragOffsetX(nextOpen ? -revealWidth : 0);
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
      className={
        "workout-swipe" +
        (open ? " open" : "") +
        (dragging ? " is-dragging" : "")
      }
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        gesture.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          startTime: event.timeStamp,
          baseOffset: open ? -revealWidth : 0,
          mode: "pending",
        };
        moved.current = false;
      }}
      onPointerMove={(event) => {
        const active = gesture.current;
        if (!active || active.pointerId !== event.pointerId) return;
        const dx = event.clientX - active.startX;
        const dy = event.clientY - active.startY;
        if (active.mode === "pending") {
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
          if (Math.abs(dy) > Math.abs(dx)) {
            active.mode = "vertical";
            moved.current = true;
            return;
          }
          if (Math.abs(dx) < Math.abs(dy) * 1.15) return;
          active.mode = "horizontal";
          moved.current = true;
          setDragging(true);
          if (typeof event.currentTarget.setPointerCapture === "function") {
            try {
              event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
              // Pointer capture may be unavailable in test environments.
            }
          }
        }
        if (active.mode !== "horizontal") return;
        const nextOffset = getResistedWorkoutSwipeOffset(
          active.baseOffset + dx,
          revealWidth,
        );
        setDragOffsetX(nextOffset);
      }}
      onPointerUp={(event) => {
        const active = gesture.current;
        if (!active || active.pointerId !== event.pointerId) return;
        if (active.mode === "horizontal") {
          const dx = event.clientX - active.startX;
          const elapsed = Math.max(1, event.timeStamp - active.startTime);
          const velocityX = dx / elapsed;
          const offset = Math.max(
            -revealWidth,
            Math.min(0, active.baseOffset + dx),
          );
          const flickOpen = dx < -32 && velocityX < -0.55;
          const flickClosed = dx > 32 && velocityX > 0.55;
          settle(flickOpen || (!flickClosed && offset <= -revealWidth * 0.42));
          setDragging(false);
        }
        gesture.current = null;
      }}
      onPointerCancel={() => {
        gesture.current = null;
        setDragging(false);
        settle(open);
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
        style={{ transform: `translateX(${dragOffsetX}px)` }}
        onClick={() => {
          if (moved.current) {
            moved.current = false;
            return;
          }
          if (open) {
            settle(false);
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
