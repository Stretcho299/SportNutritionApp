import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import App from "./App";
import { __storageKey, type Workout } from "./storage/database";

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

const storedWorkouts = (): Workout[] =>
  JSON.parse(localStorage.getItem(__storageKey) ?? "[]");
async function openEmptyWorkout() {
  const view = render(<App />);
  await screen.findByText("Aucune séance");
  fireEvent.click(screen.getByText("Créer une séance"));
  fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Push" } });
  fireEvent.click(screen.getByText("Enregistrer"));
  expect(storedWorkouts()[0].name).toBe("Push");
  fireEvent.click(screen.getByText("Push"));
  return view;
}
function openAddMenu() {
  screen.getByLabelText("Gérer les exercices").focus();
  fireEvent.click(screen.getByLabelText("Gérer les exercices"));
  return screen.getByRole("dialog", { name: "Actions de la séance" });
}
function openOrganizeMenu() {
  fireEvent.click(screen.getByLabelText("Réorganiser les exercices"));
  return screen.getByRole("dialog", { name: "Organisation de la séance" });
}
function createExercise(name: string, count = 1, rest = 90) {
  fireEvent.click(within(openAddMenu()).getByText("Ajouter un exercice"));
  fireEvent.change(screen.getByLabelText("Nom"), { target: { value: name } });
  fireEvent.change(screen.getByLabelText("Nombre de séries initiales"), {
    target: { value: String(count) },
  });
  fireEvent.change(screen.getByLabelText("Repos par défaut (secondes)"), {
    target: { value: String(rest) },
  });
  fireEvent.click(screen.getByText("Enregistrer"));
}
function fillSet(weight: string, index = 0) {
  fireEvent.change(screen.getAllByLabelText("Charge (kg)")[index], {
    target: { value: weight },
  });
  fireEvent.change(screen.getAllByLabelText("Répétitions")[index], {
    target: { value: "8" },
  });
}
function selectExercise(name: string) {
  fireEvent.click(
    within(screen.getByRole("list", { name: "Exercices" })).getByRole(
      "button",
      { name: new RegExp(`^${name}`) },
    ),
  );
}
const seriesRegion = (name: string) =>
  screen.getByRole("region", { name: `Séries de ${name}` });

