import { useEffect, useRef, useState } from "react";
import "./App.css";
import {
  addExercise,
  addSet,
  createWorkout,
  defaultRestSeconds,
  loadWorkouts,
  reorder,
  saveWorkouts,
  sort,
  type Workout,
} from "./storage/database";
type Screen = "list" | "detail";
type Dialog =
  | null
  | "workout"
  | "exercise"
  | "set"
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
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [rest, setRest] = useState(String(defaultRestSeconds));
  useEffect(() => {
    void loadWorkouts().then(setWorkouts);
  }, []);
  const update = (next: Workout[]) => {
    setWorkouts(next);
    void saveWorkouts(next);
  };
  const workout = workouts.find((w) => w.id === workoutId);
  const exercise = workout?.exercises.find((e) => e.id === exerciseId);
  const close = () => {
    setDialog(null);
    setName("");
    setWeight("");
    setReps("");
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
      const nextWorkout = addExercise(workout, name.trim());
      update(workouts.map((w) => (w.id === workout.id ? nextWorkout : w)));
      if (!exercise) setExerciseId(nextWorkout.exercises.at(-1)!.id);
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
    if (dialog === "set" && workout && exercise && Number(reps) > 0)
      update(
        workouts.map((w) =>
          w.id === workout.id
            ? {
                ...w,
                exercises: w.exercises.map((x) =>
                  x.id === exercise.id
                    ? addSet(x, Number(weight), Number(reps), Number(rest))
                    : x,
                ),
              }
            : w,
        ),
      );
    close();
  };
  const removeWorkout = () => {
    if (workout && confirm("Supprimer cette séance ?")) {
      update(workouts.filter((w) => w.id !== workout.id));
      setScreen("list");
      close();
    }
  };
  const removeExercise = () => {
    if (workout && exercise && confirm("Supprimer cet exercice ?")) {
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
    }
  };
  const moveSet = (from: number, to: number) =>
    workout &&
    exercise &&
    update(
      workouts.map((w) =>
        w.id === workout!.id
          ? {
              ...w,
              exercises: w.exercises.map((x) =>
                x.id === exercise.id
                  ? { ...x, plannedSets: reorder(x.plannedSets, from, to) }
                  : x,
              ),
            }
          : w,
      ),
    );
  const editSet = (
    id: string,
    field: "repetitions" | "weightKg" | "restSeconds",
    value: number,
  ) => {
    if (!workout || !exercise) return;
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
  const moveExercise = (from: number, to: number) => {
    if (!workout) return;
    update(
      workouts.map((w) =>
        w.id === workout.id
          ? { ...w, exercises: reorder(w.exercises, from, to) }
          : w,
      ),
    );
  };
  const isMenu =
    dialog === "addMenu" || dialog === "organizeMenu" || dialog === "reorder";
  return (
    <main className="app-shell">
      <header className="workout-control">
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
        {screen === "detail" && (
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
            <ul>
              {workouts.map((w) => (
                <li key={w.id}>
                  <button
                    className="row"
                    onClick={() => {
                      setWorkoutId(w.id);
                      setExerciseId(sort(w.exercises)[0]?.id ?? "");
                      setScreen("detail");
                    }}
                  >
                    <strong>{w.name}</strong>
                    <small>
                      {w.exercises.length} exercice
                      {w.exercises.length > 1 ? "s" : ""}
                    </small>
                    <span>›</span>
                  </button>
                </li>
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
            <>
              <ul className="exercise-tabs" aria-label="Exercices">
                {sort(workout.exercises).map((x, i) => (
                  <li
                    className={x.id === exerciseId ? "selected" : ""}
                    key={x.id}
                  >
                    <button
                      className="row"
                      aria-pressed={x.id === exerciseId}
                      onClick={() => setExerciseId(x.id)}
                    >
                      <strong>{x.name}</strong>
                      <small>Exercice {i + 1}</small>
                      <span>{i + 1}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <section className="exercise-hero">
                <div className="exercise-illustration" aria-hidden="true">
                  ✦
                </div>
                <div>
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
                  <button onClick={removeExercise}>Supprimer</button>
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
            </>
          )}
        </>
      )}
      {screen === "detail" && exercise && (
        <>
          <section
            className="planned-sets"
            aria-label={`Séries de ${exercise.name}`}
          >
            <ul>
              {sort(exercise.plannedSets).map((s, i) => (
                <li className="set-block" key={s.id}>
                  <h3>SÉRIE {i + 1}</h3>
                  <p className="set-exercise-name">{exercise.name}</p>
                  <p className="set-advanced">
                    Paramètres avancés <span>À venir</span>
                  </p>
                  <SetField
                    label="Répétitions"
                    value={s.repetitions}
                    min={1}
                    step={1}
                    onSave={(value) => editSet(s.id, "repetitions", value)}
                  />
                  <SetField
                    label="Charge (kg)"
                    value={s.weightKg}
                    min={0}
                    step="any"
                    onSave={(value) => editSet(s.id, "weightKg", value)}
                  />
                  <SetField
                    label="Repos (secondes)"
                    value={s.restSeconds}
                    min={0}
                    step={1}
                    onSave={(value) => editSet(s.id, "restSeconds", value)}
                  />
                  <p className="rest-timer">
                    {formatRest(s.restSeconds)} · Repos prévu
                  </p>
                  <div className="order">
                    <button
                      aria-label={`Monter la série ${i + 1}`}
                      disabled={!i}
                      onClick={() => moveSet(i, i - 1)}
                    >
                      ↑
                    </button>
                    <button
                      aria-label={`Descendre la série ${i + 1}`}
                      disabled={i === exercise.plannedSets.length - 1}
                      onClick={() => moveSet(i, i + 1)}
                    >
                      ↓
                    </button>
                    <button
                      onClick={() =>
                        update(
                          workouts.map((w) =>
                            w.id === workout!.id
                              ? {
                                  ...w,
                                  exercises: w.exercises.map((x) =>
                                    x.id === exercise.id
                                      ? {
                                          ...x,
                                          plannedSets: sort(x.plannedSets)
                                            .filter((y) => y.id !== s.id)
                                            .map((y, position) => ({
                                              ...y,
                                              position,
                                            })),
                                        }
                                      : x,
                                  ),
                                }
                              : w,
                          ),
                        )
                      }
                    >
                      Supprimer
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <button className="primary" onClick={() => setDialog("set")}>
              + Ajouter une série
            </button>
          </section>
        </>
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
              <button className="danger" onClick={removeWorkout}>
                Supprimer la séance
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
                        disabled={i === 0}
                        onClick={() => moveExercise(i, i - 1)}
                      >
                        ↑
                      </button>
                      <button
                        aria-label={`Descendre ${x.name}`}
                        disabled={i === workout.exercises.length - 1}
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
            dialog === "set"
              ? "Nouvelle série"
              : dialog === "exercise" || dialog === "renameExercise"
                ? "Exercice"
                : "Séance"
          }
          onClose={close}
        >
          <form onSubmit={submit}>
            <h2>
              {dialog === "set"
                ? "Nouvelle série"
                : dialog === "exercise" || dialog === "renameExercise"
                  ? "Exercice"
                  : "Séance"}
            </h2>
            {dialog === "set" ? (
              <>
                <label>
                  Charge (kg)
                  <input
                    aria-label="Charge"
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                  />
                </label>
                <label>
                  Répétitions
                  <input
                    aria-label="Répétitions"
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={reps}
                    onChange={(e) => setReps(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Repos (secondes)
                  <input
                    aria-label="Repos"
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
            ) : (
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
            )}
            <button className="primary">Enregistrer</button>
            <button type="button" onClick={close}>
              Annuler
            </button>
          </form>
        </Sheet>
      )}
      <nav>
        <button className="active">Séances</button>
        <button onClick={() => setScreen("list")}>Nutrition</button>
      </nav>
    </main>
  );
}

function formatRest(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function SetField({
  label,
  value,
  min,
  step,
  onSave,
}: {
  label: string;
  value: number;
  min: number;
  step: number | "any";
  onSave: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label className="set-field">
      {label}
      <input
        type="number"
        min={min}
        step={step}
        required
        inputMode={step === "any" ? "decimal" : "numeric"}
        value={draft ?? String(value)}
        onChange={(event) => {
          setDraft(event.target.value);
          if (event.target.validity.valid && event.target.value !== "")
            onSave(event.target.valueAsNumber);
        }}
        onBlur={() => setDraft(null)}
      />
    </label>
  );
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
