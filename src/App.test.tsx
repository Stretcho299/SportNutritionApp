import { act, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import App from "./App";
import { __storageKey, type Workout } from "./storage/database";

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function waitForMotion() {
  await act(() => new Promise((resolve) => window.setTimeout(resolve, 190)));
}

async function clickAndWaitForMotion(element: HTMLElement) {
  fireEvent.click(element);
  await waitForMotion();
}

const storedWorkouts = (): Workout[] => {
  const raw = JSON.parse(localStorage.getItem(__storageKey) ?? "[]");
  if (Array.isArray(raw)) return raw;
  return raw.templates.map((template: Workout) => {
    const session = raw.sessions
      .filter((item: { templateId: string }) => item.templateId === template.id)
      .sort(
        (a: { startedAt: number }, b: { startedAt: number }) =>
          b.startedAt - a.startedAt,
      )[0];
    return session ? { ...template, execution: session.execution } : template;
  });
};
async function openEmptyWorkout() {
  const view = render(<App />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Ouvrir Mes séances" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Créer une séance" }));
  fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Push" } });
  fireEvent.click(screen.getByText("Enregistrer"));
  expect(storedWorkouts()[0].name).toBe("Push");
  await waitForMotion();
  fireEvent.click(screen.getByText("Push").closest("button")!);
  fireEvent.click(screen.getByRole("button", { name: "Refaire la séance" }));
  return view;
}