it("shows a new workout without zones 1, 2 and 3", async () => {
  await openEmptyWorkout();
  expect(
    screen.getByRole("heading", { name: "Aucun exercice" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("list", { name: "Exercices" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText("EXERCICE SÉLECTIONNÉ")).not.toBeInTheDocument();
  expect(screen.queryByText("Options avancées")).not.toBeInTheDocument();
  expect(screen.queryByText("+ Ajouter une série")).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("Ajouter un exercice"));
  expect(screen.getByLabelText("Nom")).toBeInTheDocument();
});

it("exposes exactly the requested actions in each header sheet", async () => {
  await openEmptyWorkout();
  expect(screen.queryByText("Renommer la séance")).not.toBeInTheDocument();
  expect(screen.queryByText("Supprimer la séance")).not.toBeInTheDocument();
  let menu = openAddMenu();
  expect(
    within(menu)
      .getAllByRole("button")
      .map((b) => b.textContent),
  ).toEqual(["Ajouter un exercice", "Supprimer l’exercice", "Annuler"]);
  expect(within(menu).getByText("Ajouter un exercice")).toHaveFocus();
  fireEvent.click(within(menu).getByText("Annuler"));
  expect(screen.getByLabelText("Gérer les exercices")).toHaveFocus();
  menu = openOrganizeMenu();
  expect(
    within(menu)
      .getAllByRole("button")
      .map((b) => b.textContent),
  ).toEqual(["Réordonner les exercices", "Renommer la séance", "Annuler"]);
  fireEvent.keyDown(menu, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("confirms selected exercise deletion from the add menu", async () => {
  await openEmptyWorkout();
  createExercise("Squat");
  createExercise("Row");
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  fireEvent.click(within(openAddMenu()).getByText("Supprimer l’exercice"));
  expect(confirm).toHaveBeenCalledWith("Supprimer cet exercice ?");
  expect(
    storedWorkouts()[0].exercises.map((exercise) => exercise.name),
  ).toEqual(["Squat", "Row"]);
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByText("Supprimer l’exercice"));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Row" })).toBeInTheDocument();
  expect(
    storedWorkouts()[0].exercises.map((exercise) => exercise.name),
  ).toEqual(["Row"]);
  fireEvent.click(within(openAddMenu()).getByText("Supprimer l’exercice"));
  expect(
    screen.getByRole("heading", { name: "Aucun exercice" }),
  ).toBeInTheDocument();
  expect(storedWorkouts()[0].exercises).toEqual([]);
});

it("renames the workout from the organization sheet", async () => {
  await openEmptyWorkout();
  fireEvent.click(within(openOrganizeMenu()).getByText("Renommer la séance"));
  expect(screen.getByLabelText("Nom")).toHaveValue("Push");
  fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Pull" } });
  fireEvent.click(screen.getByText("Enregistrer"));
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Pull");
  expect(storedWorkouts()[0].name).toBe("Pull");
});

it("automatically selects the first exercise and displays its blank initial set", async () => {
  await openEmptyWorkout();
  createExercise("Squat");
  expect(screen.getByRole("heading", { name: "Squat" })).toBeInTheDocument();
  expect(screen.getByRole("button", { pressed: true })).toHaveTextContent(
    "Squat",
  );
  expect(screen.getByLabelText("Répétitions")).toHaveValue(null);
  expect(screen.getByLabelText("Charge (kg)")).toHaveValue(null);
  expect(
    screen.getByRole("button", { name: "Options avancées" }),
  ).toHaveTextContent(/^Options avancées$/);
  fillSet("80");
  const zone = within(seriesRegion("Squat"));
  expect(zone.getByRole("heading", { name: "SÉRIE 1" })).toBeInTheDocument();
  expect(zone.getByText("Squat")).toBeInTheDocument();
  expect(zone.getByText("À venir")).toBeInTheDocument();
  expect(zone.getByLabelText("Charge (kg)")).toHaveValue(80);
  expect(zone.getByText("1:30 · Repos prévu")).toBeInTheDocument();
  expect(seriesRegion("Squat").lastElementChild).toHaveTextContent(
    "+ Ajouter une série",
  );
});

it("preserves selection when adding exercises and switches both exercise and set data", async () => {
  await openEmptyWorkout();
  createExercise("Squat");
  fillSet("80");
  createExercise("Row");
  expect(screen.getByRole("heading", { name: "Squat" })).toBeInTheDocument();
  expect(screen.getByLabelText("Charge (kg)")).toHaveValue(80);
  selectExercise("Row");
  expect(
    screen.queryByRole("region", { name: "Séries de Squat" }),
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText("Charge (kg)")).toHaveValue(null);
  fillSet("40");
  createExercise("Curl");
  expect(screen.getByRole("heading", { name: "Row" })).toBeInTheDocument();
  expect(screen.getByLabelText("Charge (kg)")).toHaveValue(40);
  selectExercise("Squat");
  expect(screen.getByLabelText("Charge (kg)")).toHaveValue(80);
});

it("edits set values inline, persists them, and rejects invalid values", async () => {
  const view = await openEmptyWorkout();
  createExercise("Squat");
  fillSet("80");
  for (const [label, value] of [
    ["Répétitions", "12"],
    ["Charge (kg)", "82.5"],
    ["Repos (secondes)", "0"],
  ]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.blur(screen.getByLabelText(label));
  }
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByText("0:00 · Repos prévu")).toBeInTheDocument();
  expect(storedWorkouts()[0].exercises[0].plannedSets[0]).toMatchObject({
    repetitions: 12,
    weightKg: 82.5,
    restSeconds: 0,
  });
  for (const [label, invalid, previous] of [
    ["Répétitions", "0", 12],
    ["Répétitions", "1.5", 12],
    ["Charge (kg)", "-1", 82.5],
    ["Repos (secondes)", "", 0],
  ] as const) {
    const input = screen.getByLabelText(label);
    fireEvent.change(input, { target: { value: invalid } });
    expect(input).toBeInvalid();
    fireEvent.blur(input);
    expect(input).toHaveValue(previous);
  }
  view.unmount();
  render(<App />);
  fireEvent.click(await screen.findByText("Push"));
  expect(screen.getByLabelText("Répétitions")).toHaveValue(12);
  expect(screen.getByLabelText("Charge (kg)")).toHaveValue(82.5);
  expect(screen.getByLabelText("Repos (secondes)")).toHaveValue(0);
});

it("reorders exercises in a dedicated sheet and retains selection and persisted order", async () => {
  const view = await openEmptyWorkout();
  createExercise("Squat");
  createExercise("Row");
  createExercise("Curl");
  fireEvent.click(
    within(openOrganizeMenu()).getByText("Réordonner les exercices"),
  );
  const sheet = within(screen.getByRole("dialog"));
  expect(sheet.getByLabelText("Monter Squat")).toBeDisabled();
  expect(sheet.getByLabelText("Descendre Curl")).toBeDisabled();
  fireEvent.click(sheet.getByLabelText("Monter Row"));
  fireEvent.click(sheet.getByText("Terminer"));
  expect(screen.getByRole("button", { pressed: true })).toHaveTextContent(
    "Squat",
  );
  expect(
    storedWorkouts()[0].exercises.map((e) => [e.name, e.position]),
  ).toEqual([
    ["Row", 0],
    ["Squat", 1],
    ["Curl", 2],
  ]);
  view.unmount();
  render(<App />);
  fireEvent.click(await screen.findByText("Push"));
  expect(
    within(screen.getByRole("list", { name: "Exercices" })).getAllByRole(
      "button",
    )[0],
  ).toHaveTextContent("Row");
});

it("keeps sets in their natural order and renumbers them after deletion", async () => {
  await openEmptyWorkout();
  createExercise("Row");
  fillSet("40");
  createExercise("Squat");
  selectExercise("Squat");
  fillSet("80");
  fireEvent.click(screen.getByText("+ Ajouter une série"));
  fillSet("90", 1);
  expect(screen.queryByLabelText(/Monter la série/)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/Descendre la série/)).not.toBeInTheDocument();
  expect(
    screen
      .getAllByLabelText("Charge (kg)")
      .map((e) => (e as HTMLInputElement).value),
  ).toEqual(["80", "90"]);
  let blocks = within(seriesRegion("Squat")).getAllByRole("listitem");
  fireEvent.click(within(blocks[0]).getByText("Supprimer"));
  expect(screen.getByLabelText("Charge (kg)")).toHaveValue(90);
  blocks = within(seriesRegion("Squat")).getAllByRole("listitem");
  fireEvent.click(within(blocks[0]).getByText("Supprimer"));
  expect(seriesRegion("Squat").textContent).toBe("+ Ajouter une série");
  selectExercise("Row");
  expect(screen.getByLabelText("Charge (kg)")).toHaveValue(40);
  expect(storedWorkouts()[0].exercises[1].plannedSets).toEqual([]);
});

it("selects a remaining exercise after deletion and restores the empty state after the last", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  await openEmptyWorkout();
  createExercise("Squat");
  createExercise("Row");
  const removeSelected = () => {
    const actions = screen.getByLabelText(
      "Actions de l’exercice",
    ).parentElement!;
    fireEvent.click(within(actions).getByRole("button", { name: "Supprimer" }));
  };
  removeSelected();
  expect(screen.getByRole("heading", { name: "Row" })).toBeInTheDocument();
  removeSelected();
  expect(
    screen.getByRole("heading", { name: "Aucun exercice" }),
  ).toBeInTheDocument();
  expect(screen.queryByText("+ Ajouter une série")).not.toBeInTheDocument();
});

it("creates N blank sets with the requested rest and preserves blanks after reload", async () => {
  const view = await openEmptyWorkout();
  createExercise("Développé couché", 4, 120);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(
    within(seriesRegion("Développé couché")).getAllByRole("listitem"),
  ).toHaveLength(4);
  for (const field of screen.getAllByLabelText("Charge (kg)"))
    expect(field).toHaveValue(null);
  for (const field of screen.getAllByLabelText("Répétitions"))
    expect(field).toHaveValue(null);
  for (const field of screen.getAllByLabelText("Repos (secondes)"))
    expect(field).toHaveValue(120);
  const sets = storedWorkouts()[0].exercises[0].plannedSets;
  expect(
    sets.map((s) => [s.position, s.weightKg, s.repetitions, s.restSeconds]),
  ).toEqual([
    [0, null, null, 120],
    [1, null, null, 120],
    [2, null, null, 120],
    [3, null, null, 120],
  ]);
  expect(new Set(sets.map((s) => s.id)).size).toBe(4);
  view.unmount();
  render(<App />);
  fireEvent.click(await screen.findByText("Push"));
  expect(screen.getAllByLabelText("Charge (kg)")).toHaveLength(4);
  for (const field of screen.getAllByLabelText("Charge (kg)"))
    expect(field).toHaveValue(null);
  for (const field of screen.getAllByLabelText("Répétitions"))
    expect(field).toHaveValue(null);
  for (const field of screen.getAllByLabelText("Repos (secondes)"))
    expect(field).toHaveValue(120);
});

it.each(["", "0", "-1", "1.5"])(
  "rejects invalid initial set count %s",
  async (value) => {
    await openEmptyWorkout();
    fireEvent.click(within(openAddMenu()).getByText("Ajouter un exercice"));
    fireEvent.change(screen.getByLabelText("Nom"), {
      target: { value: "Squat" },
    });
    fireEvent.change(screen.getByLabelText("Nombre de séries initiales"), {
      target: { value },
    });
    fireEvent.click(screen.getByText("Enregistrer"));
    expect(screen.getByLabelText("Nombre de séries initiales")).toBeInvalid();
    expect(storedWorkouts()[0].exercises).toEqual([]);
  },
);

it("appends a blank set immediately using the last set rest, including zero", async () => {
  await openEmptyWorkout();
  createExercise("Squat", 1, 120);
  fillSet("80");
  fireEvent.click(screen.getByText("+ Ajouter une série"));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getAllByLabelText("Charge (kg)")[1]).toHaveValue(null);
  expect(screen.getAllByLabelText("Répétitions")[1]).toHaveValue(null);
  expect(screen.getAllByLabelText("Repos (secondes)")[1]).toHaveValue(120);
  fireEvent.change(screen.getAllByLabelText("Repos (secondes)")[1], {
    target: { value: "0" },
  });
  fireEvent.click(screen.getByText("+ Ajouter une série"));
  expect(screen.getAllByLabelText("Repos (secondes)")[2]).toHaveValue(0);
  fillSet("42.5", 2);
  expect(storedWorkouts()[0].exercises[0].plannedSets[2]).toMatchObject({
    weightKg: 42.5,
    repetitions: 8,
    restSeconds: 0,
  });
});

it("allows clearing reps and kg back to unspecified without confusing zero weight", async () => {
  const view = await openEmptyWorkout();
  createExercise("Squat");
  fillSet("0");
  expect(storedWorkouts()[0].exercises[0].plannedSets[0].weightKg).toBe(0);
  for (const label of ["Répétitions", "Charge (kg)"]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value: "" } });
    fireEvent.blur(screen.getByLabelText(label));
    expect(screen.getByLabelText(label)).toHaveValue(null);
  }
  expect(storedWorkouts()[0].exercises[0].plannedSets[0]).toMatchObject({
    repetitions: null,
    weightKg: null,
  });
  view.unmount();
  render(<App />);
  fireEvent.click(await screen.findByText("Push"));
  expect(screen.getByLabelText("Répétitions")).toHaveValue(null);
  expect(screen.getByLabelText("Charge (kg)")).toHaveValue(null);
});

