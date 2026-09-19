import { expect, test } from "@playwright/test";

type PersistedStore = {
  templates: Array<{
    id: string;
    execution?: unknown;
    exercises: Array<{
      plannedSets: Array<{
        repetitions: number | null;
        weightKg: number | null;
        restSeconds: number;
      }>;
    }>;
  }>;
  sessions: Array<{
    id: string;
    status: string;
    templateId: string;
    snapshot: PersistedStore["templates"][number];
    execution: {
      exercises: Array<{
        sets: Array<{
          repetitions: number | null;
          weightKg: number | null;
          restSeconds: number;
        }>;
      }>;
    };
  }>;
};

async function addExercise(page: Page, name: string, count = "1") {
  await page.getByRole("button", { name: /Gérer les exercices/i }).click();
  await page
    .getByRole("dialog", { name: /Actions de la séance/i })
    .getByRole("button", { name: /Ajouter un exercice/i })
    .click();
  await page.getByRole("textbox", { name: "Nom" }).fill(name);
  await page.getByLabel(/Nombre de séries initiales/i).fill(count);
  await page
    .getByRole("spinbutton", { name: "Repos par défaut (secondes)" })
    .fill("30");
  await page.getByRole("button", { name: /Enregistrer/i }).click();
}

async function chooseValue(page: Page, label: string, value: number) {
  await page.getByRole("button", { name: label, exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: `Choisir ${label}` });
  const listbox = label === "Charge (kg)" ? "Kilogrammes" : "Répétitions";
  await dialog
    .getByRole("listbox", { name: listbox })
    .getByRole("option", { name: String(value), exact: true })
    .click();
  await dialog.getByRole("button", { name: "Valider" }).click();
}

async function finishRest(
  page: Page,
  region: import("@playwright/test").Locator,
) {
  await region.getByRole("button", { name: "Lancer le repos" }).click();
  await region.getByRole("button", { name: "Mettre fin au repos" }).click();
  await page
    .getByRole("alertdialog", { name: "Mettre fin au repos ?" })
    .getByRole("button", { name: "Mettre fin" })
    .click();
}

async function prepareWorkout(page, setCount = "2") {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /Créer une séance/i }).click();
  await page.getByRole("textbox", { name: "Nom" }).fill("Séance E2E");
  await page.getByRole("button", { name: /Enregistrer/i }).click();
  await page.locator(".workout-card").click();
  await page.getByRole("button", { name: /Gérer les exercices/i }).click();
  await page
    .getByRole("dialog", { name: /Actions de la séance/i })
    .getByRole("button", { name: /Ajouter un exercice/i })
    .click();
  await page.getByRole("textbox", { name: "Nom" }).fill("Exercice A");
  await page.getByLabel(/Nombre de séries initiales/i).fill(setCount);
  await page
    .getByRole("spinbutton", { name: "Repos par défaut (secondes)" })
    .fill("90");
  await page.getByRole("button", { name: /Enregistrer/i }).click();
}

test("adds a third set after starting a workout", async ({ page }) => {
  await prepareWorkout(page);
  await page.getByRole("button", { name: /Démarrer la séance/i }).click();
  const region = page.getByRole("region", { name: "Séries de Exercice A" });
  const addSet = page.getByRole("button", { name: "+ Ajouter une série" });
  await expect(addSet).toBeVisible();
  await addSet.click();
  await expect(region.getByRole("listitem")).toHaveCount(3);
  await expect(region.getByRole("heading", { name: "SÉRIE 3" })).toBeVisible();
});

test("adds a third set while the first set is active", async ({ page }) => {
  await prepareWorkout(page);
  await page.getByRole("button", { name: /Démarrer la séance/i }).click();
  const region = page.getByRole("region", { name: "Séries de Exercice A" });
  const blocks = region.getByRole("listitem");
  await blocks.nth(0).getByRole("button", { name: "Lancer le repos" }).click();
  const addSet = page.getByRole("button", { name: "+ Ajouter une série" });
  await expect(addSet).toBeVisible();
  await addSet.click();
  await expect(blocks).toHaveCount(3);
  await expect(blocks.nth(0)).toContainText("Repos en cours");
  await expect(blocks.nth(2)).toContainText("À venir");
});

