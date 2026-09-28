import { expect, test, type Locator, type Page } from "@playwright/test";

type PersistedStore = {
  templates: Array<{
    id: string;
    execution?: unknown;
    exercises: Array<{
      permanentNote?: string;
      plannedSets: Array<{
        repetitions: number | null;
        weightKg: number | null;
        restSeconds: number;
      }>;
    }>;
  }>;
  sessions: Array<{
    id: string;
    startedAt: number;
    completedAt: number | null;
    status: string;
    sessionNotes?: Record<string, string>;
    templateId: string;
    snapshot: PersistedStore["templates"][number];
    execution: {
      startedAt: number;
      completedAt?: number;
      exercises: Array<{
        sets: Array<{
          repetitions: number | null;
          weightKg: number | null;
          restSeconds: number;
          restEndsAt?: number;
          restDurationSeconds?: number;
        }>;
      }>;
    };
  }>;
};

async function saveSheet(page: Page, title: string, expectedName: string) {
  const sheet = page.getByRole("dialog", { name: title });
  await expect(sheet.getByRole("textbox", { name: "Nom" })).toHaveValue(
    expectedName,
  );
  await sheet.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(sheet).toHaveCount(0);
}

async function dragDismissSheet(page: Page) {
  const handle = page.getByRole("button", { name: "Fermer le panneau" });
  await handle.scrollIntoViewIfNeeded();
  const bounds = await handle.boundingBox();
  if (!bounds) throw new Error("sheet handle has no bounding box");
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 120, { steps: 8 });
  await page.mouse.up();
}

async function addExercise(page: Page, name: string, count = "1") {
  await page.getByRole("button", { name: /Gérer les exercices/i }).click();
  await page
    .getByRole("dialog", { name: /Actions de la séance/i })
    .getByRole("button", { name: /Ajouter un exercice/i })
    .click();
  await page.getByRole("textbox", { name: "Nom" }).fill(name);
  await chooseValue(page, "Nombre de séries initiales", Number(count));
  await chooseValue(page, "Repos par défaut", 30);
  await saveSheet(page, "Exercice", name);
}

async function expectPickerSave(picker: Locator) {
  const save = picker.getByRole("button", {
    name: "ENREGISTRER",
    exact: true,
  });
  await expect(save).toBeVisible();
  const colors = await picker.evaluate((element) => {
    const button = element.querySelector<HTMLElement>(".picker-save")!;
    const style = getComputedStyle(button);
    const probe = document.createElement("span");
    probe.style.backgroundColor = "var(--accent)";
    probe.style.color = "var(--accent-ink)";
    document.body.append(probe);
    const expected = getComputedStyle(probe);
    const result = {
      background: style.backgroundColor,
      color: style.color,
      expectedBackground: expected.backgroundColor,
      expectedColor: expected.color,
    };
    probe.remove();
    return result;
  });
  expect(colors.background).toBe(colors.expectedBackground);
  expect(colors.background).toMatch(/rgb\(255,\s*\d+,\s*\d+\)/);
  expect(colors.color).toBe(colors.expectedColor);
  const bounds = await save.boundingBox();
  const footerBounds = await picker.locator(".picker-actions").boundingBox();
  expect(bounds).not.toBeNull();
  expect(footerBounds).not.toBeNull();
  expect(Math.abs(bounds!.width - footerBounds!.width)).toBeLessThanOrEqual(1);
  return save;
}