it("keeps fixed exercise zones outside a long series list", async () => {
  const view = await openEmptyWorkout();
  createExercise("Squat", 12);
  const preparation = view.container.querySelector<HTMLDivElement>(
    ".workout-preparation",
  );
  createExercise("Row");
  createExercise("Curl");
  createExercise("Press");
  createExercise("Lunge");
  createExercise("Plank");
  const fixedZones = view.container.querySelector<HTMLDivElement>(
    ".workout-fixed-zones",
  );
  const sets = seriesRegion("Squat");
  expect(preparation).toContainElement(fixedZones);
  expect(preparation).toContainElement(sets);
  expect(fixedZones).toContainElement(
    screen.getByRole("list", { name: "Exercices" }),
  );
  expect(fixedZones).toContainElement(screen.getByText("Options avancées"));
  expect(
    within(screen.getByRole("list", { name: "Exercices" })).getAllByRole(
      "button",
    ),
  ).toHaveLength(6);
  expect(fixedZones).not.toContainElement(sets);
  expect(within(sets).getAllByRole("listitem")).toHaveLength(12);
  expect(view.container.querySelector("main")).toHaveClass("workout-detail");
});

it("shows an active series and advances it when its rest ends", async () => {
  await openEmptyWorkout();
  createExercise("Squat", 2, 30);
  fireEvent.click(screen.getByText("Démarrer la séance"));
  const blocks = within(seriesRegion("Squat")).getAllByRole("listitem");
  expect(within(blocks[0]).getByText("Série active")).toBeInTheDocument();
  expect(
    within(blocks[1]).getByText("À venir", { selector: ".set-status" }),
  ).toBeInTheDocument();
  expect(within(blocks[0]).getByLabelText("Répétitions")).toBeEnabled();
  expect(within(blocks[1]).getByLabelText("Répétitions")).toBeDisabled();
  fireEvent.change(within(blocks[0]).getByLabelText("Répétitions"), {
    target: { value: "10" },
  });
  fireEvent.change(within(blocks[0]).getByLabelText("Charge (kg)"), {
    target: { value: "80" },
  });
  fireEvent.click(within(blocks[0]).getByText("Lancer le repos"));
  expect(within(blocks[0]).getByText("Repos en cours")).toBeInTheDocument();
  expect(within(blocks[0]).getByLabelText("Répétitions")).toBeDisabled();
  fireEvent.click(within(blocks[0]).getByText("Terminer le repos"));
  expect(within(blocks[0]).getByText("Effectuée")).toBeInTheDocument();
  expect(within(blocks[1]).getByText("Série active")).toBeInTheDocument();
  expect(storedWorkouts()[0].execution?.exercises[0].sets[0]).toMatchObject({
    status: "performed",
    repetitions: 10,
    weightKg: 80,
  });
});