async function openPreparedWorkout(name = "Push") {
  fireEvent.click(
    await screen.findByRole("button", { name: "Ouvrir Mes séances" }),
  );
  fireEvent.click((await screen.findByText(name)).closest("button")!);
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
async function createExercise(name: string, count = 1, rest = 90) {
  fireEvent.click(within(openAddMenu()).getByText("Ajouter un exercice"));
  fireEvent.change(screen.getByLabelText("Nom"), { target: { value: name } });
  await chooseValue("Nombre de séries initiales", count);
  await chooseValue("Repos par défaut", rest);
  fireEvent.click(screen.getByText("Enregistrer"));
  await waitForMotion();
}
async function chooseValue(label: string, value: number, index = 0) {
  fireEvent.click(screen.getAllByLabelText(label)[index]);
  const dialog = screen.getByRole("dialog", { name: `Choisir ${label}` });
  if (label.startsWith("Repos")) {
    fireEvent.click(
      within(
        within(dialog).getByRole("listbox", { name: "Minutes" }),
      ).getByRole("option", {
        name: new RegExp(`^${Math.floor(value / 60)}$`),
      }),
    );
    fireEvent.click(
      within(
        within(dialog).getByRole("listbox", { name: "Secondes" }),
      ).getByRole("option", { name: new RegExp(`^${value % 60}$`) }),
    );
  } else {
    fireEvent.click(
      within(
        within(dialog).getByRole("listbox", {
          name:
            label === "Charge (kg)"
              ? "Kilogrammes"
              : label === "Nombre de séries initiales"
                ? "Séries"
                : "Répétitions",
        }),
      ).getByRole("option", { name: new RegExp(`^${value}$`) }),
    );
  }
  fireEvent.click(within(dialog).getByRole("button", { name: "Valider" }));
  await waitForMotion();
}
async function fillSet(weight: string, index = 0) {
  await chooseValue("Charge (kg)", Number(weight), index);
  await chooseValue("Répétitions", 8, index);
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

it("opens forms without input autofocus and locks the background", async () => {
  render(<App />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Ouvrir Mes séances" }),
  );
  expect(screen.getByRole("button", { name: "Musculation" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(screen.getByRole("button", { name: "Nutrition" })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  fireEvent.click(screen.getByRole("button", { name: "Créer une séance" }));
  const dialog = screen.getByRole("dialog", { name: "Séance" });
  expect(screen.getByLabelText("Nom")).not.toHaveFocus();
  expect(document.body).toHaveStyle({ position: "fixed", overflow: "hidden" });
  await act(() => new Promise((resolve) => window.setTimeout(resolve, 20)));
  expect(dialog).toHaveFocus();
  await clickAndWaitForMotion(
    within(dialog).getByRole("button", { name: "Annuler" }),
  );
  expect(
    screen.queryByRole("dialog", { name: "Séance" }),
  ).not.toBeInTheDocument();
  expect(document.body.style.position).toBe("");
  expect(document.body.style.overflow).toBe("");
});

it("tracks visualViewport keyboard changes without scrolling the document", async () => {
  const visualViewport = new EventTarget() as VisualViewport;
  Object.defineProperties(visualViewport, {
    height: { configurable: true, value: 844 },
    offsetTop: { configurable: true, value: 0 },
  });
  vi.stubGlobal("visualViewport", visualViewport);

  render(<App />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Ouvrir Mes séances" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Créer une séance" }));
  const name = screen.getByRole("textbox", { name: "Nom" });
  fireEvent.focus(name);
  const backdrop = document.querySelector<HTMLElement>(".sheet-backdrop")!;

  Object.defineProperties(visualViewport, {
    height: { configurable: true, value: 430 },
    offsetTop: { configurable: true, value: 96 },
  });
  act(() => visualViewport.dispatchEvent(new Event("resize")));
  expect(backdrop.style.getPropertyValue("--visual-viewport-height")).toBe(
    "430px",
  );
  expect(backdrop.style.getPropertyValue("--visual-viewport-top")).toBe("96px");
  expect(backdrop).toHaveAttribute("data-keyboard-open", "true");

  Object.defineProperties(visualViewport, {
    height: { configurable: true, value: 844 },
    offsetTop: { configurable: true, value: 0 },
  });
  act(() => visualViewport.dispatchEvent(new Event("resize")));
  expect(backdrop.style.getPropertyValue("--visual-viewport-height")).toBe(
    "844px",
  );
  expect(backdrop.style.getPropertyValue("--visual-viewport-top")).toBe("0px");
  expect(backdrop).toHaveAttribute("data-keyboard-open", "false");
});

it("opens a prepared workout preview with only persisted program data", async () => {
  const view = await openEmptyWorkout();
  await createExercise("Squat", 3, 90);
  await createExercise("Row", 2, 60);
  fireEvent.click(screen.getByLabelText("Retour aux séances"));
  fireEvent.click(screen.getByLabelText("Retour aux séances"));
  fireEvent.click(screen.getByText("Push").closest("button")!);
  const preview = screen.getByRole("region", { name: "Aperçu de Push" });
  expect(
    Array.from(preview.querySelectorAll(".preview-metrics strong")).map(
      (metric) => metric.textContent,
    ),
  ).toEqual(["2", "5", "—", "—"]);
  expect(within(preview).getByText("Squat")).toBeInTheDocument();
  expect(within(preview).getByText("3 séries")).toBeInTheDocument();
  expect(within(preview).getByText("Row")).toBeInTheDocument();
  expect(within(preview).getByText("2 séries")).toBeInTheDocument();
  expect(
    within(preview).queryByRole("button", { name: "Démarrer la séance" }),
  ).not.toBeInTheDocument();
  expect(
    within(preview).getByRole("button", { name: "Refaire la séance" }),
  ).toBeEnabled();
  expect(within(preview).getAllByText("Pas encore de données")).toHaveLength(2);
  fireEvent.click(
    within(preview).getByRole("button", { name: "Refaire la séance" }),
  );
  expect(storedWorkouts()[0].execution).toBeUndefined();
  expect(
    screen.getByRole("button", { name: "Démarrer la séance" }),
  ).toBeInTheDocument();
  view.unmount();
});

it("exposes exactly the requested actions in each header sheet", async () => {
  await openEmptyWorkout();
  expect(screen.queryByText("Renommer la séance")).not.toBeInTheDocument();
  expect(screen.queryByText("Supprimer la séance")).not.toBeInTheDocument();
  let menu = openAddMenu();
  expect(
    within(menu)
      .getAllByRole("button")
      .map((b) => b.textContent?.trim())
      .filter(Boolean),
  ).toEqual(["Ajouter un exercice", "Supprimer l’exercice", "Annuler"]);
  await act(() => new Promise((resolve) => window.setTimeout(resolve, 20)));
  expect(menu).toHaveFocus();
  await clickAndWaitForMotion(within(menu).getByText("Annuler"));
  expect(screen.getByLabelText("Gérer les exercices")).toHaveFocus();
  menu = openOrganizeMenu();
  expect(
    within(menu)
      .getAllByRole("button")
      .map((b) => b.textContent?.trim())
      .filter(Boolean),
  ).toEqual(["Réordonner les exercices", "Renommer la séance", "Annuler"]);
  fireEvent.keyDown(menu, { key: "Escape" });
  await waitForMotion();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("confirms selected exercise deletion from the add menu", async () => {
  await openEmptyWorkout();
  await createExercise("Squat");
  await fillSet("50");
  await createExercise("Row");
  fireEvent.click(within(openAddMenu()).getByText("Supprimer l’exercice"));
  const confirmation = screen.getByRole("alertdialog", {
    name: "Supprimer cet exercice ?",
  });
  expect(
    within(confirmation).getByRole("button", { name: "Annuler" }),
  ).toHaveFocus();
  expect(
    storedWorkouts()[0].exercises.map((exercise) => exercise.name),
  ).toEqual(["Squat", "Row"]);
  await clickAndWaitForMotion(
    within(confirmation).getByRole("button", { name: "Supprimer" }),
  );
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
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
  await createExercise("Squat");
  expect(screen.getByRole("heading", { name: "Squat" })).toBeInTheDocument();
  expect(screen.getByRole("button", { pressed: true })).toHaveTextContent(
    "Squat",
  );
  expect(screen.getByLabelText("Répétitions")).toHaveAttribute(
    "data-value",
    "",
  );
  expect(screen.getByLabelText("Charge (kg)")).toHaveAttribute(
    "data-value",
    "",
  );
  expect(
    screen.getByRole("button", { name: "Options avancées" }),
  ).toHaveTextContent(/^Options avancées$/);
  await fillSet("80");
  const zone = within(seriesRegion("Squat"));
  expect(zone.getByRole("heading", { name: "SÉRIE 1" })).toBeInTheDocument();
  expect(zone.getByText("Squat")).toBeInTheDocument();
  expect(zone.getByText("À venir")).toBeInTheDocument();
  expect(zone.getByLabelText("Charge (kg)")).toHaveAttribute(
    "data-value",
    "80",
  );
  expect(zone.queryByText("1:30 · Repos prévu")).not.toBeInTheDocument();
  expect(seriesRegion("Squat").lastElementChild).toHaveTextContent(
    "+ Ajouter une série",
  );
});

it("preserves selection when adding exercises and switches both exercise and set data", async () => {
  await openEmptyWorkout();
  await createExercise("Squat");
  await fillSet("80");
  await createExercise("Row");
  expect(screen.getByRole("heading", { name: "Squat" })).toBeInTheDocument();
  expect(screen.getByLabelText("Charge (kg)")).toHaveAttribute(
    "data-value",
    "80",
  );
  selectExercise("Row");
  expect(
    screen.queryByRole("region", { name: "Séries de Squat" }),
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText("Charge (kg)")).toHaveAttribute(
    "data-value",
    "",
  );
  await fillSet("40");
  await createExercise("Curl");
  expect(screen.getByRole("heading", { name: "Row" })).toBeInTheDocument();
  expect(screen.getByLabelText("Charge (kg)")).toHaveAttribute(
    "data-value",
    "40",
  );
  selectExercise("Squat");
  expect(screen.getByLabelText("Charge (kg)")).toHaveAttribute(
    "data-value",
    "80",
  );
});

it("selects bounded picker values and persists repetitions, half-kilograms and split rest", async () => {
  const view = await openEmptyWorkout();
  await createExercise("Squat");
  await fillSet("80");
  await chooseValue("Répétitions", 24);
  await chooseValue("Charge (kg)", 82.5);
  await chooseValue("Repos (secondes)", 419);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByText("6:59 · Repos prévu")).not.toBeInTheDocument();
  expect(storedWorkouts()[0].exercises[0].plannedSets[0]).toMatchObject({
    repetitions: 24,
    weightKg: 82.5,
    restSeconds: 419,
  });
  fireEvent.click(screen.getByLabelText("Répétitions"));
  const repDialog = screen.getByRole("dialog", { name: "Choisir Répétitions" });
  expect(within(repDialog).getAllByRole("option")).toHaveLength(25);
  expect(
    within(repDialog).getByRole("option", { name: /^24$/ }),
  ).toHaveAttribute("aria-selected", "true");
  await clickAndWaitForMotion(screen.getByRole("button", { name: "Annuler" }));
  fireEvent.click(screen.getByLabelText("Charge (kg)"));
  const weightDialog = screen.getByRole("dialog", {
    name: "Choisir Charge (kg)",
  });
  expect(within(weightDialog).getAllByRole("option")).toHaveLength(601);
  expect(
    within(weightDialog).getByRole("option", { name: /^82\.5$/ }),
  ).toHaveAttribute("aria-selected", "true");
  await clickAndWaitForMotion(screen.getByRole("button", { name: "Annuler" }));
  fireEvent.click(screen.getByLabelText("Repos (secondes)"));
  const restDialog = screen.getByRole("dialog", {
    name: "Choisir Repos (secondes)",
  });
  expect(within(restDialog).getAllByRole("listbox")).toHaveLength(2);
  expect(
    within(
      within(restDialog).getByRole("listbox", { name: "Minutes" }),
    ).getAllByRole("option"),
  ).toHaveLength(7);
  expect(
    within(
      within(restDialog).getByRole("listbox", { name: "Secondes" }),
    ).getAllByRole("option"),
  ).toHaveLength(60);
  await clickAndWaitForMotion(screen.getByRole("button", { name: "Annuler" }));
  view.unmount();
  render(<App />);
  await openPreparedWorkout();
  fireEvent.click(screen.getByRole("button", { name: "Refaire la séance" }));
  expect(screen.getByLabelText("Répétitions")).toHaveAttribute(
    "data-value",
    "24",
  );
  expect(screen.getByLabelText("Charge (kg)")).toHaveAttribute(
    "data-value",
    "82.5",
  );
  expect(screen.getByLabelText("Repos (secondes)")).toHaveAttribute(
    "data-value",
    "419",
  );
});

it("reorders exercises in a dedicated sheet and retains selection and persisted order", async () => {
  const view = await openEmptyWorkout();
  await createExercise("Squat");
  await createExercise("Row");
  await createExercise("Curl");
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
  await openPreparedWorkout();
  fireEvent.click(screen.getByRole("button", { name: "Refaire la séance" }));
  expect(
    within(screen.getByRole("list", { name: "Exercices" })).getAllByRole(
      "button",
    )[0],
  ).toHaveTextContent("Row");
});

it("keeps sets in their natural order and renumbers them after deletion", async () => {
  await openEmptyWorkout();
  await createExercise("Row");
  await fillSet("40");
  await createExercise("Squat");
  selectExercise("Squat");
  await fillSet("80");
  fireEvent.click(screen.getByText("+ Ajouter une série"));
  await fillSet("90", 1);
  expect(screen.queryByLabelText(/Monter la série/)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/Descendre la série/)).not.toBeInTheDocument();
  expect(
    within(seriesRegion("Squat"))
      .getAllByLabelText("Charge (kg)")
      .map((e) => e.getAttribute("data-value")),
  ).toEqual(["80", "90"]);
  let blocks = within(seriesRegion("Squat")).getAllByRole("listitem");
  fireEvent.click(within(blocks[0]).getByText("Supprimer"));
  await clickAndWaitForMotion(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "Supprimer",
    }),
  );
  expect(
    within(seriesRegion("Squat")).getByLabelText("Charge (kg)"),
  ).toHaveAttribute("data-value", "90");
  blocks = within(seriesRegion("Squat")).getAllByRole("listitem");
  fireEvent.click(within(blocks[0]).getByText("Supprimer"));
  await clickAndWaitForMotion(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "Supprimer",
    }),
  );
  expect(
    within(seriesRegion("Squat")).queryByRole("listitem"),
  ).not.toBeInTheDocument();
  selectExercise("Row");
  expect(
    within(seriesRegion("Row")).getByLabelText("Charge (kg)"),
  ).toHaveAttribute("data-value", "40");
  expect(storedWorkouts()[0].exercises[1].plannedSets).toEqual([]);
});

