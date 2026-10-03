import { expect, test, type Page } from "@playwright/test";
import { officialExercises } from "../src/exercises/catalog";
import {
  addExercise,
  createWorkout,
  createWorkoutSession,
  type WorkoutSession,
  type WorkoutTemplate,
} from "../src/storage/database";

type PersistedHistoryStore = {
  version: number;
  sessions: Array<{
    status: string;
    sessionNotes: Record<string, string>;
    snapshot: { exercises: Array<{ id: string }> };
  }>;
};

const exerciseDefinition = officialExercises.find(
  (exercise) => exercise.id === "official:bench-press-barbell",
)!;
const exerciseName = exerciseDefinition.name;

async function choosePickerValue(
  page: Page,
  buttonName: string,
  listboxName: string,
  value: string,
) {
  await page.getByRole("button", { name: buttonName, exact: true }).click();
  const picker = page.getByRole("dialog", { name: `Choisir ${buttonName}` });
  await picker
    .getByRole("listbox", { name: listboxName })
    .getByRole("option", { name: value, exact: true })
    .click();
  await picker.getByRole("button", { name: "ENREGISTRER" }).click();
  await expect(picker).toHaveCount(0);
}

async function createCompletedWorkout(page: Page, width: number) {
  await page.setViewportSize({ width, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Ouvrir Mes séances" }).click();
  await page.getByRole("button", { name: "Créer une séance" }).click();
  const workoutForm = page.getByRole("dialog", { name: "Séance" });
  await workoutForm.getByRole("textbox", { name: "Nom" }).fill("Push bilan");
  await workoutForm.getByRole("button", { name: "Enregistrer" }).click();
  await page.locator(".workout-card").click();
  await page.getByRole("button", { name: "Ajouter un exercice" }).click();
  const catalog = page.getByRole("region", { name: "Catalogue d’exercices" });
  await catalog
    .locator(".catalog-results")
    .getByRole("button", { name: new RegExp(exerciseName) })
    .first()
    .click();
  const exerciseForm = page.getByRole("dialog", { name: "Exercice" });
  await choosePickerValue(page, "Nombre de séries initiales", "Séries", "1");
  await exerciseForm.getByRole("button", { name: "Enregistrer" }).click();

  const series = page.getByRole("region", {
    name: `Séries de ${exerciseName}`,
  });
  await choosePickerValue(page, "Charge (kg)", "Kilogrammes", "80");
  await choosePickerValue(page, "Répétitions", "Répétitions", "8");
  await page.getByRole("button", { name: "Ajouter une note" }).click();
  const notes = page.getByRole("dialog", { name: "Notes de l’exercice" });
  await notes
    .getByRole("textbox", { name: "Note permanente" })
    .fill("Banc position 4");
  await notes.getByRole("button", { name: "ENREGISTRER" }).click();
  await expect(notes).toHaveCount(0);

  await page.getByRole("button", { name: "Démarrer la séance" }).click();
  await page.getByRole("button", { name: "Notes de l’exercice" }).click();
  const activeNotes = page.getByRole("dialog", { name: "Notes de l’exercice" });
  await activeNotes
    .getByRole("textbox", { name: "Note de cette séance" })
    .fill("Très bonnes sensations");
  await activeNotes.getByRole("button", { name: "ENREGISTRER" }).click();
  await expect(activeNotes).toHaveCount(0);
  await series.getByRole("button", { name: "Lancer le repos" }).click();
  await expect(series.locator(".set-block").first()).toHaveClass(
    /status-performed/,
  );
  await page.getByRole("button", { name: "Terminer la séance" }).click();
  await page
    .getByRole("alertdialog", { name: "Terminer la séance ?" })
    .getByRole("button", { name: "Terminer" })
    .click();
  const summary = page.getByRole("region", { name: "Bilan de Push bilan" });
  await expect(summary).toBeVisible();
  return summary;
}

function makeSession({
  id,
  templateId,
  templateName,
  exerciseName: historicalExerciseName,
  startedAt,
  completedAt,
  status = "completed",
  weightKg = 80,
  repetitions = 8,
}: {
  id: string;
  templateId: string;
  templateName: string;
  exerciseName: string;
  startedAt: number;
  completedAt: number | null;
  status?: WorkoutSession["status"];
  weightKg?: number | null;
  repetitions?: number | null;
}) {
  const template = addExercise(
    { ...createWorkout(templateName), id: templateId },
    exerciseDefinition.name,
    1,
    90,
    exerciseDefinition,
  );
  const exercise = template.exercises[0];
  const base = createWorkoutSession(template, startedAt);
  const snapshot: WorkoutTemplate = {
    ...base.snapshot,
    name: templateName,
    exercises: base.snapshot.exercises.map((item) => ({
      ...item,
      name: historicalExerciseName,
      permanentNote: `Note historique ${id}`,
    })),
  };
  const executedStatus = status === "completed" ? "completed" : "inProgress";
  const session: WorkoutSession = {
    ...base,
    id,
    templateId,
    templateName,
    startedAt,
    completedAt,
    status,
    snapshot,
    sessionNotes: { [exercise.id]: `Note de séance ${id}` },
    execution: {
      ...base.execution,
      status: executedStatus,
      completedAt: completedAt ?? undefined,
      exercises: [
        {
          exerciseId: exercise.id,
          status: executedStatus,
          sets: [
            {
              setId: exercise.plannedSets[0].id,
              status: status === "completed" ? "performed" : "active",
              weightKg,
              repetitions,
              restSeconds: 90,
            },
          ],
        },
      ],
    },
  };
  return { session, template };
}

async function seedHistory(page: Page) {
  const pushA = makeSession({
    id: "push-a",
    templateId: "push-template",
    templateName: "Push A",
    exerciseName: "Bench A historique",
    startedAt: Date.UTC(2026, 9, 1, 10),
    completedAt: Date.UTC(2026, 9, 1, 10, 52),
    weightKg: 80,
    repetitions: 8,
  });
  const pull = makeSession({
    id: "pull",
    templateId: "pull-template",
    templateName: "Pull",
    exerciseName: "Row historique",
    startedAt: Date.UTC(2026, 9, 2, 10),
    completedAt: Date.UTC(2026, 9, 2, 10, 47),
    weightKg: 50,
    repetitions: 10,
  });
  const pushB = makeSession({
    id: "push-b",
    templateId: "push-template",
    templateName: "Push B",
    exerciseName: "Bench B historique",
    startedAt: Date.UTC(2026, 9, 3, 10),
    completedAt: Date.UTC(2026, 9, 3, 10, 52),
    weightKg: 82.5,
    repetitions: 8,
  });
  const abandoned = makeSession({
    id: "abandoned",
    templateId: "push-template",
    templateName: "Abandonnée",
    exerciseName: "Exercice abandonné",
    startedAt: Date.UTC(2026, 9, 4, 10),
    completedAt: null,
    status: "abandoned",
    weightKg: null,
    repetitions: null,
  });
  const active = makeSession({
    id: "active",
    templateId: "active-template",
    templateName: "Active",
    exerciseName: "Exercice actif",
    startedAt: Date.UTC(2026, 9, 5, 10),
    completedAt: null,
    status: "inProgress",
  });
  const pushTemplate = {
    ...pushB.template,
    name: "Push actuel renommé",
    exercises: pushB.template.exercises.map((exercise) => ({
      ...exercise,
      name: "Exercice du template modifié",
    })),
  };
  const store = {
    version: 2,
    templates: [pushTemplate, pull.template, active.template],
    sessions: [
      pushA.session,
      pull.session,
      pushB.session,
      abandoned.session,
      active.session,
    ],
    customDefinitions: [],
  };
  await page.evaluate(async (value) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("sport-nutrition", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("data", "readwrite");
      transaction.objectStore("data").put(value, "sport-nutrition-workouts");
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  }, store);
  await page.reload();
}

for (const width of [320, 390]) {
  test(`finishing opens the persisted recap and history at ${width}px`, async ({
    page,
  }) => {
    const summary = await createCompletedWorkout(page, width);
    await expect(summary.locator(".session-summary-date")).not.toBeEmpty();
    await expect(summary.locator(".session-summary-hero > strong")).toHaveText(
      /\d+ min|\d+ h/,
    );
    await expect(summary.locator(".session-summary-metrics")).toContainText(
      "640",
    );
    await expect(summary).toContainText("Grand pectoral · Barre");
    await expect(summary).toContainText("80 kg × 8");
    await expect(summary).toContainText("Très bonnes sensations");
    await expect(summary).toContainText("Banc position 4");
    await expect(summary).toContainText("Première séance enregistrée");
    const persisted = await page.evaluate(
      () =>
        new Promise<PersistedHistoryStore>((resolve, reject) => {
          const request = indexedDB.open("sport-nutrition", 2);
          request.onsuccess = () => {
            const db = request.result;
            const get = db
              .transaction("data")
              .objectStore("data")
              .get("sport-nutrition-workouts");
            get.onsuccess = () => resolve(get.result);
            get.onerror = () => reject(get.error);
          };
          request.onerror = () => reject(request.error);
        }),
    );
    expect(persisted.version).toBe(2);
    expect(persisted.sessions).toHaveLength(1);
    expect(persisted.sessions[0].status).toBe("completed");
    expect(persisted.sessions[0].sessionNotes).toMatchObject({
      [persisted.sessions[0].snapshot.exercises[0].id]:
        "Très bonnes sensations",
    });

    await summary.getByRole("button", { name: "RETOUR AUX SÉANCES" }).click();
    await page.getByRole("button", { name: "Retour aux séances" }).click();
    const historyTile = page.getByRole("button", {
      name: "Ouvrir Historique, 1 séance",
    });
    await historyTile.click();
    const history = page.getByRole("region", { name: "Historique" });
    await expect(
      history.getByRole("button", { name: "Ouvrir le bilan de Push bilan" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Ouvrir le bilan de Push bilan" })
      .click();
    await expect(
      page.getByRole("region", { name: "Bilan de Push bilan" }),
    ).toBeVisible();
    await page.reload();
    await page
      .getByRole("button", { name: "Ouvrir Historique, 1 séance" })
      .click();
    await expect(
      page.getByRole("button", { name: "Ouvrir le bilan de Push bilan" }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test(`history groups completed sessions and compares the same template at ${width}px`, async ({
    page,
  }) => {
    await page.goto("/");
    await seedHistory(page);
    const tile = page.getByRole("button", {
      name: "Ouvrir Historique, 3 séances",
    });
    await expect(tile).toBeVisible();
    await tile.click();
    const history = page.getByRole("region", { name: "Historique" });
    await expect(
      history.getByRole("heading", { name: "OCTOBRE 2026" }),
    ).toBeVisible();
    const rows = history.locator(".session-history-row");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText("Push B");
    await expect(rows.nth(0)).toContainText("52 min");
    await expect(rows.nth(0)).toContainText("1 série");
    await expect(rows.nth(0)).toContainText("660 kg");
    await expect(rows.nth(1)).toContainText("Pull");
    await expect(rows.nth(2)).toContainText("Push A");
    await expect(history).not.toContainText("Abandonnée");
    await expect(history).not.toContainText("Active");
    await expectNoHorizontalOverflow(page);

    await rows.nth(0).click();
    const summary = page.getByRole("region", { name: "Bilan de Push B" });
    await expect(summary).toContainText("Bench B historique");
    await expect(summary).not.toContainText("Exercice du template modifié");
    await expect(summary).toContainText("+20 kg");
    await expect(summary).toContainText("+3,1 %");
    await expect(summary).toContainText("Note de séance push-b");
    await expect(summary).toContainText("Note historique push-b");
    await expect(summary).not.toContainText(/kcal/i);
    await page.getByRole("button", { name: "Retour à l’historique" }).click();
    await expect(history).toBeVisible();
    await page.reload();
    await page
      .getByRole("button", { name: "Ouvrir Historique, 3 séances" })
      .click();
    await expect(
      page
        .getByRole("region", { name: "Historique" })
        .locator(".session-history-row"),
    ).toHaveCount(3);
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
}