it("reveals a confirmed workout deletion action after a horizontal swipe", async () => {
  render(<App />);
  await screen.findByText("Aucune séance");
  const create = (name: string) => {
    fireEvent.click(screen.getByText("Créer une séance"));
    fireEvent.change(screen.getByLabelText("Nom"), { target: { value: name } });
    fireEvent.click(screen.getByText("Enregistrer"));
  };
  create("Push");
  create("Pull");
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  const card = screen.getByText("Push").closest("li")!;
  fireEvent.pointerDown(card, { clientX: 160 });
  fireEvent.pointerMove(card, { clientX: 80 });
  fireEvent.pointerUp(card, { clientX: 80 });
  expect(card).toHaveClass("open");
  expect(confirm).not.toHaveBeenCalled();
  const cardButton = card.querySelector(".workout-card")!;
  fireEvent.pointerDown(cardButton, { clientX: 80 });
  fireEvent.pointerUp(cardButton, { clientX: 80 });
  fireEvent.click(cardButton);
  expect(card).not.toHaveClass("open");
  expect(screen.getByRole("heading", { name: "Séances" })).toBeInTheDocument();
  fireEvent.pointerDown(card, { clientX: 160 });
  fireEvent.pointerMove(card, { clientX: 80 });
  fireEvent.pointerUp(card, { clientX: 80 });
  fireEvent.click(screen.getByRole("button", { name: "Supprimer Push" }));
  expect(confirm).toHaveBeenCalledWith("Supprimer cette séance ?");
  expect(screen.getByText("Push")).toBeInTheDocument();
  fireEvent.pointerDown(card, { clientX: 80 });
  fireEvent.pointerMove(card, { clientX: 160 });
  fireEvent.pointerUp(card, { clientX: 160 });
  expect(card).not.toHaveClass("open");
  fireEvent.pointerDown(card, { clientX: 160 });
  fireEvent.pointerMove(card, { clientX: 80 });
  fireEvent.pointerUp(card, { clientX: 80 });
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole("button", { name: "Supprimer Push" }));
  expect(screen.queryByText("Push")).not.toBeInTheDocument();
  expect(storedWorkouts().map((workout) => workout.name)).toEqual(["Pull"]);
});