it("selects a remaining exercise after deletion and restores the empty state after the last", async () => {
  await openEmptyWorkout();
  await createExercise("Squat");
  await createExercise("Row");
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
  await createExercise("Développé couché", 4, 120);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(
    within(seriesRegion("Développé couché")).getAllByRole("listitem"),
  ).toHaveLength(4);
  for (const field of screen.getAllByLabelText("Charge (kg)"))
    expect(field).toHaveAttribute("data-value", "");
  for (const field of screen.getAllByLabelText("Répétitions"))
    expect(field).toHaveAttribute("data-value", "");
  for (const field of screen.getAllByLabelText("Repos (secondes)"))
    expect(field).toHaveAttribute("data-value", "120");
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
  await openPreparedWorkout();
  fireEvent.click(screen.getByRole("button", { name: "Refaire la séance" }));
  expect(screen.getAllByLabelText("Charge (kg)")).toHaveLength(4);
  for (const field of screen.getAllByLabelText("Charge (kg)"))
    expect(field).toHaveAttribute("data-value", "");
  for (const field of screen.getAllByLabelText("Répétitions"))
    expect(field).toHaveAttribute("data-value", "");
  for (const field of screen.getAllByLabelText("Repos (secondes)"))
    expect(field).toHaveAttribute("data-value", "120");
});

