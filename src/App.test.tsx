import { act, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import App from "./App";
import {
  __storageKey,
  completeWorkoutExecution,
  createWorkoutSession,
  type Workout,
  type WorkoutStore,
} from "./storage/database";

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.useRealTimers();
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
async function dismissSheetAndWait() {
  const handle = document.querySelector<HTMLElement>(".sheet-handle-zone");
  if (!handle) throw new Error("sheet handle not found");
  handle.setPointerCapture = vi.fn();
  fireEvent.pointerDown(handle, { pointerId: 1, clientY: 10 });
  fireEvent.pointerMove(handle, { pointerId: 1, clientY: 120 });
  fireEvent.pointerUp(handle, { pointerId: 1, clientY: 120 });
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
  fireEvent.click(
    screen.getByRole("button", { name: "+ Créer un exercice personnalisé" }),
  );
  fireEvent.change(screen.getByLabelText("Nom"), { target: { value: name } });
  fireEvent.click(screen.getByText("Enregistrer"));
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
  fireEvent.click(within(dialog).getByRole("button", { name: "ENREGISTRER" }));
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

it("applies page motion only when the screen changes", async () => {
  render(<App />);

  const dashboard = await screen.findByRole("region", { name: "Entraînement" });
  expect(dashboard).not.toHaveClass("page-forward", "page-back");

  fireEvent.click(screen.getByRole("button", { name: "Ouvrir Mes séances" }));
  const workouts = screen.getByRole("region", { name: "Mes séances" });
  expect(workouts).toHaveClass("page-forward");

  fireEvent.click(screen.getByLabelText("Retour aux séances"));
  expect(screen.getByRole("region", { name: "Entraînement" })).toHaveClass(
    "page-back",
  );

  fireEvent.click(screen.getByRole("button", { name: "Ouvrir Mes séances" }));
  expect(screen.getByRole("region", { name: "Mes séances" })).toHaveClass(
    "page-forward",
  );
});

it("resumes the same active session into detail with forward page motion", async () => {
  const view = await openEmptyWorkout();
  await createExercise("Squat", 1, 30);
  fireEvent.click(screen.getByRole("button", { name: "Démarrer la séance" }));
  const sessionId = storedWorkouts()[0].execution?.sessionId;

  fireEvent.click(screen.getByLabelText("Retour aux séances"));
  expect(screen.getByRole("region", { name: "Entraînement" })).toHaveClass(
    "page-back",
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Reprendre la séance Push" }),
  );

  const detail = document.querySelector(".workout-preparation");
  expect(detail).toHaveClass("page-forward");
  expect(
    screen.getByLabelText("Retour aux séances").parentElement,
  ).not.toHaveClass("page-forward", "page-back");
  expect(storedWorkouts()[0].execution?.sessionId).toBe(sessionId);
  view.unmount();
});

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
  expect(screen.getByLabelText("Rechercher un exercice")).toBeInTheDocument();
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
  const sessions = screen.getByRole("region", { name: "Mes séances" });
  expect(within(sessions).getByText("Aucune séance prête")).toBeInTheDocument();
  expect(
    within(sessions).getByText("Créez votre première séance."),
  ).toBeInTheDocument();
  expect(sessions.querySelector(".sessions-empty button")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Créer une séance" }));
  const dialog = screen.getByRole("dialog", { name: "Séance" });
  expect(screen.getByLabelText("Nom")).not.toHaveFocus();
  expect(document.body).toHaveStyle({ position: "fixed", overflow: "hidden" });
  expect(document.querySelector(".app-shell")).toHaveAttribute(
    "data-modal-open",
    "true",
  );
  await act(() => new Promise((resolve) => window.setTimeout(resolve, 20)));
  expect(dialog).toHaveFocus();
  const backdrop = document.querySelector<HTMLElement>(".sheet-backdrop")!;
  fireEvent.click(backdrop);
  expect(dialog).toBeInTheDocument();
  expect(document.body).toHaveStyle({ position: "fixed", overflow: "hidden" });
  await waitForMotion();
  expect(
    screen.queryByRole("dialog", { name: "Séance" }),
  ).not.toBeInTheDocument();
  expect(document.body.style.position).toBe("");
  expect(document.body.style.overflow).toBe("");
  expect(document.querySelector(".app-shell")).not.toHaveAttribute(
    "data-modal-open",
  );
});

it("uses layout bounds without a keyboard and visualViewport with one", async () => {
  vi.stubGlobal("innerHeight", 844);
  const visualViewport = new EventTarget() as VisualViewport;
  Object.defineProperties(visualViewport, {
    height: { configurable: true, value: 810 },
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

  expect(backdrop).toHaveAttribute("data-keyboard-open", "false");
  expect(backdrop.style.getPropertyValue("--sheet-viewport-height")).toBe(
    "var(--app-viewport-height, 100dvh)",
  );
  expect(backdrop.style.getPropertyValue("--sheet-viewport-top")).toBe("0px");

  Object.defineProperties(visualViewport, {
    height: { configurable: true, value: 430 },
    offsetTop: { configurable: true, value: 96 },
  });
  act(() => visualViewport.dispatchEvent(new Event("resize")));
  expect(backdrop.style.getPropertyValue("--sheet-viewport-height")).toBe(
    "430px",
  );
  expect(backdrop.style.getPropertyValue("--sheet-viewport-top")).toBe("96px");
  expect(backdrop).toHaveAttribute("data-keyboard-open", "true");

  Object.defineProperties(visualViewport, {
    height: { configurable: true, value: 810 },
    offsetTop: { configurable: true, value: 0 },
  });
  act(() => visualViewport.dispatchEvent(new Event("resize")));
  expect(backdrop.style.getPropertyValue("--sheet-viewport-height")).toBe(
    "var(--app-viewport-height, 100dvh)",
  );
  expect(backdrop.style.getPropertyValue("--sheet-viewport-top")).toBe("0px");
  expect(backdrop).toHaveAttribute("data-keyboard-open", "false");
});

it("opens first-time workouts directly in preparation without starting a session", async () => {
  const view = await openEmptyWorkout();
  expect(screen.queryByRole("region", { name: "Aperçu de Push" })).toBeNull();
  expect(screen.getByText("Aucun exercice")).toBeInTheDocument();
  expect(storedWorkouts()[0].execution).toBeUndefined();
  await createExercise("Squat", 3, 90);
  await createExercise("Row", 2, 60);
  fireEvent.click(screen.getByLabelText("Retour aux séances"));
  expect(
    screen.getByRole("region", { name: "Mes séances" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Aperçu de Push" })).toBeNull();
  fireEvent.click(screen.getByText("Push").closest("button")!);
  expect(screen.getByRole("heading", { name: "Squat" })).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Row · À venir" }),
  ).toBeInTheDocument();
  expect(storedWorkouts()[0].execution).toBeUndefined();
  expect(
    screen.getByRole("button", { name: "Démarrer la séance" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Démarrer la séance" }));
  expect(storedWorkouts()[0].execution?.startedAt).toEqual(expect.any(Number));
  expect(storedWorkouts()[0].execution?.sessionId).toBeDefined();
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
  ).toEqual(["Ajouter un exercice", "Supprimer l’exercice"]);
  await act(() => new Promise((resolve) => window.setTimeout(resolve, 20)));
  expect(menu).toHaveFocus();
  await dismissSheetAndWait();
  expect(screen.getByLabelText("Gérer les exercices")).toHaveFocus();
  menu = openOrganizeMenu();
  expect(
    within(menu)
      .getAllByRole("button")
      .map((b) => b.textContent?.trim())
      .filter(Boolean),
  ).toEqual(["Réordonner les exercices", "Renommer la séance"]);
  fireEvent.keyDown(menu, { key: "Escape" });
  expect(menu).toBeInTheDocument();
  await dismissSheetAndWait();
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
}, 10_000);

it("selects bounded picker values and persists repetitions, half-kilograms and split rest", async () => {
  const view = await openEmptyWorkout();
  await createExercise("Squat");
  await fillSet("80");
  await chooseValue("Répétitions", 24);
  await chooseValue("Charge (kg)", 82.5);
  await chooseValue("Repos", 419);
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
  fireEvent.click(document.querySelector<HTMLElement>(".sheet-backdrop")!);
  expect(repDialog).toBeInTheDocument();
  expect(
    within(repDialog).getByRole("option", { name: /^24$/ }),
  ).toHaveAttribute("aria-selected", "true");
  await dismissSheetAndWait();
  fireEvent.click(screen.getByLabelText("Charge (kg)"));
  const weightDialog = screen.getByRole("dialog", {
    name: "Choisir Charge (kg)",
  });
  expect(within(weightDialog).getAllByRole("option")).toHaveLength(601);
  fireEvent.click(document.querySelector<HTMLElement>(".sheet-backdrop")!);
  expect(weightDialog).toBeInTheDocument();
  expect(
    within(weightDialog).getByRole("option", { name: /^82\.5$/ }),
  ).toHaveAttribute("aria-selected", "true");
  await dismissSheetAndWait();
  fireEvent.click(screen.getByLabelText("Repos"));
  const restDialog = screen.getByRole("dialog", {
    name: "Choisir Repos",
  });
  expect(within(restDialog).getAllByRole("listbox")).toHaveLength(2);
  fireEvent.click(document.querySelector<HTMLElement>(".sheet-backdrop")!);
  expect(restDialog).toBeInTheDocument();
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
  await dismissSheetAndWait();
  view.unmount();
  render(<App />);
  await openPreparedWorkout();
  expect(screen.getByLabelText("Répétitions")).toHaveAttribute(
    "data-value",
    "24",
  );
  expect(screen.getByLabelText("Charge (kg)")).toHaveAttribute(
    "data-value",
    "82.5",
  );
  expect(screen.getByLabelText("Repos")).toHaveAttribute("data-value", "419");
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
  await dismissSheetAndWait();
  expect(storedWorkouts()[0].exercises.map((e) => e.name)).toEqual([
    "Squat",
    "Row",
    "Curl",
  ]);
  fireEvent.click(
    within(openOrganizeMenu()).getByText("Réordonner les exercices"),
  );
  const savedSheet = within(screen.getByRole("dialog"));
  fireEvent.click(savedSheet.getByLabelText("Monter Row"));
  fireEvent.click(savedSheet.getByRole("button", { name: "ENREGISTRER" }));
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
  expect(
    within(screen.getByRole("list", { name: "Exercices" })).getAllByRole(
      "button",
    )[0],
  ).toHaveTextContent("Row");
}, 10_000);

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
  const deleteExercise = screen.getByRole("alertdialog", {
    name: "Supprimer cet exercice ?",
  });
  await clickAndWaitForMotion(
    within(deleteExercise).getByRole("button", { name: "Supprimer" }),
  );
  expect(screen.getByRole("heading", { name: "Row" })).toBeInTheDocument();
  expect(storedWorkouts()[0].exercises.map((item) => item.name)).toEqual([
    "Row",
  ]);
  const rowActions = document.querySelector<HTMLElement>(".exercise-menu")!;
  fireEvent.click(
    within(rowActions).getByRole("button", { name: "Supprimer" }),
  );
  await clickAndWaitForMotion(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "Supprimer",
    }),
  );
  expect(
    screen.getByRole("heading", { name: "Aucun exercice" }),
  ).toBeInTheDocument();
}, 10_000);

it("selects a remaining exercise after deletion and restores the empty state after the last", async () => {
  await openEmptyWorkout();
  await createExercise("Squat");
  await createExercise("Row");
  const removeSelected = () => {
    const actions = document.querySelector<HTMLElement>(".exercise-menu")!;
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
  for (const field of screen.getAllByLabelText("Repos"))
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
  expect(screen.getAllByLabelText("Charge (kg)")).toHaveLength(4);
  for (const field of screen.getAllByLabelText("Charge (kg)"))
    expect(field).toHaveAttribute("data-value", "");
  for (const field of screen.getAllByLabelText("Répétitions"))
    expect(field).toHaveAttribute("data-value", "");
  for (const field of screen.getAllByLabelText("Repos"))
    expect(field).toHaveAttribute("data-value", "120");
});

it("offers only valid initial set counts through the native wheel picker", async () => {
  await openEmptyWorkout();
  fireEvent.click(within(openAddMenu()).getByText("Ajouter un exercice"));
  fireEvent.click(
    screen.getByRole("button", { name: "+ Créer un exercice personnalisé" }),
  );
  fireEvent.change(screen.getByLabelText("Nom"), {
    target: { value: "Squat" },
  });
  fireEvent.click(screen.getByText("Enregistrer"));
  expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("Nombre de séries initiales"));
  const picker = screen.getByRole("dialog", {
    name: "Choisir Nombre de séries initiales",
  });
  const options = within(picker).getAllByRole("option");
  expect(options).toHaveLength(50);
  expect(options[0]).toHaveTextContent("1");
  expect(options.at(-1)).toHaveTextContent("50");
  await dismissSheetAndWait();
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
  expect(screen.getAllByLabelText("Repos")[1]).toHaveAttribute(
    "data-value",
    "120",
  );
  await chooseValue("Repos", 0, 1);
  fireEvent.click(screen.getByText("+ Ajouter une série"));
  expect(screen.getAllByLabelText("Repos")[2]).toHaveAttribute(
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
  vi.stubGlobal("indexedDB", undefined);
  const exercises = [
    { id: "layout-squat", name: "Squat", count: 12 },
    { id: "layout-row", name: "Row", count: 3 },
    { id: "layout-curl", name: "Curl", count: 3 },
    { id: "layout-press", name: "Press", count: 3 },
    { id: "layout-lunge", name: "Lunge", count: 3 },
    { id: "layout-plank", name: "Plank", count: 3 },
  ].map(({ id, name, count }, position) => ({
    id,
    name,
    position,
    defaultRestSeconds: 150,
    plannedSets: Array.from({ length: count }, (_, setPosition) => ({
      id: id + "-set-" + (setPosition + 1),
      position: setPosition,
      weightKg: null,
      repetitions: null,
      restSeconds: 150,
    })),
  }));
  const store: WorkoutStore = {
    version: 2,
    templates: [{ id: "layout-workout", name: "Layout fixture", exercises }],
    sessions: [],
  };
  localStorage.setItem(__storageKey, JSON.stringify(store));

  const view = render(<App />);
  await openPreparedWorkout("Layout fixture");

  const preparation = view.container.querySelector<HTMLDivElement>(
    ".workout-preparation",
  );
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

it("tracks workout swipes, preserves vertical movement, and deletes immediately", async () => {
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
  let card = screen.getByText("Push").closest("li")!;
  let cardButton = card.querySelector<HTMLElement>(".workout-card")!;
  fireEvent.pointerDown(card, {
    pointerId: 1,
    button: 0,
    clientX: 160,
    clientY: 100,
  });
  fireEvent.pointerMove(card, {
    pointerId: 1,
    clientX: 70,
    clientY: 102,
  });
  expect(cardButton).toHaveStyle({ transform: "translateX(-90px)" });
  fireEvent.pointerMove(card, {
    pointerId: 1,
    clientX: 140,
    clientY: 102,
  });
  expect(cardButton).toHaveStyle({ transform: "translateX(-20px)" });
  fireEvent.pointerUp(card, {
    pointerId: 1,
    button: 0,
    clientX: 140,
    clientY: 102,
  });
  expect(card).not.toHaveClass("open");

  fireEvent.pointerDown(card, {
    pointerId: 2,
    button: 0,
    clientX: 160,
    clientY: 100,
  });
  fireEvent.pointerMove(card, {
    pointerId: 2,
    clientX: 100,
    clientY: 100,
  });
  expect(cardButton).toHaveStyle({ transform: "translateX(-60px)" });
  fireEvent.pointerUp(card, {
    pointerId: 2,
    button: 0,
    clientX: 100,
    clientY: 100,
  });
  expect(card).toHaveClass("open");
  fireEvent.click(cardButton);
  expect(card).toHaveClass("open");
  fireEvent.pointerDown(cardButton, {
    pointerId: 5,
    button: 0,
    clientX: 100,
    clientY: 100,
  });
  fireEvent.pointerUp(cardButton, {
    pointerId: 5,
    button: 0,
    clientX: 100,
    clientY: 100,
  });
  fireEvent.click(cardButton);
  expect(card).not.toHaveClass("open");
  expect(
    screen.getByRole("heading", { name: "Mes séances", level: 1 }),
  ).toBeInTheDocument();
  fireEvent.click(cardButton);
  expect(
    screen.getByRole("heading", { name: "Push", level: 1 }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retour aux séances" }));
  await waitForMotion();
  card = screen.getByText("Push").closest("li")!;
  cardButton = card.querySelector<HTMLElement>(".workout-card")!;

  fireEvent.pointerDown(card, {
    pointerId: 3,
    button: 0,
    clientX: 160,
    clientY: 100,
  });
  fireEvent.pointerMove(card, {
    pointerId: 3,
    clientX: 160,
    clientY: 40,
  });
  fireEvent.pointerUp(card, {
    pointerId: 3,
    button: 0,
    clientX: 160,
    clientY: 40,
  });
  expect(card).not.toHaveClass("open");
  expect(cardButton).toHaveStyle({ transform: "translateX(0px)" });

  fireEvent.pointerDown(card, {
    pointerId: 4,
    button: 0,
    clientX: 160,
    clientY: 100,
  });
  fireEvent.pointerMove(card, {
    pointerId: 4,
    clientX: 38,
    clientY: 100,
  });
  const offsetAt20pxOvershoot = Number(
    cardButton.style.transform.match(/translateX\((-?[\d.]+)px\)/)?.[1],
  );
  expect(offsetAt20pxOvershoot).toBeLessThan(-102);
  expect(offsetAt20pxOvershoot).toBeGreaterThan(-122);
  fireEvent.pointerMove(card, {
    pointerId: 4,
    clientX: 18,
    clientY: 100,
  });
  const offsetAt40pxOvershoot = Number(
    cardButton.style.transform.match(/translateX\((-?[\d.]+)px\)/)?.[1],
  );
  expect(offsetAt40pxOvershoot).toBeLessThan(-102);
  expect(-offsetAt40pxOvershoot - 102).toBeLessThan(
    (-offsetAt20pxOvershoot - 102) * 2,
  );
  fireEvent.pointerMove(card, {
    pointerId: 4,
    clientX: -22,
    clientY: 100,
  });
  const offsetAt80pxOvershoot = Number(
    cardButton.style.transform.match(/translateX\((-?[\d.]+)px\)/)?.[1],
  );
  expect(-offsetAt80pxOvershoot - 102).toBeLessThan(
    (-offsetAt40pxOvershoot - 102) * 2,
  );
  fireEvent.pointerUp(card, {
    pointerId: 4,
    button: 0,
    clientX: -22,
    clientY: 100,
  });
  expect(card).toHaveClass("open");
  expect(cardButton).toHaveStyle({ transform: "translateX(-102px)" });
  expect(screen.getByText("Push")).toBeInTheDocument();
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Supprimer Push" }));
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
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
  const preview = screen.getByRole("region", { name: "Aperçu de Push" });
  expect(preview).toBeInTheDocument();
  expect(preview).toHaveClass("page-back");
  expect(within(preview).getByText("Durée moyenne")).toBeInTheDocument();
  expect(within(preview).getByText("Calories moyennes")).toBeInTheDocument();
  expect(within(preview).getAllByText("Pas encore de données")).toHaveLength(2);
  fireEvent.click(screen.getByLabelText("Retour aux séances"));
  fireEvent.click(screen.getByText("Push"));
  const repeatedPreview = screen.getByRole("region", {
    name: "Aperçu de Push",
  });
  expect(repeatedPreview).toHaveClass("page-forward");
  expect(
    screen.getByRole("button", { name: "PRÉPARER LA SÉANCE" }),
  ).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "PRÉPARER LA SÉANCE" }));
  expect(screen.getByText("Démarrer la séance")).toBeInTheDocument();
  expect(document.querySelector(".workout-preparation")).toHaveClass(
    "page-forward",
  );
  view.unmount();
  render(<App />);
  await openPreparedWorkout();
  fireEvent.click(screen.getByRole("button", { name: "PRÉPARER LA SÉANCE" }));
  expect(screen.getByText("Démarrer la séance")).toBeInTheDocument();
  expect(storedWorkouts()[0].execution?.status).toBe("completed");
});

it("derives the global workout clock from startedAt and syncs on foreground", async () => {
  const view = await openEmptyWorkout();
  await createExercise("Squat", 1, 30);
  const now = vi.spyOn(Date, "now").mockReturnValue(100_000);
  fireEvent.click(screen.getByRole("button", { name: "Démarrer la séance" }));
  const timer = screen.getByRole("timer", { name: "Durée de la séance" });
  expect(timer).toHaveTextContent("◷ 00:00");
  expect(timer).toHaveAttribute("data-started-at", "100000");
  now.mockReturnValue(225_000);
  fireEvent(window, new Event("focus"));
  expect(timer).toHaveTextContent("◷ 02:05");
  expect(storedWorkouts()[0].execution?.startedAt).toBe(100_000);
  view.unmount();
});

it("starts a two-second rest at two and finishes at its persisted deadline", async () => {
  const view = await openEmptyWorkout();
  await createExercise("Squat", 2, 2);
  const startedAt = 100_000;
  vi.useFakeTimers({ now: startedAt });

  fireEvent.click(screen.getByRole("button", { name: "Démarrer la séance" }));
  fireEvent.click(screen.getByRole("button", { name: "Lancer le repos" }));

  const timer = screen.getByRole("timer", { name: "Temps de repos restant" });
  expect(timer).toHaveTextContent("0:02");
  expect(storedWorkouts()[0].execution?.exercises[0].sets[0]).toMatchObject({
    status: "resting",
    restEndsAt: startedAt + 2_000,
    restDurationSeconds: 2,
  });

  await act(async () => {
    await vi.advanceTimersByTimeAsync(1_000);
  });
  expect(timer).toHaveTextContent("0:01");

  await act(async () => {
    await vi.advanceTimersByTimeAsync(999);
  });
  expect(storedWorkouts()[0].execution?.exercises[0].sets[0].status).toBe(
    "resting",
  );

  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(
    screen.queryByRole("timer", { name: "Temps de repos restant" }),
  ).not.toBeInTheDocument();
  expect(within(seriesRegion("Squat")).getByText("Effectuée")).toBeVisible();
  expect(storedWorkouts()[0].execution?.exercises[0].sets[0].status).toBe(
    "performed",
  );
  view.unmount();
});

it("starts a longer rest at its configured duration", async () => {
  const view = await openEmptyWorkout();
  await createExercise("Squat", 2, 90);
  const startedAt = 200_000;
  vi.useFakeTimers({ now: startedAt });

  fireEvent.click(screen.getByRole("button", { name: "Démarrer la séance" }));
  fireEvent.click(screen.getByRole("button", { name: "Lancer le repos" }));

  const timer = screen.getByRole("timer", { name: "Temps de repos restant" });
  expect(timer).toHaveTextContent("1:30");
  expect(timer).not.toHaveTextContent("1:31");
  expect(storedWorkouts()[0].execution?.exercises[0].sets[0].restEndsAt).toBe(
    startedAt + 90_000,
  );
  view.unmount();
});

it("resynchronizes a stale workout clock when starting rest", async () => {
  const view = await openEmptyWorkout();
  await createExercise("Squat", 2, 2);
  const startedAt = 300_000;
  vi.useFakeTimers({ now: startedAt });

  fireEvent.click(screen.getByRole("button", { name: "Démarrer la séance" }));
  vi.setSystemTime(startedAt + 700);
  fireEvent.click(screen.getByRole("button", { name: "Lancer le repos" }));

  const timer = screen.getByRole("timer", { name: "Temps de repos restant" });
  expect(timer).toHaveTextContent("0:02");
  expect(timer).not.toHaveTextContent("0:03");
  expect(storedWorkouts()[0].execution?.exercises[0].sets[0]).toMatchObject({
    status: "resting",
    restEndsAt: startedAt + 700 + 2_000,
  });
  view.unmount();
});

it("shows the active workout capsule on the dashboard and resumes its unchanged session", async () => {
  const view = await openEmptyWorkout();
  await createExercise("Squat", 1, 30);
  const now = vi.spyOn(Date, "now").mockReturnValue(100_000);
  fireEvent.click(screen.getByRole("button", { name: "Démarrer la séance" }));
  const startedAt = storedWorkouts()[0].execution?.startedAt;
  const sessionId = storedWorkouts()[0].execution?.sessionId;
  fireEvent.click(screen.getByLabelText("Retour aux séances"));

  const capsule = screen.getByRole("button", {
    name: "Reprendre la séance Push",
  });
  expect(capsule).toBeVisible();
  expect(
    screen.queryByRole("region", { name: "Séance en cours" }),
  ).not.toBeInTheDocument();
  expect(document.querySelector(".workout-card-active")).toBeNull();
  expect(within(capsule).getByText("0 terminées · 1 restante")).toBeVisible();
  expect(
    screen.getByRole("timer", { name: "Durée de la séance en cours" }),
  ).toHaveTextContent("00:00");
  expect(
    screen.getByRole("timer", { name: "Durée de la séance en cours" }),
  ).toHaveAttribute("data-started-at", String(startedAt));

  now.mockReturnValue(225_000);
  fireEvent(window, new Event("pageshow"));
  expect(
    screen.getByRole("timer", { name: "Durée de la séance en cours" }),
  ).toHaveTextContent("02:05");
  fireEvent(document, new Event("visibilitychange"));
  fireEvent(window, new Event("focus"));
  fireEvent.click(
    screen.getByRole("button", { name: "Reprendre la séance Push" }),
  );

  expect(screen.getByRole("region", { name: "Séries de Squat" })).toBeVisible();
  expect(storedWorkouts()[0].execution?.sessionId).toBe(sessionId);
  expect(storedWorkouts()[0].execution?.startedAt).toBe(startedAt);
  expect(storedWorkouts()).toHaveLength(1);
  view.unmount();
});

it("shows the active capsule for readyToFinish and hides it under overlays and in its workout detail", async () => {
  const view = await openEmptyWorkout();
  await createExercise("Squat", 1, 30);
  fireEvent.click(screen.getByText("Démarrer la séance"));
  await chooseValue("Répétitions", 10);
  await chooseValue("Charge (kg)", 80);
  fireEvent.click(screen.getByText("Lancer le repos"));
  expect(storedWorkouts()[0].execution?.status).toBe("readyToFinish");
  fireEvent.click(screen.getByLabelText("Retour aux séances"));
  expect(
    screen.getByRole("button", { name: "Reprendre la séance Push" }),
  ).toBeVisible();
  expect(screen.getByText("1 terminée · 0 restantes")).toBeVisible();

  fireEvent.click(
    screen.getByRole("button", { name: "Reprendre la séance Push" }),
  );
  expect(
    screen.queryByRole("button", { name: "Reprendre la séance Push" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("Gérer les exercices"));
  expect(
    screen.queryByRole("button", { name: "Reprendre la séance Push" }),
  ).not.toBeInTheDocument();
  view.unmount();
});

it("hides the active capsule while a picker or confirmation is open", async () => {
  const view = await openEmptyWorkout();
  await createExercise("Squat", 1, 30);
  fireEvent.click(screen.getByText("Démarrer la séance"));
  fireEvent.click(screen.getByLabelText("Retour aux séances"));
  expect(
    screen.getByRole("button", { name: "Reprendre la séance Push" }),
  ).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "Ouvrir Mes séances" }));
  fireEvent.click(screen.getByRole("button", { name: "Créer une séance" }));
  fireEvent.change(screen.getByLabelText("Nom"), {
    target: { value: "Pull" },
  });
  fireEvent.click(screen.getByText("Enregistrer"));
  await waitForMotion();
  fireEvent.click(screen.getByRole("button", { name: "Supprimer Pull" }));
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(screen.queryByText("Pull")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Reprendre la séance Push" }),
  ).toBeVisible();

  fireEvent.click(
    screen.getByRole("button", { name: "Reprendre la séance Push" }),
  );
  fireEvent.click(screen.getByText("Terminer l’exercice"));
  const confirmation = screen.getByRole("alertdialog", {
    name: "Mettre fin à cet exercice ?",
  });
  expect(
    screen.queryByRole("button", { name: "Reprendre la séance Push" }),
  ).not.toBeInTheDocument();
  await clickAndWaitForMotion(
    within(confirmation).getByRole("button", { name: "Annuler" }),
  );
  fireEvent.click(screen.getByLabelText("Retour aux séances"));
  expect(
    screen.getByRole("button", { name: "Reprendre la séance Push" }),
  ).toBeVisible();
  fireEvent.click(
    screen.getByRole("button", { name: "Reprendre la séance Push" }),
  );

  fireEvent.click(screen.getByLabelText("Gérer les exercices"));
  expect(
    screen.queryByRole("button", { name: "Reprendre la séance Push" }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    within(
      screen.getByRole("dialog", { name: "Actions de la séance" }),
    ).getByText("Ajouter un exercice"),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "+ Créer un exercice personnalisé" }),
  );
  fireEvent.change(screen.getByLabelText("Nom"), {
    target: { value: "Squat" },
  });
  fireEvent.click(screen.getByText("Enregistrer"));
  expect(screen.getByRole("dialog", { name: "Exercice" })).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Reprendre la séance Push" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getAllByLabelText("Nombre de séries initiales")[0]);
  expect(
    screen.getByRole("dialog", {
      name: "Choisir Nombre de séries initiales",
    }),
  ).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Reprendre la séance Push" }),
  ).not.toBeInTheDocument();
  view.unmount();
});

it("does not render the active capsule when there is no active session", async () => {
  render(<App />);
  await screen.findByRole("button", { name: "Musculation" });
  expect(
    screen.queryByRole("button", { name: /Reprendre la séance/ }),
  ).not.toBeInTheDocument();
});

it.each(["list", "workouts", "preview"] as const)(
  "keeps compact header scroll tracking on %s",
  async (destination) => {
    vi.stubGlobal("indexedDB", undefined);
    const template = {
      id: "header-workout",
      name: "Header fixture",
      exercises: [],
    };
    const session = createWorkoutSession(template, 100_000);
    const store: WorkoutStore = {
      version: 2,
      templates: [template],
      sessions: [
        {
          ...session,
          status: "completed",
          completedAt: 101_000,
          execution: completeWorkoutExecution(session.execution, 101_000),
        },
      ],
    };
    localStorage.setItem(__storageKey, JSON.stringify(store));
    const view = render(<App />);
    await screen.findByRole("button", { name: "Ouvrir Mes séances" });
    if (destination !== "list") await openPreparedWorkout("Header fixture");
    if (destination === "workouts") {
      fireEvent.click(
        screen.getByRole("button", { name: "Retour aux séances" }),
      );
    }
    expect(document.querySelector(".app-shell")).toHaveClass(
      `screen-${destination}`,
    );
    const header = document.querySelector(".workout-control")!;
    expect(header).toHaveAttribute("data-compact-header", "true");
    vi.stubGlobal("scrollY", 120);
    fireEvent.scroll(window);
    expect(header).toHaveAttribute("data-scrolled", "true");
    vi.stubGlobal("scrollY", 0);
    fireEvent.scroll(window);
    expect(header).not.toHaveAttribute("data-scrolled");
    view.unmount();
  },
);

it("disables header scroll tracking throughout preparation and active execution", async () => {
  const view = await openEmptyWorkout();
  const header = document.querySelector(".workout-control")!;
  expect(header).not.toHaveAttribute("data-compact-header");
  vi.stubGlobal("scrollY", 120);
  fireEvent.scroll(window);
  expect(header).not.toHaveAttribute("data-scrolled");
  await createExercise("Squat", 2, 30);
  const sets = document.querySelector(".planned-sets")!;
  Object.defineProperty(sets, "scrollTop", { configurable: true, value: 120 });
  fireEvent.scroll(sets);
  expect(header).not.toHaveAttribute("data-scrolled");
  expect(header).not.toHaveAttribute("data-compact-header");
  fireEvent.click(screen.getByRole("button", { name: "Démarrer la séance" }));
  expect(header).not.toHaveAttribute("data-compact-header");
  fireEvent.scroll(sets);
  expect(header).not.toHaveAttribute("data-scrolled");
  fireEvent.click(screen.getByRole("button", { name: "Terminer l’exercice" }));
  await clickAndWaitForMotion(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "Mettre fin",
    }),
  );
  expect(storedWorkouts()[0].execution?.status).toBe("readyToFinish");
  fireEvent.scroll(sets);
  expect(header).not.toHaveAttribute("data-compact-header");
  expect(header).not.toHaveAttribute("data-scrolled");
  fireEvent.click(screen.getByRole("button", { name: "Retour aux séances" }));
  expect(screen.getByText("2 terminées · 0 restantes")).toBeVisible();
  expect(document.querySelector(".workout-control")).toHaveAttribute(
    "data-compact-header",
    "true",
  );
  view.unmount();
});

it("returns from a subview to the dashboard and scrolls the active dashboard tab to the top", async () => {
  const view = await openEmptyWorkout();
  const scrollTo = vi.fn();
  vi.stubGlobal("scrollY", 96);
  vi.stubGlobal("scrollTo", scrollTo);
  fireEvent.click(screen.getByRole("button", { name: "Musculation" }));
  expect(screen.getByRole("heading", { name: "Entraînement" })).toBeVisible();
  expect(scrollTo).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Musculation" }));
  expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  view.unmount();
});

it("returns the active dashboard tab to the top instantly with reduced motion", async () => {
  const view = render(<App />);
  await screen.findByRole("button", { name: "Musculation" });
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  vi.stubGlobal("scrollY", 96);
  const scrollTo = vi.fn();
  vi.stubGlobal("scrollTo", scrollTo);

  fireEvent.click(screen.getByRole("button", { name: "Musculation" }));
  expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "instant" });
  view.unmount();
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