it("adds an upcoming exercise during execution without losing the active series", async () => {
  await openEmptyWorkout();
  createExercise("Squat", 2, 30);
  fireEvent.click(screen.getByText("Démarrer la séance"));
  expect(screen.getByLabelText("Gérer les exercices")).toBeInTheDocument();
  fireEvent.click(within(seriesRegion("Squat")).getByText("Lancer le repos"));
  fireEvent.click(within(seriesRegion("Squat")).getByText("Terminer le repos"));
  expect(screen.getByLabelText("Gérer les exercices")).toBeInTheDocument();
  createExercise("Row", 2, 30);
  expect(
    within(seriesRegion("Squat")).getByText("Série active"),
  ).toBeInTheDocument();
  expect(storedWorkouts()[0].execution?.exercises).toMatchObject([
    { exerciseId: storedWorkouts()[0].exercises[0].id, status: "active" },
    { exerciseId: storedWorkouts()[0].exercises[1].id, status: "upcoming" },
  ]);
});

it("only offers deletion for an upcoming series during execution", async () => {
  await openEmptyWorkout();
  createExercise("Squat", 3, 30);
  fireEvent.click(screen.getByText("Démarrer la séance"));
  let blocks = within(seriesRegion("Squat")).getAllByRole("listitem");
  fireEvent.click(within(blocks[0]).getByText("Lancer le repos"));
  fireEvent.click(within(blocks[0]).getByText("Terminer le repos"));
  blocks = within(seriesRegion("Squat")).getAllByRole("listitem");
  expect(within(blocks[0]).queryByText("Supprimer")).not.toBeInTheDocument();
  expect(within(blocks[2]).getByText("Supprimer")).toBeInTheDocument();
  fireEvent.click(within(blocks[2]).getByText("Supprimer"));
  expect(within(seriesRegion("Squat")).getAllByRole("listitem")).toHaveLength(
    2,
  );
});