it("offers only valid initial set counts through the native wheel picker", async () => {
  await openEmptyWorkout();
  fireEvent.click(within(openAddMenu()).getByText("Ajouter un exercice"));
  expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("Nombre de séries initiales"));
  const picker = screen.getByRole("dialog", {
    name: "Choisir Nombre de séries initiales",
  });
  const options = within(picker).getAllByRole("option");
  expect(options).toHaveLength(50);
  expect(options[0]).toHaveTextContent("1");
  expect(options.at(-1)).toHaveTextContent("50");
  await clickAndWaitForMotion(
    within(picker).getByRole("button", { name: "Annuler" }),
  );
});

it.each([1, 50])(
  "persists the valid initial set count boundary %i",
  async (count) => {
    await openEmptyWorkout();
    await createExercise("Squat", count, 90);
    expect(storedWorkouts()[0].exercises[0].plannedSets).toHaveLength(count);
  },
);

it("appends a blank set immediately using the last set rest, including zero", async () => {
  await openEmptyWorkout();
  await createExercise("Squat", 1, 120);
  await fillSet("80");
  fireEvent.click(screen.getByText("+ Ajouter une série"));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getAllByLabelText("Charge (kg)")[1]).toHaveAttribute(
    "data-value",
    "",
  );
  expect(screen.getAllByLabelText("Répétitions")[1]).toHaveAttribute(
    "data-value",
    "",
  );
  expect(screen.getAllByLabelText("Repos (secondes)")[1]).toHaveAttribute(
    "data-value",
    "120",
  );
  await chooseValue("Repos (secondes)", 0, 1);
  fireEvent.click(screen.getByText("+ Ajouter une série"));
  expect(screen.getAllByLabelText("Repos (secondes)")[2]).toHaveAttribute(
    "data-value",
    "0",
  );
  await fillSet("42.5", 2);
  expect(storedWorkouts()[0].exercises[0].plannedSets[2]).toMatchObject({
    weightKg: 42.5,
    repetitions: 8,
    restSeconds: 0,
  });
});

