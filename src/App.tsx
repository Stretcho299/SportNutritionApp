import { useEffect, useState } from "react";
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
type Screen = "list" | "detail" | "exercise";
type Dialog =
  | null
  | "workout"
  | "exercise"
  | "set"
  | "editSet"
  | "renameWorkout"
  | "renameExercise";
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
  const [editingSetId, setEditingSetId] = useState("");
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
    setEditingSetId("");
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
    if (dialog === "exercise" && workout && name.trim())
      update(
        workouts.map((w) =>
          w.id === workout!.id ? addExercise(w, name.trim()) : w,
        ),
      );
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
    if (
      (dialog === "set" || dialog === "editSet") &&
      workout &&
      exercise &&
      Number(reps) > 0
    )
      update(
        workouts.map((w) =>
          w.id === workout!.id
            ? {
                ...w,
                exercises: w.exercises.map((x) =>
                  x.id === exercise.id
                    ? dialog === "editSet"
                      ? {
                          ...x,
                          plannedSets: x.plannedSets.map((set) =>
                            set.id === editingSetId
                              ? {
                                  ...set,
                                  weightKg: Number(weight) || 0,
                                  repetitions: Number(reps),
                                  restSeconds:
                                    Number(rest) || defaultRestSeconds,
                                }
                              : set,
                          ),
                        }
                      : addSet(
                          x,
                          Number(weight) || 0,
                          Number(reps),
                          Number(rest) || defaultRestSeconds,
                        )
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
    }
  };
  const removeExercise = () => {
    if (workout && exercise && confirm("Supprimer cet exercice ?")) {
      update(
        workouts.map((w) =>
          w.id === workout!.id
            ? {
                ...w,
                exercises: w.exercises.filter((x) => x.id !== exercise.id),
              }
            : w,
        ),
      );
      setScreen("detail");
    }
  };
  const moveExercise = (from: number, to: number) =>
    workout &&
    update(
      workouts.map((w) =>
        w.id === workout!.id
          ? { ...w, exercises: reorder(w.exercises, from, to) }
          : w,
      ),
    );
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
  return (
    <main className="app-shell">
      <header>
        <p>Sport Nutrition</p>
        <h1>
          {screen === "list"
            ? "Séances"
            : screen === "detail"
              ? workout?.name
              : exercise?.name}
        </h1>
        {screen !== "list" && (
          <button
            className="link"
            onClick={() => setScreen(screen === "exercise" ? "detail" : "list")}
          >
            ‹ Retour
          </button>
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
          <div className="actions">
            <button
              onClick={() => {
                setName(workout.name);
                setDialog("renameWorkout");
              }}
            >
              Renommer
            </button>
            <button onClick={removeWorkout}>Supprimer</button>
          </div>
          <button className="primary" onClick={() => setDialog("exercise")}>
            Ajouter un exercice
          </button>
          <ul>
            {sort(workout.exercises).map((x, i) => (
              <li key={x.id}>
                <button
                  className="row"
                  onClick={() => {
                    setExerciseId(x.id);
                    setScreen("exercise");
                  }}
                >
                  <strong>{x.name}</strong>
                  <small>
                    {x.plannedSets.length} série
                    {x.plannedSets.length > 1 ? "s" : ""} prévue
                    {x.plannedSets.length > 1 ? "s" : ""}
                  </small>
                  <span>›</span>
                </button>
                <div className="order">
                  <button disabled={!i} onClick={() => moveExercise(i, i - 1)}>
                    ↑
                  </button>
                  <button
                    disabled={i === workout.exercises.length - 1}
                    onClick={() => moveExercise(i, i + 1)}
                  >
                    ↓
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      {screen === "exercise" && exercise && (
        <>
          <div className="actions">
            <button
              onClick={() => {
                setName(exercise.name);
                setDialog("renameExercise");
              }}
            >
              Renommer
            </button>
            <button onClick={removeExercise}>Supprimer</button>
          </div>
          <button className="primary" onClick={() => setDialog("set")}>
            Ajouter une série
          </button>
          <ul>
            {sort(exercise.plannedSets).map((s, i) => (
              <li key={s.id}>
                <button
                  className="set"
                  onClick={() => {
                    setEditingSetId(s.id);
                    setWeight(String(s.weightKg));
                    setReps(String(s.repetitions));
                    setRest(String(s.restSeconds));
                    setDialog("editSet");
                  }}
                >
                  Série {i + 1}
                  <small>
                    {s.weightKg} kg · {s.repetitions} répétitions ·{" "}
                    {s.restSeconds}s repos
                  </small>
                </button>
                <div className="order">
                  <button disabled={!i} onClick={() => moveSet(i, i - 1)}>
                    ↑
                  </button>
                  <button
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
                                        plannedSets: x.plannedSets.filter(
                                          (y) => y.id !== s.id,
                                        ),
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
        </>
      )}
      {dialog && (
        <form className="modal" onSubmit={submit}>
          <div>
            <h2>
              {dialog === "set" || dialog === "editSet"
                ? dialog === "editSet"
                  ? "Modifier la série"
                  : "Nouvelle série"
                : dialog.includes("exercise")
                  ? "Exercice"
                  : "Séance"}
            </h2>
            {dialog === "set" || dialog === "editSet" ? (
              <>
                <label>
                  Charge (kg)
                  <input
                    aria-label="Charge"
                    inputMode="decimal"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                  />
                </label>
                <label>
                  Répétitions
                  <input
                    aria-label="Répétitions"
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
          </div>
        </form>
      )}
      <nav>
        <button className="active">Séances</button>
        <button onClick={() => setScreen("list")}>Nutrition</button>
      </nav>
    </main>
  );
}