it("keeps a completed workout final after returning home and reloading", async () => {
  const view = await openEmptyWorkout();
  createExercise("Squat", 1, 30);
  fireEvent.click(screen.getByText("Démarrer la séance"));
  fireEvent.click(screen.getByText("Lancer le repos"));
  expect(screen.getByText("Terminer la séance")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Terminer la séance"));
  expect(screen.getByText("Séance terminée")).toBeInTheDocument();
  expect(screen.queryByText("Démarrer la séance")).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("Retour aux séances"));
  fireEvent.click(screen.getByText("Push"));
  expect(screen.getByText("Séance terminée")).toBeInTheDocument();
  view.unmount();
  render(<App />);
  fireEvent.click(await screen.findByText("Push"));
  expect(screen.getByText("Séance terminée")).toBeInTheDocument();
  expect(screen.queryByText("Démarrer la séance")).not.toBeInTheDocument();
  expect(storedWorkouts()[0].execution?.status).toBe("completed");
});

it("keeps future exercise states unchanged while browsing and starts them explicitly", async () => {
  await openEmptyWorkout();
  createExercise("A", 1, 30);
  createExercise("B", 1, 30);
  createExercise("C", 1, 30);
  fireEvent.click(screen.getByText("Démarrer la séance"));
  const addButton = screen.getByLabelText("Gérer les exercices");
  expect(addButton).toBeVisible();
  const tabs = within(screen.getByRole("list", { name: "Exercices" }));
  const select = (name: string) =>
    fireEvent.click(tabs.getByRole("button", { name: new RegExp("^" + name) }));
  select("B");
  select("C");
  select("B");
  expect(
    storedWorkouts()[0].execution?.exercises.map((item) => item.status),
  ).toEqual(["active", "upcoming", "upcoming"]);
  fireEvent.click(within(seriesRegion("B")).getByText("Lancer le repos"));
  expect(
    storedWorkouts()[0].execution?.exercises.map((item) => item.status),
  ).toEqual(["active", "active", "upcoming"]);
  select("C");
  select("A");
  select("B");
  expect(
    storedWorkouts()[0].execution?.exercises.map((item) => item.status),
  ).toEqual(["active", "active", "upcoming"]);
});

it("keeps add set available after starting and appends a blank execution set", async () => {
  await openEmptyWorkout();
  createExercise("Squat", 2, 30);
  fireEvent.click(screen.getByText("Démarrer la séance"));
  const region = seriesRegion("Squat");
  expect(screen.getByText("+ Ajouter une série")).toBeVisible();
  fireEvent.click(screen.getByText("+ Ajouter une série"));
  expect(within(region).getAllByRole("listitem")).toHaveLength(3);
  expect(storedWorkouts()[0].execution?.exercises[0].sets).toHaveLength(3);
  expect(storedWorkouts()[0].execution?.exercises[0].sets[2].status).toBe(
    "upcoming",
  );
});

it("keeps add set available after the first series has started", async () => {
  await openEmptyWorkout();
  createExercise("Squat", 2, 30);
  fireEvent.click(screen.getByText("Démarrer la séance"));
  const region = seriesRegion("Squat");
  const blocks = within(region).getAllByRole("listitem");
  fireEvent.click(within(blocks[0]).getByText("Lancer le repos"));
  expect(screen.getByText("+ Ajouter une série")).toBeVisible();
  fireEvent.click(screen.getByText("+ Ajouter une série"));
  expect(within(region).getAllByRole("listitem")).toHaveLength(3);
  expect(
    within(region).getByRole("heading", { name: "SÉRIE 3" }),
  ).toBeInTheDocument();
});