it("stores zero reps and zero kilograms as real selected values", async () => {
  await openEmptyWorkout();
  await createExercise("Squat");
  await fillSet("0");
  expect(storedWorkouts()[0].exercises[0].plannedSets[0].weightKg).toBe(0);
  await chooseValue("Répétitions", 0);
  expect(storedWorkouts()[0].exercises[0].plannedSets[0]).toMatchObject({
    repetitions: 0,
    weightKg: 0,
  });
  expect(screen.getByLabelText("Répétitions")).toHaveAttribute(
    "data-value",
    "0",
  );
  expect(screen.getByLabelText("Charge (kg)")).toHaveAttribute(
    "data-value",
    "0",
  );
});

it("keeps fixed exercise zones outside a long series list", async () => {
  const view = await openEmptyWorkout();
  await createExercise("Squat", 12);
  const preparation = view.container.querySelector<HTMLDivElement>(
    ".workout-preparation",
  );
  await createExercise("Row");
  await createExercise("Curl");
  await createExercise("Press");
  await createExercise("Lunge");
  await createExercise("Plank");
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
  await createExercise("Squat", 2, 30);
  fireEvent.click(screen.getByText("Démarrer la séance"));
  const blocks = within(seriesRegion("Squat")).getAllByRole("listitem");
  expect(within(blocks[0]).getByText("Série active")).toBeInTheDocument();
  expect(
    within(blocks[1]).getByText("À venir", { selector: ".set-status" }),
  ).toBeInTheDocument();
  expect(within(blocks[0]).getByLabelText("Répétitions")).toBeEnabled();
  expect(within(blocks[1]).getByLabelText("Répétitions")).toBeEnabled();
  await chooseValue("Répétitions", 10);
  await chooseValue("Charge (kg)", 80);
  fireEvent.click(within(blocks[0]).getByText("Lancer le repos"));
  expect(within(blocks[0]).getByText("Repos en cours")).toBeInTheDocument();
  expect(within(blocks[0]).getByLabelText("Répétitions")).toBeEnabled();
  fireEvent.click(within(blocks[0]).getByText("Terminer le repos"));
  expect(
    screen.getByRole("alertdialog", { name: "Mettre fin au repos ?" }),
  ).toHaveTextContent(/Il reste \d+ secondes?/);
  await clickAndWaitForMotion(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "Annuler",
    }),
  );
  expect(within(blocks[0]).getByText("Repos en cours")).toBeInTheDocument();
  fireEvent.click(within(blocks[0]).getByText("Terminer le repos"));
  await clickAndWaitForMotion(
    within(
      screen.getByRole("alertdialog", { name: "Mettre fin au repos ?" }),
    ).getByRole("button", { name: "Mettre fin" }),
  );
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
  fireEvent.click(
    await screen.findByRole("button", { name: "Ouvrir Mes séances" }),
  );
  const create = async (name: string) => {
    fireEvent.click(screen.getByRole("button", { name: "Créer une séance" }));
    fireEvent.change(screen.getByLabelText("Nom"), { target: { value: name } });
    fireEvent.click(screen.getByText("Enregistrer"));
    await waitForMotion();
  };
  await create("Push");
  await create("Pull");
  const card = screen.getByText("Push").closest("li")!;
  fireEvent.pointerDown(card, { clientX: 160 });
  fireEvent.pointerMove(card, { clientX: 80 });
  fireEvent.pointerUp(card, { clientX: 80 });
  expect(card).toHaveClass("open");
  const cardButton = card.querySelector(".workout-card")!;
  fireEvent.pointerDown(cardButton, { clientX: 80 });
  fireEvent.pointerUp(cardButton, { clientX: 80 });
  fireEvent.click(cardButton);
  expect(card).not.toHaveClass("open");
  expect(
    screen.getByRole("heading", { name: "Mes séances", level: 1 }),
  ).toBeInTheDocument();
  fireEvent.pointerDown(card, { clientX: 160 });
  fireEvent.pointerMove(card, { clientX: 80 });
  fireEvent.pointerUp(card, { clientX: 80 });
  fireEvent.click(screen.getByRole("button", { name: "Supprimer Push" }));
  const deleteDialog = screen.getByRole("alertdialog", {
    name: "Supprimer cette séance ?",
  });
  await clickAndWaitForMotion(
    within(deleteDialog).getByRole("button", { name: "Annuler" }),
  );
  expect(screen.getByText("Push")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Supprimer Push" }));
  await clickAndWaitForMotion(
    within(
      screen.getByRole("alertdialog", { name: "Supprimer cette séance ?" }),
    ).getByRole("button", { name: "Supprimer" }),
  );
  expect(screen.queryByText("Push")).not.toBeInTheDocument();
  expect(storedWorkouts().map((workout) => workout.name)).toEqual(["Pull"]);
});

