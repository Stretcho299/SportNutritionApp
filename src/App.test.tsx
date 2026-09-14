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
function createExercise(name: string) {
  fireEvent.click(within(openAddMenu()).getByText("Ajouter un exercice"));
  fireEvent.change(screen.getByLabelText("Nom"), { target: { value: name } });
  fireEvent.click(screen.getByText("Enregistrer"));
}
function createSet(weight: string) {
  fireEvent.click(screen.getByText("+ Ajouter une série"));
  const form = within(screen.getByRole("dialog", { name: "Nouvelle série" }));
  fireEvent.change(form.getByLabelText("Charge"), {
    target: { value: weight },
  });
  fireEvent.change(form.getByLabelText("Répétitions"), {
    target: { value: "8" },
  });
  fireEvent.click(form.getByText("Enregistrer"));
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
  ).toEqual(["Ajouter un exercice", "Supprimer la séance", "Annuler"]);
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

it("confirms workout deletion and preserves the workout when cancelled", async () => {
  await openEmptyWorkout();
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  fireEvent.click(within(openAddMenu()).getByText("Supprimer la séance"));
  expect(confirm).toHaveBeenCalledWith("Supprimer cette séance ?");
  expect(storedWorkouts()).toHaveLength(1);
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByText("Supprimer la séance"));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByText("Aucune séance")).toBeInTheDocument();
  expect(storedWorkouts()).toEqual([]);
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

it("automatically selects the first exercise and shows only add-series in empty zone 3", async () => {
  await openEmptyWorkout();
  createExercise("Squat");
  expect(screen.getByRole("heading", { name: "Squat" })).toBeInTheDocument();
  expect(screen.getByRole("button", { pressed: true })).toHaveTextContent(
    "Squat",
  );
  expect(seriesRegion("Squat").textContent).toBe("+ Ajouter une série");
  expect(
    screen.getByRole("button", { name: "Options avancées" }),
  ).toHaveTextContent(/^Options avancées$/);
  createSet("80");
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
  createSet("80");
  createExercise("Row");
  expect(screen.getByRole("heading", { name: "Squat" })).toBeInTheDocument();
  expect(screen.getByLabelText("Charge (kg)")).toHaveValue(80);
  selectExercise("Row");
  expect(
    screen.queryByRole("region", { name: "Séries de Squat" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Charge (kg)")).not.toBeInTheDocument();
  createSet("40");
  createExercise("Curl");
  expect(screen.getByRole("heading", { name: "Row" })).toBeInTheDocument();
  expect(screen.getByLabelText("Charge (kg)")).toHaveValue(40);
  selectExercise("Squat");
  expect(screen.getByLabelText("Charge (kg)")).toHaveValue(80);
});

it("edits set values inline, persists them, and rejects invalid values", async () => {
  const view = await openEmptyWorkout();
  createExercise("Squat");
  createSet("80");
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

it("reorders and deletes sets without affecting another exercise", async () => {
  await openEmptyWorkout();
  createExercise("Row");
  createSet("40");
  createExercise("Squat");
  selectExercise("Squat");
  createSet("80");
  createSet("90");
  expect(screen.getByLabelText("Monter la série 1")).toBeDisabled();
  expect(screen.getByLabelText("Descendre la série 2")).toBeDisabled();
  fireEvent.click(screen.getByLabelText("Monter la série 2"));
  expect(
    screen
      .getAllByLabelText("Charge (kg)")
      .map((e) => (e as HTMLInputElement).value),
  ).toEqual(["90", "80"]);
  let blocks = within(seriesRegion("Squat")).getAllByRole("listitem");
  fireEvent.click(within(blocks[0]).getByText("Supprimer"));
  expect(screen.getByLabelText("Charge (kg)")).toHaveValue(80);
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
