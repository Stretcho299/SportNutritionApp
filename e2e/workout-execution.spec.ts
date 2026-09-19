import { expect, test, type Page } from "@playwright/test";

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
          restEndsAt?: number;
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
  if (label === "Repos (secondes)") {
    await dialog
      .getByRole("listbox", { name: "Minutes" })
      .getByRole("option", {
        name: String(Math.floor(value / 60)),
        exact: true,
      })
      .click();
    await dialog
      .getByRole("listbox", { name: "Secondes" })
      .getByRole("option", { name: String(value % 60), exact: true })
      .click();
  } else {
    const listbox = label === "Charge (kg)" ? "Kilogrammes" : "Répétitions";
    await dialog
      .getByRole("listbox", { name: listbox })
      .getByRole("option", { name: String(value), exact: true })
      .click();
  }
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

async function readPersistedStore(page: Page): Promise<PersistedStore> {
  return page.evaluate(
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
  const newSessionA = page.getByRole("region", {
    name: "Séries de Exercice A",
  });
  await expect(newSessionA.getByLabel("Charge (kg)")).toHaveAttribute(
    "data-value",
    "80",
  );
  await expect(newSessionA.getByLabel("Répétitions")).toHaveAttribute(
    "data-value",
    "8",
  );
});

test("edits upcoming and performed sets and carries values into the next session", async ({
  page,
}) => {
  await prepareWorkout(page, "1");
  await addExercise(page, "Exercice B", "1");
  await chooseValue(page, "Charge (kg)", 80);
  await chooseValue(page, "Répétitions", 10);
  await page.getByRole("button", { name: /Démarrer la séance/i }).click();
  await chooseValue(page, "Charge (kg)", 80);
  await chooseValue(page, "Répétitions", 10);
  await page
    .getByRole("list", { name: "Exercices" })
    .getByRole("button")
    .nth(1)
    .click();
  await chooseValue(page, "Charge (kg)", 70);
  await chooseValue(page, "Répétitions", 12);
  const a = page.getByRole("region", { name: "Séries de Exercice A" });
  await page
    .getByRole("list", { name: "Exercices" })
    .getByRole("button")
    .first()
    .click();
  await a.getByRole("button", { name: "Lancer le repos" }).click();
  await a.getByRole("button", { name: "Mettre fin au repos" }).click();
  await page
    .getByRole("alertdialog", { name: "Mettre fin au repos ?" })
    .getByRole("button", { name: "Mettre fin" })
    .click();
  await expect(a.locator(".set-block").first()).toHaveClass(/status-performed/);
  await page
    .getByRole("list", { name: "Exercices" })
    .getByRole("button")
    .nth(1)
    .click();
  await expect(
    page.getByRole("list", { name: "Exercices" }).locator("li").nth(1),
  ).toHaveClass(/execution-upcoming/);
  await chooseValue(page, "Charge (kg)", 72.5);
  await chooseValue(page, "Répétitions", 8);
  await page
    .getByRole("list", { name: "Exercices" })
    .getByRole("button")
    .first()
    .click();
  await chooseValue(page, "Charge (kg)", 82.5);
  await chooseValue(page, "Répétitions", 8);
  await expect(a.locator(".set-block").first()).toHaveClass(/status-performed/);
  await expect(a.getByRole("button", { name: "Supprimer" })).toHaveCount(0);
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "1");
  await page.reload();
  await page.locator(".workout-card").click();
  await expect(
    page
      .getByRole("region", { name: "Séries de Exercice A" })
      .getByLabel("Charge (kg)"),
  ).toHaveAttribute("data-value", "82.5");
  await page
    .getByRole("list", { name: "Exercices" })
    .getByRole("button")
    .nth(1)
    .click();
  await expect(
    page
      .getByRole("region", { name: "Séries de Exercice B" })
      .getByLabel("Charge (kg)"),
  ).toHaveAttribute("data-value", "72.5");
  const reloadedB = page.getByRole("region", {
    name: "Séries de Exercice B",
  });
  await reloadedB.getByRole("button", { name: "Lancer le repos" }).click();
  await expect(
    page.getByRole("button", { name: "Terminer la séance" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Terminer la séance" }).click();
  await page
    .getByRole("alertdialog", { name: "Terminer la séance ?" })
    .getByRole("button", { name: "Terminer" })
    .click();
  await page.getByRole("button", { name: "Retour aux séances" }).click();
  await page.locator(".workout-card").click();
  await page.getByRole("button", { name: /Démarrer la séance/i }).click();
  await expect(
    page
      .getByRole("region", { name: "Séries de Exercice A" })
      .getByLabel("Charge (kg)"),
  ).toHaveAttribute("data-value", "82.5");
  await page
    .getByRole("list", { name: "Exercices" })
    .getByRole("button")
    .nth(1)
    .click();
  await expect(
    page
      .getByRole("region", { name: "Séries de Exercice B" })
      .getByLabel("Charge (kg)"),
  ).toHaveAttribute("data-value", "72.5");
});

test("persists structural session changes in the template and next session", async ({
  page,
}) => {
  await prepareWorkout(page, "3");
  await page.getByRole("button", { name: /Démarrer la séance/i }).click();
  await page.getByRole("button", { name: "+ Ajouter une série" }).click();
  await expect(page.locator(".set-block")).toHaveCount(4);
  await addExercise(page, "Exercice B", "1");
  await expect(
    page.getByRole("list", { name: "Exercices" }).getByRole("button"),
  ).toHaveCount(2);
  await expect
    .poll(async () => {
      const store = await readPersistedStore(page);
      return [
        store.templates[0].exercises[0].plannedSets.length,
        store.templates[0].exercises.length,
      ];
    })
    .toEqual([4, 2]);

  await page
    .getByRole("list", { name: "Exercices" })
    .getByRole("button")
    .first()
    .click();
  await page.getByRole("button", { name: "Terminer l’exercice" }).click();
  await page
    .getByRole("alertdialog", { name: "Mettre fin à cet exercice ?" })
    .getByRole("button", { name: "Mettre fin" })
    .click();
  await page
    .getByRole("list", { name: "Exercices" })
    .getByRole("button")
    .nth(1)
    .click();
  await page.getByRole("button", { name: "Terminer l’exercice" }).click();
  await page
    .getByRole("alertdialog", { name: "Mettre fin à cet exercice ?" })
    .getByRole("button", { name: "Mettre fin" })
    .click();
  await page.getByRole("button", { name: "Terminer la séance" }).click();
  await page
    .getByRole("alertdialog", { name: "Terminer la séance ?" })
    .getByRole("button", { name: "Terminer" })
    .click();
  await page.getByRole("button", { name: "Retour aux séances" }).click();
  await page.locator(".workout-card").click();
  await page.getByRole("button", { name: /Démarrer la séance/i }).click();
  await page
    .getByRole("list", { name: "Exercices" })
    .getByRole("button")
    .first()
    .click();
  await expect(page.locator(".set-block")).toHaveCount(4);
  await expect(
    page.getByRole("list", { name: "Exercices" }).getByRole("button"),
  ).toHaveCount(2);
});

test("syncs planned rest without changing an active chrono", async ({
  page,
}) => {
  await prepareWorkout(page, "1");
  await addExercise(page, "Exercice B", "1");
  await chooseValue(page, "Repos (secondes)", 120);
  await page.getByRole("button", { name: /Démarrer la séance/i }).click();
  const a = page.getByRole("region", { name: "Séries de Exercice A" });
  await a.getByRole("button", { name: "Lancer le repos" }).click();
  await expect
    .poll(async () => {
      const store = await readPersistedStore(page);
      return store.sessions[0].execution.exercises[0].sets[0].restEndsAt;
    })
    .toBeDefined();
  const before = await readPersistedStore(page);
  const restEndsAt =
    before.sessions[0].execution.exercises[0].sets[0].restEndsAt;
  await chooseValue(page, "Repos (secondes)", 150);
  await expect
    .poll(async () => {
      const store = await readPersistedStore(page);
      return [
        store.templates[0].exercises[0].plannedSets[0].restSeconds,
        store.sessions[0].execution.exercises[0].sets[0].restSeconds,
        store.sessions[0].execution.exercises[0].sets[0].restEndsAt,
      ];
    })
    .toEqual([150, 150, restEndsAt]);
  await expect(page.getByRole("timer")).toBeVisible();
  await a.getByRole("button", { name: "Mettre fin au repos" }).click();
  await page
    .getByRole("alertdialog", { name: "Mettre fin au repos ?" })
    .getByRole("button", { name: "Mettre fin" })
    .click();
  await chooseValue(page, "Repos (secondes)", 180);
  await expect(a.locator(".set-block").first()).toHaveClass(/status-performed/);
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "1");
  await page
    .getByRole("list", { name: "Exercices" })
    .getByRole("button")
    .nth(1)
    .click();
  await chooseValue(page, "Repos (secondes)", 90);
  await expect
    .poll(async () => {
      const store = await readPersistedStore(page);
      return [
        store.templates[0].exercises[0].plannedSets[0].restSeconds,
        store.templates[0].exercises[1].plannedSets[0].restSeconds,
        store.sessions[0].execution.exercises[0].sets[0].status,
        store.sessions[0].execution.exercises[0].sets[0].restSeconds,
      ];
    })
    .toEqual([180, 90, "performed", 180]);
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
    repetitions: 8,
    weightKg: null,
    restSeconds: 90,
  });
  expect(sessionA!.execution.exercises[0].sets[0]).toMatchObject({
    repetitions: 8,
  });
  expect(sessionB!.snapshot.exercises[0].plannedSets[0]).toMatchObject({
    repetitions: 8,
    weightKg: null,
    restSeconds: 90,
  });
  expect(sessionB!.execution.exercises[0].sets[0]).toMatchObject({
    repetitions: 8,
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