it("adds an upcoming exercise during execution without losing the current series", async () => {
  await openEmptyWorkout();
  await createExercise("Squat", 2, 30);
  fireEvent.click(screen.getByText("Démarrer la séance"));
  expect(screen.getByLabelText("Gérer les exercices")).toBeInTheDocument();
  fireEvent.click(within(seriesRegion("Squat")).getByText("Lancer le repos"));
  fireEvent.click(within(seriesRegion("Squat")).getByText("Terminer le repos"));
  await clickAndWaitForMotion(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "Mettre fin",
    }),
  );
  expect(screen.getByLabelText("Gérer les exercices")).toBeInTheDocument();
  await createExercise("Row", 2, 30);
  expect(
    within(seriesRegion("Squat")).getByText("Série active"),
  ).toBeInTheDocument();
  const stored = JSON.parse(localStorage.getItem(__storageKey) ?? "{}");
  expect(stored.sessions[0].execution.exercises).toMatchObject([
    {
      exerciseId: stored.sessions[0].snapshot.exercises[0].id,
      status: "active",
    },
    {
      exerciseId: stored.sessions[0].snapshot.exercises[1].id,
      status: "upcoming",
    },
  ]);
});

it("offers deletion for every non-performed series during execution", async () => {
  await openEmptyWorkout();
  await createExercise("Squat", 3, 30);
  fireEvent.click(screen.getByText("Démarrer la séance"));
  let blocks = within(seriesRegion("Squat")).getAllByRole("listitem");
  fireEvent.click(within(blocks[0]).getByText("Lancer le repos"));
  fireEvent.click(within(blocks[0]).getByText("Terminer le repos"));
  await clickAndWaitForMotion(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "Mettre fin",
    }),
  );
  blocks = within(seriesRegion("Squat")).getAllByRole("listitem");
  expect(within(blocks[0]).queryByText("Supprimer")).not.toBeInTheDocument();
  expect(within(blocks[2]).getByText("Supprimer")).toBeInTheDocument();
  fireEvent.click(within(blocks[2]).getByText("Supprimer"));
  expect(within(seriesRegion("Squat")).getAllByRole("listitem")).toHaveLength(
    2,
  );
});