async function chooseValue(page: Page, label: string, value: number) {
  await page.getByRole("button", { name: label, exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: `Choisir ${label}` });
  if (label.startsWith("Repos")) {
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
    const listbox =
      label === "Charge (kg)"
        ? "Kilogrammes"
        : label === "Nombre de séries initiales"
          ? "Séries"
          : "Répétitions";
    await dialog
      .getByRole("listbox", { name: listbox })
      .getByRole("option", { name: String(value), exact: true })
      .click();
  }
  await (await expectPickerSave(dialog)).click();
  await expect(dialog).toHaveCount(0);
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

async function scrollInElement(page: Page, target: Locator, deltaY: number) {
  if (page.context().browser()?.browserType().name() === "webkit") {
    await target.evaluate((element, delta) => {
      const limit = Math.max(0, element.scrollHeight - element.clientHeight);
      element.scrollTop = Math.min(
        limit,
        Math.max(0, element.scrollTop + delta),
      );
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
    }, deltaY);
    return;
  }
  const bounds = await target.boundingBox();
  if (!bounds) throw new Error("scroll target has no bounding box");
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  await page.mouse.wheel(0, deltaY);
}

async function setVisualViewport(
  page: Page,
  height: number,
  offsetTop: number,
) {
  await page.evaluate(
    ({ height, offsetTop }) => {
      const viewport = window.visualViewport;
      if (!viewport) throw new Error("visualViewport is unavailable");
      Object.defineProperties(viewport, {
        height: { configurable: true, value: height },
        offsetTop: { configurable: true, value: offsetTop },
      });
      viewport.dispatchEvent(new Event("resize"));
      viewport.dispatchEvent(new Event("scroll"));
    },
    { height, offsetTop },
  );
}

async function prepareWorkout(page, setCount = "2") {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "Ouvrir Mes séances" }).click();
  await page.getByRole("button", { name: "Créer une séance" }).click();
  await page.getByRole("textbox", { name: "Nom" }).fill("Séance E2E");
  await saveSheet(page, "Séance", "Séance E2E");
  await page.locator(".workout-card").click();
  await expect(page.locator(".workout-preparation, .empty")).toBeVisible();
  await page.getByRole("button", { name: /Gérer les exercices/i }).click();
  await page
    .getByRole("dialog", { name: /Actions de la séance/i })
    .getByRole("button", { name: /Ajouter un exercice/i })
    .click();
  await page.getByRole("textbox", { name: "Nom" }).fill("Exercice A");
  await chooseValue(page, "Nombre de séries initiales", Number(setCount));
  await chooseValue(page, "Repos par défaut", 90);
  await saveSheet(page, "Exercice", "Exercice A");
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
  await chooseValue(page, "Nombre de séries initiales", 1);
  await chooseValue(page, "Repos par défaut", 90);
  await saveSheet(page, "Exercice", "Exercice B");
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
    await chooseValue(page, "Nombre de séries initiales", 2);
    await chooseValue(page, "Repos par défaut", 90);
    await saveSheet(page, "Exercice", name);
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
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "0");
  await expect(page.getByRole("progressbar")).toHaveAttribute("max", "1");
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
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "2");
  await expect(page.getByRole("progressbar")).toHaveAttribute("max", "3");
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
  await expect(
    page.getByRole("region", { name: "Aperçu de Séance E2E" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "PRÉPARER LA SÉANCE" }).click();
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
  await expect(
    page.getByRole("region", { name: "Aperçu de Séance E2E" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "PRÉPARER LA SÉANCE" }).click();
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
  await expect(
    page.getByRole("region", { name: "Aperçu de Séance E2E" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "PRÉPARER LA SÉANCE" }).click();
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
  await chooseValue(page, "Repos", 30);
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
  const timer = page.getByRole("timer", { name: "Temps de repos restant" });
  await expect(timer).toHaveAttribute("data-reference-seconds", "30");
  const beforeProgress = await timer
    .locator(".countdown-value")
    .getAttribute("stroke-dashoffset")
    .then(Number);
  await chooseValue(page, "Repos", 60);
  await expect
    .poll(async () => {
      const store = await readPersistedStore(page);
      return [
        store.templates[0].exercises[0].plannedSets[0].restSeconds,
        store.sessions[0].execution.exercises[0].sets[0].restSeconds,
        store.sessions[0].execution.exercises[0].sets[0].restEndsAt,
        store.sessions[0].execution.exercises[0].sets[0].restDurationSeconds,
      ];
    })
    .toEqual([60, 60, restEndsAt, 30]);
  await expect(timer).toBeVisible();
  await expect(timer).toHaveAttribute("data-reference-seconds", "30");
  const afterProgress = await timer
    .locator(".countdown-value")
    .getAttribute("stroke-dashoffset")
    .then(Number);
  expect(afterProgress).toBeGreaterThanOrEqual(beforeProgress);
  expect(afterProgress).toBeLessThan(50);
  await page.reload();
  await page.locator(".workout-card").click();
  await expect(
    page.getByRole("timer", { name: "Temps de repos restant" }),
  ).toBeVisible();
  await expect(
    page.getByRole("timer", { name: "Temps de repos restant" }),
  ).toHaveAttribute("data-reference-seconds", "30");
  await expect
    .poll(async () => {
      const store = await readPersistedStore(page);
      const set = store.sessions[0].execution.exercises[0].sets[0];
      return [set.restEndsAt, set.restDurationSeconds, set.restSeconds];
    })
    .toEqual([restEndsAt, 30, 60]);
  await a.getByRole("button", { name: "Mettre fin au repos" }).click();
  await page
    .getByRole("alertdialog", { name: "Mettre fin au repos ?" })
    .getByRole("button", { name: "Mettre fin" })
    .click();
  await chooseValue(page, "Repos", 180);
  await expect(a.locator(".set-block").first()).toHaveClass(/status-performed/);
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "1");
  await page
    .getByRole("list", { name: "Exercices" })
    .getByRole("button")
    .nth(1)
    .click();
  await chooseValue(page, "Repos", 90);
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
    .getByRole("button", { name: "ENREGISTRER", exact: true })
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
  await expect(
    page.getByRole("region", { name: "Aperçu de Séance E2E" }),
  ).toBeVisible();
  await expect(page.getByText("Première séance")).toHaveCount(0);
  await expect(page.getByText("Durée moyenne")).toBeVisible();
  await expect(page.getByText("Calories moyennes")).toBeVisible();
  await expect(page.getByText("Pas encore de données")).toHaveCount(2);
  await expect(
    page.getByRole("button", {
      name: "PRÉPARER LA SÉANCE",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "PRÉPARER LA SÉANCE", exact: true })
    .click();
  expect((await readPersistedStore(page)).sessions).toHaveLength(1);
  expect((await readPersistedStore(page)).sessions[0].status).toBe("completed");
  await page.getByRole("button", { name: "Retour aux séances" }).click();
  await expect(
    page.getByRole("region", { name: "Aperçu de Séance E2E" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retour aux séances" }).click();
  await expect(page.getByRole("region", { name: "Mes séances" })).toBeVisible();
  await page.locator(".workout-card").click();
  await expect(
    page.getByRole("region", { name: "Aperçu de Séance E2E" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "PRÉPARER LA SÉANCE" }).click();
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

test("returns to dashboard and resumes the same active session, then abandons it explicitly", async ({
  page,
}) => {
  await prepareWorkout(page, "1");
  await page.getByRole("button", { name: /Démarrer la séance/i }).click();
  const original = await readPersistedStore(page);
  const sessionId = original.sessions[0].id;
  await page.getByRole("button", { name: "Retour aux séances" }).click();
  await expect(
    page.getByRole("region", { name: "Séance en cours" }),
  ).toBeVisible();
  await expect(page.getByText("Reprendre")).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("region", { name: "Séance en cours" }),
  ).toBeVisible();
  await page.locator(".workout-card-active").click();
  expect(
    (await readPersistedStore(page)).sessions.map((item) => item.id),
  ).toEqual([sessionId]);
  await expect(
    page.getByRole("region", { name: "Séries de Exercice A" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Réorganiser les exercices" }).click();
  await page
    .getByRole("dialog", { name: "Organisation de la séance" })
    .getByRole("button", { name: "Abandonner la séance" })
    .click();
  const confirmation = page.getByRole("alertdialog", {
    name: "Abandonner la séance ?",
  });
  await confirmation.getByRole("button", { name: "Annuler" }).click();
  expect((await readPersistedStore(page)).sessions[0].status).toBe(
    "inProgress",
  );

  await page
    .getByRole("dialog", { name: "Organisation de la séance" })
    .getByRole("button", { name: "Abandonner la séance" })
    .click();
  await page
    .getByRole("alertdialog", { name: "Abandonner la séance ?" })
    .getByRole("button", { name: "Abandonner la séance" })
    .click();
  await expect(
    page.getByRole("region", { name: "Séance en cours" }),
  ).toHaveCount(0);
  await expect
    .poll(async () => (await readPersistedStore(page)).sessions[0].status)
    .toBe("abandoned");
  const abandoned = await readPersistedStore(page);
  expect(abandoned.sessions).toHaveLength(1);
  expect(abandoned.sessions[0]).toMatchObject({
    id: sessionId,
    status: "abandoned",
  });
  expect(abandoned.templates).toHaveLength(1);
  await page.getByRole("button", { name: "Ouvrir Mes séances" }).click();
  await expect(page.getByText("Séance E2E")).toBeVisible();
  await page.locator(".workout-card").click();
  await expect(page.locator(".workout-preparation, .empty")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Aperçu de Séance E2E" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /Démarrer la séance/i }).click();
  await expect
    .poll(async () =>
      (await readPersistedStore(page)).sessions.map((item) => item.status),
    )
    .toEqual(["abandoned", "inProgress"]);
  expect((await readPersistedStore(page)).sessions[0].id).toBe(sessionId);
  expect((await readPersistedStore(page)).sessions[1].id).not.toBe(sessionId);
});

test("does not create a second active session while another template is active", async ({
  page,
}) => {
  await prepareWorkout(page, "1");
  await page.getByRole("button", { name: /Démarrer la séance/i }).click();
  await page.getByRole("button", { name: "Retour aux séances" }).click();
  await page.getByRole("button", { name: "Ouvrir Mes séances" }).click();
  await page.getByRole("button", { name: "Créer une séance" }).click();
  await page.getByRole("textbox", { name: "Nom" }).fill("Deuxième modèle");
  await saveSheet(page, "Séance", "Deuxième modèle");
  await page.getByText("Deuxième modèle").click();
  await expect(page.locator(".workout-preparation, .empty")).toBeVisible();
  await addExercise(page, "Exercice B", "1");
  await page.getByRole("button", { name: /Démarrer la séance/i }).click();
  await expect
    .poll(async () => {
      const store = await readPersistedStore(page);
      return store.sessions.filter(
        (item) =>
          item.status === "inProgress" || item.status === "readyToFinish",
      ).length;
    })
    .toBe(1);
  const store = await readPersistedStore(page);
  expect(store.sessions).toHaveLength(1);
  expect(store.templates.map((item) => item.name)).toEqual([
    "Séance E2E",
    "Deuxième modèle",
  ]);
});

test("starts the session clock only on start and restores elapsed wall time after resume", async ({
  page,
}) => {
  await prepareWorkout(page, "1");
  await expect(
    page.getByRole("region", { name: "Aperçu de Séance E2E" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Retour aux séances" }).click();
  await expect(page.getByRole("region", { name: "Mes séances" })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Aperçu de Séance E2E" }),
  ).toHaveCount(0);
  await page.locator(".workout-card").click();
  await expect(page.locator(".workout-preparation, .empty")).toBeVisible();
  expect((await readPersistedStore(page)).sessions).toHaveLength(0);
  const start = page.getByRole("button", { name: "Démarrer la séance" });
  await start.click();
  const timer = page.getByRole("timer", { name: "Durée de la séance" });
  await expect(timer).toBeVisible();
  const startedAt = (await readPersistedStore(page)).sessions[0].startedAt;
  await expect(timer).toHaveAttribute("data-started-at", String(startedAt));

  await page.evaluate((timestamp) => {
    const nativeNow = Date.now.bind(Date);
    Date.now = () => timestamp + 3_723_000;
    window.dispatchEvent(new Event("pageshow"));
    Date.now = nativeNow;
  }, startedAt);
  await expect(timer).toHaveText("◷ 1:02:03");
  expect((await readPersistedStore(page)).sessions[0].startedAt).toBe(
    startedAt,
  );

  await page.reload();
  await page.locator(".workout-card-active").click();
  const resumedTimer = page.getByRole("timer", { name: "Durée de la séance" });
  await expect(resumedTimer).toHaveAttribute(
    "data-started-at",
    String(startedAt),
  );
  expect((await readPersistedStore(page)).sessions[0].startedAt).toBe(
    startedAt,
  );
});

test("persists permanent and session exercise notes independently", async ({
  page,
}) => {
  await prepareWorkout(page, "1");
  await page.getByRole("button", { name: /Démarrer la séance/i }).click();
  await page.getByRole("button", { name: "Ajouter une note" }).click();
  const notes = page.getByRole("dialog", { name: "Notes de l’exercice" });
  const permanentNote = notes.getByRole("textbox", { name: "Note permanente" });
  await permanentNote.tap();
  await expect(permanentNote).toBeFocused();
  await page.keyboard.insertText("Banc position 4");
  await expect(permanentNote).toHaveValue("Banc position 4");
  const sessionNote = notes.getByRole("textbox", {
    name: "Note de cette séance",
  });
  await expect(sessionNote).toBeEnabled();
  await sessionNote.tap();
  await expect(sessionNote).toBeFocused();
  await page.keyboard.insertText("Épaule sensible aujourd’hui");
  await expect(sessionNote).toHaveValue("Épaule sensible aujourd’hui");
  await expect(sessionNote).toBeEnabled();
  const noteDomAudit = await Promise.all(
    [permanentNote, sessionNote].map((field) =>
      field.evaluate((element) => {
        const style = getComputedStyle(element);
        const backdrop = element.closest(".sheet-backdrop");
        const bounds = element.getBoundingClientRect();
        return {
          tagName: element.tagName,
          id: element.id,
          name: element.getAttribute("name"),
          disabled: (element as HTMLTextAreaElement).disabled,
          readOnly: (element as HTMLTextAreaElement).readOnly,
          pointerEvents: style.pointerEvents,
          zIndex: style.zIndex,
          position: style.position,
          fontSize: style.fontSize,
          touchAction: style.touchAction,
          backdropTouchAction: backdrop
            ? getComputedStyle(backdrop).touchAction
            : "missing",
          parentClass: element.parentElement?.className,
          scrollContainer: element.closest(".sheet-scroll")?.className,
          receivesHit:
            document.elementFromPoint(
              bounds.x + bounds.width / 2,
              bounds.y + bounds.height / 2,
            ) === element,
        };
      }),
    ),
  );
  expect(noteDomAudit.map((field) => field.tagName)).toEqual([
    "TEXTAREA",
    "TEXTAREA",
  ]);
  expect(noteDomAudit.map((field) => field.id)).toEqual([
    "exercise-permanent-note",
    "exercise-session-note",
  ]);
  expect(noteDomAudit.map((field) => field.name)).toEqual([null, null]);
  expect(noteDomAudit[0].parentClass).toBe(noteDomAudit[1].parentClass);
  expect(noteDomAudit.map((field) => field.position)).toEqual([
    "static",
    "static",
  ]);
  expect(noteDomAudit.map((field) => field.zIndex)).toEqual(["auto", "auto"]);
  expect(noteDomAudit.map((field) => field.touchAction)).toEqual([
    "auto",
    "auto",
  ]);
  expect(noteDomAudit.map((field) => field.disabled)).toEqual([false, false]);
  expect(noteDomAudit.map((field) => field.readOnly)).toEqual([false, false]);
  expect(noteDomAudit.map((field) => field.pointerEvents)).toEqual([
    "auto",
    "auto",
  ]);
  expect(noteDomAudit.map((field) => field.backdropTouchAction)).toEqual([
    "auto",
    "auto",
  ]);
  expect(noteDomAudit.map((field) => field.fontSize)).toEqual(["16px", "16px"]);
  expect(noteDomAudit.map((field) => field.receivesHit)).toEqual([true, true]);
  expect(noteDomAudit[0].scrollContainer).toBe(noteDomAudit[1].scrollContainer);
  await notes.getByRole("button", { name: "ENREGISTRER" }).click();
  await expect(notes).toHaveCount(0);

  const noteButton = page.getByRole("button", { name: "Notes de l’exercice" });
  await expect(noteButton).toContainText("Épaule sensible aujourd’hui");
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const geometry = await page.evaluate(() => {
      const note = document.querySelector<HTMLElement>(
        ".exercise-note-trigger",
      );
      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        noteWidth: note?.clientWidth ?? 0,
        noteScrollWidth: note?.scrollWidth ?? 0,
      };
    });
    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
    expect(geometry.noteScrollWidth).toBeLessThanOrEqual(geometry.noteWidth);
  }
  await page.setViewportSize({ width: 844, height: 390 });
  const orientationGuard = page.getByRole("alertdialog");
  await expect(
    orientationGuard.getByText("Tournez votre téléphone en portrait"),
  ).toBeVisible();
  await expect(page.locator("#root")).toHaveJSProperty("inert", true);
  const overlayHit = await page.evaluate(() => {
    const target = document.elementFromPoint(
      window.innerWidth / 2,
      window.innerHeight / 2,
    );
    return Boolean(target?.closest(".orientation-guard"));
  });
  expect(overlayHit).toBe(true);
  await page.mouse.click(30, 30);
  await expect(orientationGuard).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.locator("#root")).toHaveJSProperty("inert", false);

  let store = await readPersistedStore(page);
  const exerciseId = store.templates[0].exercises[0].id;
  expect(store.templates[0].exercises[0].permanentNote).toBe("Banc position 4");
  expect(store.sessions[0].snapshot.exercises[0].permanentNote).toBe(
    "Banc position 4",
  );
  expect(store.sessions[0].sessionNotes).toEqual({
    [exerciseId]: "Épaule sensible aujourd’hui",
  });
  expect(store.templates[0].exercises[0]).not.toHaveProperty("sessionNotes");

  await page.getByRole("button", { name: "Retour aux séances" }).click();
  await expect(
    page.getByRole("region", { name: "Séance en cours" }),
  ).toBeVisible();
  await page.locator(".workout-card-active").click();
  await page.getByRole("button", { name: "Notes de l’exercice" }).click();
  const resumedNotes = page.getByRole("dialog", {
    name: "Notes de l’exercice",
  });
  await expect(
    resumedNotes.getByRole("textbox", { name: "Note permanente" }),
  ).toHaveValue("Banc position 4");
  await expect(
    resumedNotes.getByRole("textbox", { name: "Note de cette séance" }),
  ).toHaveValue("Épaule sensible aujourd’hui");
  const permanentDraft = resumedNotes.getByRole("textbox", {
    name: "Note permanente",
  });
  await permanentDraft.fill("Brouillon à annuler");
  await page.locator(".sheet-backdrop").click({ position: { x: 4, y: 4 } });
  await expect(resumedNotes).toBeVisible();
  await expect(permanentDraft).toHaveValue("Brouillon à annuler");
  await expect(
    resumedNotes.getByRole("textbox", { name: "Note de cette séance" }),
  ).toHaveValue("Épaule sensible aujourd’hui");
  await dragDismissSheet(page);
  await expect(resumedNotes).toHaveCount(0);
  await page.getByRole("button", { name: "Notes de l’exercice" }).click();
  const unchangedNotes = page.getByRole("dialog", {
    name: "Notes de l’exercice",
  });
  await expect(
    unchangedNotes.getByRole("textbox", { name: "Note permanente" }),
  ).toHaveValue("Banc position 4");
  await expect(
    unchangedNotes.getByRole("textbox", { name: "Note de cette séance" }),
  ).toHaveValue("Épaule sensible aujourd’hui");
  await unchangedNotes.getByRole("button", { name: "ENREGISTRER" }).click();
  await expect(unchangedNotes).toHaveCount(0);

  await page.getByRole("button", { name: "Réorganiser les exercices" }).click();
  await page
    .getByRole("dialog", { name: "Organisation de la séance" })
    .getByRole("button", { name: "Abandonner la séance" })
    .click();
  await page
    .getByRole("alertdialog", { name: "Abandonner la séance ?" })
    .getByRole("button", { name: "Abandonner la séance" })
    .click();
  await expect(
    page.getByRole("region", { name: "Séance en cours" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Ouvrir Mes séances" }).click();
  await page.locator(".workout-card").click();
  await expect(page.locator(".workout-preparation")).toBeVisible();
  await page.getByRole("button", { name: /Démarrer la séance/i }).click();
  await page.getByRole("button", { name: "Notes de l’exercice" }).click();
  const nextNotes = page.getByRole("dialog", { name: "Notes de l’exercice" });
  await expect(
    nextNotes.getByRole("textbox", { name: "Note permanente" }),
  ).toHaveValue("Banc position 4");
  await expect(
    nextNotes.getByRole("textbox", { name: "Note de cette séance" }),
  ).toHaveValue("");
  expect(
    await nextNotes
      .getByRole("textbox", { name: "Note de cette séance" })
      .isDisabled(),
  ).toBe(false);
  await nextNotes.getByRole("button", { name: "ENREGISTRER" }).click();
  await expect(nextNotes).toHaveCount(0);
  store = await readPersistedStore(page);
  expect(store.sessions).toHaveLength(2);
  expect(store.sessions[0].sessionNotes).toEqual({
    [exerciseId]: "Épaule sensible aujourd’hui",
  });
  expect(store.sessions[1].sessionNotes).toEqual({});
});

test("keeps picker sheets open on backdrop taps and blocks the app behind them", async ({
  page,
}) => {
  await prepareWorkout(page, "1");
  const backgroundAction = page.getByRole("button", {
    name: "Gérer les exercices",
  });
  const actionBounds = await backgroundAction.boundingBox();
  if (!actionBounds) throw new Error("background action has no bounding box");

  await page.getByRole("button", { name: "Charge (kg)" }).click();
  const picker = page.getByRole("dialog", { name: "Choisir Charge (kg)" });
  await expect(picker).toBeVisible();
  const backdropHit = await page.evaluate(
    ({ x, y }) => {
      const target = document.elementFromPoint(x, y);
      return Boolean(target?.closest(".sheet-backdrop"));
    },
    {
      x: actionBounds.x + actionBounds.width / 2,
      y: actionBounds.y + actionBounds.height / 2,
    },
  );
  expect(backdropHit).toBe(true);
  await page.mouse.click(
    actionBounds.x + actionBounds.width / 2,
    actionBounds.y + actionBounds.height / 2,
  );
  await expect(picker).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Actions de la séance" }),
  ).toHaveCount(0);
  await page.locator(".sheet-backdrop").click({ position: { x: 4, y: 4 } });
  await expect(picker).toBeVisible();
  await picker
    .getByRole("button", { name: "ENREGISTRER", exact: true })
    .click();
  await expect(picker).toHaveCount(0);

  const viewport = await page
    .locator('meta[name="viewport"]')
    .getAttribute("content");
  expect(viewport).toContain("maximum-scale=1");
  expect(viewport).toContain("user-scalable=no");
  expect(viewport).toContain("viewport-fit=cover");
  const manifest = await page.evaluate(
    async () =>
      (await fetch("/manifest.webmanifest")).json() as Promise<{
        orientation: string;
      }>,
  );
  expect(manifest.orientation).toBe("portrait");
});

test("uses the orange ENREGISTRER action for every set-value picker", async ({
  page,
}) => {
  await prepareWorkout(page, "3");
  await page.getByRole("button", { name: /Démarrer la séance/i }).click();

  for (const label of ["Charge (kg)", "Répétitions", "Repos"]) {
    await page
      .locator(".set-block")
      .first()
      .getByRole("button", { name: label, exact: true })
      .click();
    const picker = page.getByRole("dialog", { name: `Choisir ${label}` });
    await (await expectPickerSave(picker)).click();
    await expect(picker).toHaveCount(0);
  }
});

for (const width of [390, 320]) {
  test(`locks background scrolling through Notes and pickers at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await prepareWorkout(page, "12");
    await page.getByRole("button", { name: /Démarrer la séance/i }).click();

    const appShell = page.locator(".app-shell");
    const plannedSets = page.locator(".planned-sets");
    await plannedSets.evaluate((element) => {
      element.scrollTop = 120;
      element.dispatchEvent(new Event("scroll"));
    });
    const notesBackgroundPosition = await plannedSets.evaluate(
      (element) => element.scrollTop,
    );
    expect(notesBackgroundPosition).toBeGreaterThan(0);

    await page.locator(".exercise-note-trigger").click();
    const notes = page.getByRole("dialog", { name: "Notes de l’exercice" });
    const backdrop = page.locator(".sheet-backdrop");
    await expect(notes).toBeVisible();
    await expect(appShell).toHaveAttribute("data-modal-open", "true");
    await expect
      .poll(() =>
        plannedSets.evaluate((element) => getComputedStyle(element).overflowY),
      )
      .toBe("hidden");
    expect(await plannedSets.evaluate((element) => element.scrollTop)).toBe(
      notesBackgroundPosition,
    );

    const sessionNote = notes.getByRole("textbox", {
      name: "Note de cette séance",
    });
    const behindSet = page.locator(".set-block").first();
    const backgroundWindowScroll = await page.evaluate(() => window.scrollY);
    const backgroundAnchorTop = await behindSet.evaluate(
      (element) => element.getBoundingClientRect().top,
    );
    const backgroundLayer = page.locator(".workout-preparation");
    const originalBackgroundTransform = await backgroundLayer.evaluate(
      (element) => (element as HTMLElement).style.transform,
    );
    const expectBackgroundAnchored = async () => {
      const state = await page.evaluate(() => ({
        scrollY: window.scrollY,
        plannedSetsTop:
          document.querySelector<HTMLElement>(".planned-sets")!.scrollTop,
        anchorTop: document
          .querySelector<HTMLElement>(".set-block")!
          .getBoundingClientRect().top,
      }));
      expect(state.scrollY).toBe(backgroundWindowScroll);
      expect(state.plannedSetsTop).toBe(notesBackgroundPosition);
      expect(Math.abs(state.anchorTop - backgroundAnchorTop)).toBeLessThan(1);
    };
    await sessionNote.focus();
    // Recreate the native iOS visual viewport pan in the background layer.
    // The modal itself is not transformed and must keep following the keyboard.
    await backgroundLayer.evaluate((element) => {
      (element as HTMLElement).style.transform = "translateY(-96px)";
    });
    await setVisualViewport(page, 430, 96);
    await expect(backdrop).toHaveAttribute("data-keyboard-open", "true");
    await expect(sessionNote).toBeVisible();
    await expect
      .poll(() =>
        page
          .locator(".app-shell")
          .evaluate((element) =>
            getComputedStyle(element).getPropertyValue(
              "--modal-background-viewport-offset",
            ),
          ),
      )
      .toBe("96px");
    await expectBackgroundAnchored();
    await sessionNote.fill(
      Array.from({ length: 28 }, (_, index) => `note longue ${index}`).join(
        "\n",
      ),
    );
    const textareaScroll = await sessionNote.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      return element.scrollTop;
    });
    expect(textareaScroll).toBeGreaterThan(0);
    await expectBackgroundAnchored();

    const sheetScroll = page.locator(".sheet-scroll");
    await sheetScroll.evaluate((element) => {
      element.style.maxHeight = "140px";
      element.scrollTop = element.scrollHeight;
      element.dispatchEvent(new Event("scroll"));
    });
    const sheetScrollTop = await sheetScroll.evaluate(
      (element) => element.scrollTop,
    );
    expect(sheetScrollTop).toBeGreaterThan(0);
    const sheetBounds = await sheetScroll.boundingBox();
    expect(sheetBounds).not.toBeNull();
    await scrollInElement(page, sheetScroll, -640);
    await scrollInElement(page, sheetScroll, 640);
    await sheetScroll.evaluate((element) => {
      element.scrollTop = 0;
      element.dispatchEvent(new Event("scroll"));
    });
    await expectBackgroundAnchored();

    await setVisualViewport(page, 844, 0);
    await backgroundLayer.evaluate((element, transform) => {
      (element as HTMLElement).style.transform = transform;
    }, originalBackgroundTransform);
    await expectBackgroundAnchored();
    await expect(backdrop).toHaveAttribute("data-keyboard-open", "false");
    await dragDismissSheet(page);
    await expect(notes).toHaveCount(0);
    await expect(appShell).not.toHaveAttribute("data-modal-open");
    await expectBackgroundAnchored();
    await expect
      .poll(() =>
        plannedSets.evaluate((element) => getComputedStyle(element).overflowY),
      )
      .toBe("auto");

    const plannedBounds = await plannedSets.boundingBox();
    expect(plannedBounds).not.toBeNull();
    await scrollInElement(page, plannedSets, 240);
    await expect
      .poll(() => plannedSets.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(notesBackgroundPosition);

    const pickerSet = page.locator(".set-block").nth(5);
    await pickerSet.scrollIntoViewIfNeeded();
    const pickerBackgroundPosition = await plannedSets.evaluate(
      (element) => element.scrollTop,
    );
    await pickerSet.getByRole("button", { name: "Charge (kg)" }).click();
    const picker = page.getByRole("dialog", { name: "Choisir Charge (kg)" });
    await expect(picker).toBeVisible();
    await expect(appShell).toHaveAttribute("data-modal-open", "true");
    expect(await plannedSets.evaluate((element) => element.scrollTop)).toBe(
      pickerBackgroundPosition,
    );
    const wheel = picker.getByRole("listbox", { name: "Kilogrammes" });
    const wheelPosition = await wheel.evaluate((element) => {
      const limit = Math.max(0, element.scrollHeight - element.clientHeight);
      element.scrollTop = Math.min(limit, element.scrollTop + 120);
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
      return element.scrollTop;
    });
    expect(wheelPosition).toBeGreaterThan(0);
    expect(await plannedSets.evaluate((element) => element.scrollTop)).toBe(
      pickerBackgroundPosition,
    );
    await (await expectPickerSave(picker)).click();
    await expect(picker).toHaveCount(0);
    await expect(appShell).not.toHaveAttribute("data-modal-open");
    expect(await plannedSets.evaluate((element) => element.scrollTop)).toBe(
      pickerBackgroundPosition,
    );
  });
}

test("keeps Notes above the iOS keyboard when innerHeight shrinks on the first event", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepareWorkout(page, "3");
  await page.getByRole("button", { name: /Démarrer la séance/i }).click();
  const navigation = page.locator(".bottom-navigation-surface");
  const navBefore = await navigation.boundingBox();
  await page.evaluate(() => {
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 797,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      configurable: true,
      value: 797,
    });
  });
  await setVisualViewport(page, 797, 0);
  await page.locator(".exercise-note-trigger").click();
  const notes = page.getByRole("dialog", { name: "Notes de l’exercice" });
  const backdrop = page.locator(".sheet-backdrop");
  const field = notes.getByRole("textbox", { name: "Note de cette séance" });
  await expect(backdrop).toHaveAttribute("data-keyboard-open", "false");
  const before = await notes.boundingBox();
  expect(before!.y + before!.height).toBeCloseTo(844, 0);
  await field.focus();
  await page.evaluate(() => {
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 441,
    });
  });
  // No second resize after innerHeight recovers: the first event must suffice.
  await setVisualViewport(page, 441, 0);
  await expect(backdrop).toHaveAttribute("data-keyboard-open", "true");
  await expect(backdrop).toHaveCSS("height", "441px");
  await expect(backdrop).toHaveCSS("top", "0px");
  await expect
    .poll(async () => {
      const bounds = await notes.boundingBox();
      return bounds!.y + bounds!.height;
    })
    .toBeCloseTo(441, 0);
  await expect
    .poll(() =>
      field.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const scroll = element.closest(".sheet-scroll")!;
        const scrollBounds = scroll.getBoundingClientRect();
        return (
          bounds.top >= scrollBounds.top &&
          bounds.bottom <= Math.min(scrollBounds.bottom, 441)
        );
      }),
    )
    .toBe(true);
  // Force overflow within this existing Notes sheet to verify focus uses its
  // internal scroller, including focus changes without any viewport event.
  await notes.locator(".sheet-scroll").evaluate((element) => {
    element.style.maxHeight = "240px";
    element.scrollTop = 0;
  });
  await notes.getByRole("textbox", { name: "Note permanente" }).focus();
  await field.focus();
  await expect
    .poll(() =>
      field.evaluate((element) => {
        const scroller = element.closest(".sheet-scroll")!;
        const bounds = element.getBoundingClientRect();
        const scrollBounds = scroller.getBoundingClientRect();
        return (
          scroller.scrollTop > 0 &&
          bounds.top >= scrollBounds.top &&
          bounds.bottom <= scrollBounds.bottom
        );
      }),
    )
    .toBe(true);
  await field.fill("Brouillon clavier");
  await expect(field).toBeFocused();
  await expect(field).toHaveValue("Brouillon clavier");
  await page.locator(".sheet-backdrop").click({ position: { x: 4, y: 4 } });
  await expect(notes).toBeVisible();
  await expect(page.locator(".bottom-navigation")).toHaveCSS(
    "visibility",
    "hidden",
  );

  for (const top of [96, -24, 0]) {
    await setVisualViewport(page, 441, top);
    await expect(backdrop).toHaveCSS("top", `${top}px`);
    await expect
      .poll(async () => {
        const bounds = await notes.boundingBox();
        return bounds!.y + bounds!.height;
      })
      .toBeCloseTo(top + 441, 0);
  }
  await notes
    .locator(".sheet-scroll")
    .evaluate((element) => element.style.removeProperty("max-height"));
  await page.evaluate(() => {
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 797,
    });
  });
  await setVisualViewport(page, 797, 0);
  await expect(backdrop).toHaveAttribute("data-keyboard-open", "false");
  await expect
    .poll(async () => {
      const bounds = await notes.boundingBox();
      return bounds!.y + bounds!.height;
    })
    .toBeCloseTo(844, 0);
  await dragDismissSheet(page);
  await expect(notes).toHaveCount(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.locator(".bottom-navigation")).toHaveCSS(
    "visibility",
    "visible",
  );
  expect(await navigation.boundingBox()).toEqual(navBefore);

  // Dismiss directly with the keyboard still open; the draft is cancelled.
  await page.locator(".exercise-note-trigger").click();
  await expect(field).toHaveValue("");
  await field.focus();
  await setVisualViewport(page, 441, 0);
  await expect(backdrop).toHaveAttribute("data-keyboard-open", "true");
  await dragDismissSheet(page);
  await expect(notes).toHaveCount(0);
  await setVisualViewport(page, 797, 0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(await navigation.boundingBox()).toEqual(navBefore);
  await expect(page.locator(".app-shell")).not.toHaveAttribute(
    "data-viewport-panned",
  );
});