test("does not activate the next exercise when deleting an upcoming set", async ({
  page,
}) => {
  await prepareWorkout(page);
  await page.getByRole("button", { name: /Gérer les exercices/i }).click();
  await page
    .getByRole("dialog", { name: /Actions de la séance/i })
    .getByRole("button", { name: /Ajouter un exercice/i })
    .click();
  await page.getByRole("textbox", { name: "Nom" }).fill("Exercice B");
  await page.getByLabel(/Nombre de séries initiales/i).fill("1");
  await page
    .getByRole("spinbutton", { name: "Repos par défaut (secondes)" })
    .fill("90");
  await page.getByRole("button", { name: /Enregistrer/i }).click();
  await page.getByRole("button", { name: /Démarrer la séance/i }).click();
  const aRegion = page.getByRole("region", { name: "Séries de Exercice A" });
  await aRegion
    .getByRole("listitem")
    .nth(1)
    .getByRole("button", { name: "Supprimer" })
    .click();
  const tabs = page.getByRole("list", { name: "Exercices" }).locator("li");
  await expect(tabs.nth(0)).toHaveClass(/execution-active/);
  await expect(tabs.nth(1)).toHaveClass(/execution-upcoming/);
  await aRegion.getByRole("button", { name: "Lancer le repos" }).click();
  await aRegion.getByRole("button", { name: "Mettre fin au repos" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Mettre fin" })
    .click();
  await expect(tabs.nth(0)).toHaveClass(/execution-completed/);
  await expect(tabs.nth(1)).toHaveClass(/execution-upcoming/);
});

test("starts from the selected exercise and keeps other tabs upcoming", async ({
  page,
}) => {
  await prepareWorkout(page, "2");
  for (const name of ["Exercice B", "Exercice C"]) {
    await page.getByRole("button", { name: /Gérer les exercices/i }).click();
    await page
      .getByRole("dialog", { name: /Actions de la séance/i })
      .getByRole("button", { name: /Ajouter un exercice/i })
      .click();
    await page.getByRole("textbox", { name: "Nom" }).fill(name);
    await page.getByLabel(/Nombre de séries initiales/i).fill("2");
    await page
      .getByRole("spinbutton", { name: "Repos par défaut (secondes)" })
      .fill("90");
    await page.getByRole("button", { name: /Enregistrer/i }).click();
  }

  const tabs = page.getByRole("list", { name: "Exercices" }).locator("li");
  await tabs.nth(1).getByRole("button").click();
  await page.getByRole("button", { name: /Démarrer la séance/i }).click();
  await expect(tabs.nth(0)).toHaveClass(/execution-upcoming/);
  await expect(tabs.nth(1)).toHaveClass(/execution-active/);
  await expect(tabs.nth(2)).toHaveClass(/execution-upcoming/);

  await tabs.nth(0).getByRole("button").click();
  await expect(tabs.nth(0)).toHaveClass(/execution-upcoming/);
  await tabs.nth(2).getByRole("button").click();
  await expect(tabs.nth(2)).toHaveClass(/execution-upcoming/);
  await expect(tabs.nth(1)).toHaveClass(/execution-active/);
});

test("finishing exercise A does not activate exercise B", async ({ page }) => {
  await prepareWorkout(page, "1");
  await addExercise(page, "Exercice B", "1");
  const tabs = page.getByRole("list", { name: "Exercices" }).locator("li");
  await page.getByRole("button", { name: /Démarrer la séance/i }).click();
  const a = page.getByRole("region", { name: "Séries de Exercice A" });
  await finishRest(page, a);
  await expect(tabs.nth(0)).toHaveClass(/execution-completed/);
  await expect(tabs.nth(1)).toHaveClass(/execution-upcoming/);
});

test("finishing exercise A explicitly does not activate exercise B", async ({
  page,
}) => {
  await prepareWorkout(page, "1");
  await addExercise(page, "Exercice B", "1");
  const tabs = page.getByRole("list", { name: "Exercices" }).locator("li");
  await page.getByRole("button", { name: /Démarrer la séance/i }).click();
  await page.getByRole("button", { name: "Terminer l’exercice" }).click();
  await page
    .getByRole("alertdialog", { name: "Mettre fin à cet exercice ?" })
    .getByRole("button", { name: "Mettre fin" })
    .click();
  await expect(tabs.nth(0)).toHaveClass(/execution-completed/);
  await expect(tabs.nth(1)).toHaveClass(/execution-upcoming/);
});

test("deletes an active non-performed set", async ({ page }) => {
  await prepareWorkout(page, "2");
  await page.getByRole("button", { name: /Démarrer la séance/i }).click();
  const region = page.getByRole("region", { name: "Séries de Exercice A" });
  await region
    .getByRole("listitem")
    .first()
    .getByRole("button", { name: "Supprimer" })
    .click();
  await expect(region.getByRole("listitem")).toHaveCount(1);
  await expect(region.locator(".set-block").first()).toHaveClass(
    /status-upcoming/,
  );
});

test("removing an untouched four-set exercise removes its work from progress", async ({
  page,
}) => {
  await prepareWorkout(page, "1");
  await addExercise(page, "Exercice B", "4");
  await page.getByRole("button", { name: /Démarrer la séance/i }).click();
  await page
    .getByRole("list", { name: "Exercices" })
    .getByRole("button")
    .nth(1)
    .click();
  await page.getByRole("button", { name: /Gérer les exercices/i }).click();
  await page
    .getByRole("dialog", { name: /Actions de la séance/i })
    .getByRole("button", { name: /Supprimer l’exercice/i })
    .click();
  await expect(
    page.getByRole("region", { name: "Progression de la séance" }),
  ).toContainText("0/1");
});

test("removing an exercise keeps performed sets in session progress", async ({
  page,
}) => {
  await prepareWorkout(page, "4");
  await addExercise(page, "Exercice B", "1");
  await page.getByRole("button", { name: /Démarrer la séance/i }).click();
  const a = page.getByRole("region", { name: "Séries de Exercice A" });
  await finishRest(page, a);
  await finishRest(page, a);
  await page.getByRole("button", { name: /Gérer les exercices/i }).click();
  await page
    .getByRole("dialog", { name: /Actions de la séance/i })
    .getByRole("button", { name: /Supprimer l’exercice/i })
    .click();
  await page
    .getByRole("alertdialog", { name: "Supprimer cet exercice ?" })
    .getByRole("button", { name: "Supprimer" })
    .click();
  await expect(
    page.getByRole("region", { name: "Progression de la séance" }),
  ).toContainText("2/3");
});

test("adding work after all exercises are done hides the finish-session action", async ({
  page,
}) => {
  await prepareWorkout(page, "1");
  await page.getByRole("button", { name: /Démarrer la séance/i }).click();
  const a = page.getByRole("region", { name: "Séries de Exercice A" });
  await a.getByRole("button", { name: "Lancer le repos" }).click();
  await expect(
    page.getByRole("button", { name: "Terminer la séance" }),
  ).toBeVisible();
  await addExercise(page, "Exercice B", "1");
  await expect(
    page.getByRole("button", { name: "Terminer la séance" }),
  ).not.toBeVisible();
  await page
    .getByRole("list", { name: "Exercices" })
    .getByRole("button")
    .nth(1)
    .click();
  await page
    .getByRole("region", { name: "Séries de Exercice B" })
    .getByRole("button", { name: "Lancer le repos" })
    .click();
  await expect(
    page.getByRole("button", { name: "Terminer la séance" }),
  ).toBeVisible();
});

test("persists session kg and reps through exercise changes, reload, and a new session", async ({
  page,
}) => {
  await prepareWorkout(page, "1");
  await addExercise(page, "Exercice B", "1");
  await page.getByRole("button", { name: /Démarrer la séance/i }).click();
  await chooseValue(page, "Charge (kg)", 80);
  await chooseValue(page, "Répétitions", 8);
  const tabs = page
    .getByRole("list", { name: "Exercices" })
    .getByRole("button");
  await tabs.nth(1).click();
  await tabs.nth(0).click();
  await expect(page.getByLabel("Charge (kg)")).toHaveAttribute(
    "data-value",
    "80",
  );
  await expect(page.getByLabel("Répétitions")).toHaveAttribute(
    "data-value",
    "8",
  );
  await page.reload();
  await page.locator(".workout-card").click();
  await expect(page.getByLabel("Charge (kg)")).toHaveAttribute(
    "data-value",
    "80",
  );
  await expect(page.getByLabel("Répétitions")).toHaveAttribute(
    "data-value",
    "8",
  );
  const a = page.getByRole("region", { name: "Séries de Exercice A" });
  await a.getByRole("button", { name: "Lancer le repos" }).click();
  await a.getByRole("button", { name: "Mettre fin au repos" }).click();
  await page
    .getByRole("alertdialog", { name: "Mettre fin au repos ?" })
    .getByRole("button", { name: "Mettre fin" })
    .click();
  await page
    .getByRole("list", { name: "Exercices" })
    .getByRole("button")
    .nth(1)
    .click();
  await page
    .getByRole("region", { name: "Séries de Exercice B" })
    .getByRole("button", { name: "Lancer le repos" })
    .click();
  await page.getByRole("button", { name: "Terminer la séance" }).click();
  await page
    .getByRole("alertdialog", { name: "Terminer la séance ?" })
    .getByRole("button", { name: "Terminer" })
    .click();
  await page.getByRole("button", { name: "Retour aux séances" }).click();
  await page.locator(".workout-card").click();
  await page.getByRole("button", { name: /Démarrer la séance/i }).click();
  await expect(page.getByLabel("Charge (kg)")).toHaveAttribute(
    "data-value",
    "",
  );
  await expect(page.getByLabel("Répétitions")).toHaveAttribute(
    "data-value",
    "",
  );
});

test("reuses a template and persists independent session snapshots", async ({
  page,
}) => {
  await prepareWorkout(page, "2");
  await page.getByRole("button", { name: /Démarrer la séance/i }).click();
  const region = page.getByRole("region", { name: "Séries de Exercice A" });
  await region
    .getByRole("listitem")
    .nth(0)
    .getByRole("button", { name: "Répétitions" })
    .click();
  await page
    .getByRole("dialog", { name: /Choisir Répétitions/i })
    .getByRole("option", { name: "8", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: /Choisir Répétitions/i })
    .getByRole("button", { name: "Valider" })
    .click();
  await region.getByRole("button", { name: "Lancer le repos" }).click();
  await region.getByRole("button", { name: "Mettre fin au repos" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Mettre fin" })
    .click();
  await region
    .getByRole("listitem")
    .nth(1)
    .getByRole("button", { name: "Lancer le repos" })
    .click();
  await page.getByRole("button", { name: "Terminer la séance" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Terminer" })
    .click();
  await page.getByRole("button", { name: "Retour aux séances" }).click();
  await page.locator(".workout-card").click();
  await expect(
    page.getByRole("button", { name: "Démarrer la séance" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Démarrer la séance" }).click();
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open("sport-nutrition", 2);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        return await new Promise<number>((resolve, reject) => {
          const request = db
            .transaction("data")
            .objectStore("data")
            .get("sport-nutrition-workouts");
          request.onsuccess = () =>
            resolve((request.result?.sessions ?? []).length);
          request.onerror = () => reject(request.error);
        });
      }),
    )
    .toBe(2);
  const stored = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("sport-nutrition", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return await new Promise<PersistedStore>((resolve, reject) => {
      const request = db
        .transaction("data")
        .objectStore("data")
        .get("sport-nutrition-workouts");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
  expect(stored.templates).toHaveLength(1);
  expect(stored.sessions).toHaveLength(2);
  const sessionA = stored.sessions.find(
    (session) => session.status === "completed",
  );
  const sessionB = stored.sessions.find(
    (session) => session.status === "inProgress",
  );
  expect(sessionA).toBeDefined();
  expect(sessionB).toBeDefined();
  expect(sessionA!.id).not.toBe(sessionB!.id);
  expect(sessionA!.templateId).toBe(sessionB!.templateId);
  expect(stored.templates[0].execution).toBeUndefined();
  expect(stored.templates[0].exercises[0].plannedSets[0]).toMatchObject({
    repetitions: null,
    weightKg: null,
    restSeconds: 90,
  });
  expect(sessionA!.execution.exercises[0].sets[0]).toMatchObject({
    repetitions: 8,
  });
  expect(sessionB!.snapshot.exercises[0].plannedSets[0]).toMatchObject({
    repetitions: null,
    weightKg: null,
    restSeconds: 90,
  });
  expect(sessionB!.execution.exercises[0].sets[0]).toMatchObject({
    repetitions: null,
    weightKg: null,
    restSeconds: 90,
  });
  await page.reload();
  const afterReload = await page.evaluate(
    () =>
      new Promise<PersistedStore>((resolve, reject) => {
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
  expect(afterReload.sessions).toHaveLength(2);
  expect(
    afterReload.sessions.filter(
      (session: { status: string }) => session.status === "inProgress",
    ),
  ).toHaveLength(1);
  expect(afterReload.sessions.map((session) => session.id)).toEqual(
    expect.arrayContaining([sessionA!.id, sessionB!.id]),
  );
  expect(afterReload.sessions).toHaveLength(2);
});