it("allows deleting the first non-performed series during execution", async () => {
  await openEmptyWorkout();
  await createExercise("A", 2, 30);
  await createExercise("B", 2, 30);
  fireEvent.click(screen.getByText("Démarrer la séance"));

  selectExercise("B");
  const firstExercise = seriesRegion("B");
  expect(within(firstExercise).getAllByRole("listitem")[0]).toBeInTheDocument();
  expect(
    within(firstExercise).getAllByRole("listitem")[0].querySelector(".order"),
  ).toBeInTheDocument();
  expect(
    within(within(firstExercise).getAllByRole("listitem")[1]).getByText(
      "Supprimer",
    ),
  ).toBeInTheDocument();

  selectExercise("A");
  const activeBlocks = within(seriesRegion("A")).getAllByRole("listitem");
  expect(within(activeBlocks[0]).getByText("Supprimer")).toBeInTheDocument();
  expect(within(activeBlocks[1]).getByText("Supprimer")).toBeInTheDocument();
  fireEvent.click(within(activeBlocks[0]).getByText("Lancer le repos"));
  fireEvent.click(within(activeBlocks[0]).getByText("Terminer le repos"));
  await clickAndWaitForMotion(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "Mettre fin",
    }),
  );
  expect(within(activeBlocks[0]).getByText("Effectuée")).toBeInTheDocument();
  expect(
    within(activeBlocks[0]).queryByText("Supprimer"),
  ).not.toBeInTheDocument();
  expect(within(activeBlocks[1]).getByText("Supprimer")).toBeInTheDocument();
});

it("keeps a completed workout final after returning home and reloading", async () => {
  const view = await openEmptyWorkout();
  await createExercise("Squat", 1, 30);
  fireEvent.click(screen.getByText("Démarrer la séance"));
  fireEvent.click(screen.getByText("Lancer le repos"));
  expect(screen.getByText("Terminer la séance")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Terminer la séance"));
  expect(storedWorkouts()[0].execution?.status).toBe("readyToFinish");
  await clickAndWaitForMotion(
    within(
      screen.getByRole("alertdialog", { name: "Terminer la séance ?" }),
    ).getByRole("button", { name: "Terminer" }),
  );
  expect(screen.getByText("Démarrer la séance")).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("Retour aux séances"));
  expect(
    screen.getByRole("region", { name: "Aperçu de Push" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("Retour aux séances"));
  fireEvent.click(screen.getByText("Push"));
  fireEvent.click(screen.getByRole("button", { name: "Refaire la séance" }));
  expect(screen.getByText("Démarrer la séance")).toBeInTheDocument();
  view.unmount();
  render(<App />);
  await openPreparedWorkout();
  fireEvent.click(screen.getByRole("button", { name: "Refaire la séance" }));
  expect(screen.getByText("Démarrer la séance")).toBeInTheDocument();
  expect(storedWorkouts()[0].execution?.status).toBe("completed");
});

it("keeps future exercise states unchanged while browsing and starts them explicitly", async () => {
  await openEmptyWorkout();
  await createExercise("A", 1, 30);
  await createExercise("B", 1, 30);
  await createExercise("C", 1, 30);
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

it("locks every other rest button while a chrono runs across exercises", async () => {
  await openEmptyWorkout();
  await createExercise("A", 2, 30);
  await createExercise("B", 2, 30);
  fireEvent.click(screen.getByText("Démarrer la séance"));
  selectExercise("A");
  const a = seriesRegion("A");
  fireEvent.click(within(a).getByText("Lancer le repos"));
  const aSecond = within(a).getAllByRole("listitem")[1];
  expect(
    within(aSecond).queryByLabelText("Lancer le repos"),
  ).not.toBeInTheDocument();
  selectExercise("B");
  const b = seriesRegion("B");
  expect(within(b).getByLabelText("Lancer le repos")).toBeDisabled();
  selectExercise("A");
  expect(within(a).getByText("Repos en cours")).toBeInTheDocument();
  fireEvent.click(within(a).getByText("Terminer le repos"));
  await clickAndWaitForMotion(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "Mettre fin",
    }),
  );
  selectExercise("B");
  expect(within(b).getByLabelText("Lancer le repos")).toBeEnabled();
  fireEvent.click(within(b).getByText("Lancer le repos"));
  expect(within(b).getByText("Repos en cours")).toBeInTheDocument();
});

it("keeps add set available after starting and appends a blank execution set", async () => {
  await openEmptyWorkout();
  await createExercise("Squat", 2, 30);
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
  await createExercise("Squat", 2, 30);
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

it("does not activate the next exercise when deleting an upcoming set", async () => {
  await openEmptyWorkout();
  await createExercise("A", 2, 30);
  await createExercise("B", 1, 30);
  fireEvent.click(screen.getByText("Démarrer la séance"));
  const region = seriesRegion("A");
  const blocks = within(region).getAllByRole("listitem");
  fireEvent.click(within(blocks[1]).getByText("Supprimer"));
  expect(
    storedWorkouts()[0].execution?.exercises.map((item) => item.status),
  ).toEqual(["active", "upcoming"]);
  expect(within(region).getAllByRole("listitem")).toHaveLength(1);
  selectExercise("B");
  expect(
    within(seriesRegion("B")).getByText("À venir", { selector: ".set-status" }),
  ).toBeInTheDocument();
  selectExercise("A");
  fireEvent.click(within(region).getByText("Lancer le repos"));
  expect(
    storedWorkouts()[0].execution?.exercises.map((item) => item.status),
  ).toEqual(["active", "upcoming"]);
});
