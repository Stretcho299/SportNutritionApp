import { expect, test, type Page } from "@playwright/test";

const officialName = "Développé couché à la barre";
const customName = "Presse de test";
const renamedCustomName = "Presse de test modifiée";

type StoredExercise = {
  name: string;
  exerciseDefinitionId?: string;
  definitionSnapshot?: {
    id: string;
    name: string;
    muscleTargets: unknown[];
  };
  plannedSets: Array<{ restSeconds: number }>;
};

type StoredWorkouts = {
  templates: Array<{ exercises: StoredExercise[] }>;
  sessions: Array<{ snapshot: { exercises: StoredExercise[] } }>;
  customDefinitions: Array<{ name: string; muscleTargets: unknown[] }>;
};

async function readWorkouts(page: Page): Promise<StoredWorkouts> {
  return page.evaluate(
    () =>
      new Promise<StoredWorkouts>((resolve, reject) => {
        const request = indexedDB.open("sport-nutrition", 2);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const get = db
            .transaction("data")
            .objectStore("data")
            .get("sport-nutrition-workouts");
          get.onsuccess = () => resolve(get.result);
          get.onerror = () => reject(get.error);
        };
      }),
  );
}

async function prepareEmptyWorkout(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Ouvrir Mes séances" }).click();
  await page.getByRole("button", { name: "Créer une séance" }).click();
  const form = page.getByRole("dialog", { name: "Séance" });
  await form.getByRole("textbox", { name: "Nom" }).fill("Catalogue E2E");
  await form.getByRole("button", { name: "Enregistrer" }).click();
  await page.locator(".workout-card").click();
  await page.getByRole("button", { name: "Ajouter un exercice" }).click();
  await expect(
    page.getByRole("dialog", { name: "Catalogue d’exercices" }),
  ).toBeVisible();
}

async function openCatalog(page: Page) {
  await page.getByRole("button", { name: "Gérer les exercices" }).click();
  await page
    .getByRole("dialog", { name: "Actions de la séance" })
    .getByRole("button", { name: "Ajouter un exercice" })
    .click();
  return page.getByRole("dialog", { name: "Catalogue d’exercices" });
}

async function addResult(page: Page, name: string) {
  const catalog = page.getByRole("dialog", { name: "Catalogue d’exercices" });
  await catalog
    .getByRole("list", { name: "Résultats du catalogue" })
    .getByRole("button", { name: new RegExp(name) })
    .first()
    .click();
  const form = page.getByRole("dialog", { name: "Exercice" });
  await expect(form.getByRole("textbox", { name: "Nom" })).toHaveValue(name);
  await form.getByRole("button", { name: "Enregistrer" }).click();
  await expect(form).toHaveCount(0);
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
}

for (const width of [320, 390]) {
  test(`catalog search, filters and official workout at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await prepareEmptyWorkout(page);
    const catalog = page.getByRole("dialog", { name: "Catalogue d’exercices" });
    const results = catalog.getByRole("list", {
      name: "Résultats du catalogue",
    });
    const search = catalog.getByRole("searchbox", {
      name: "Rechercher un exercice",
    });

    await search.fill("Bench press");
    await expect(
      results.getByRole("button", { name: /Développé couché à la barre/ }),
    ).toBeVisible();
    await search.fill("Développé couché");
    await catalog
      .getByRole("combobox", { name: "Filtrer par muscle" })
      .selectOption("pectoraux");
    await catalog
      .getByRole("combobox", { name: "Filtrer par matériel" })
      .selectOption("barre");
    const result = results.getByRole("button", {
      name: /Développé couché à la barre/,
    });
    await expect(result).toContainText("Grand pectoral");
    await expect(result).toContainText("Barre");
    await expectNoHorizontalOverflow(page);
    await addResult(page, officialName);

    const region = page.getByRole("region", {
      name: `Séries de ${officialName}`,
    });
    await expect(region.getByRole("listitem")).toHaveCount(3);
    await expect
      .poll(
        async () =>
          (await readWorkouts(page)).templates[0].exercises[0].plannedSets[0]
            .restSeconds,
      )
      .toBe(150);
    await page.getByRole("button", { name: "Démarrer la séance" }).click();
    await expect(
      region.getByRole("button", { name: "Lancer le repos" }).first(),
    ).toBeVisible();
    await region
      .getByRole("button", { name: "Lancer le repos" })
      .first()
      .click();
    await expect(region).toContainText("Repos en cours");
    await region.getByRole("button", { name: "Mettre fin au repos" }).click();
    await page
      .getByRole("alertdialog", { name: "Mettre fin au repos ?" })
      .getByRole("button", { name: "Mettre fin" })
      .click();
    await expectNoHorizontalOverflow(page);
  });

  test(`custom definition CRUD keeps templates and snapshots at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await prepareEmptyWorkout(page);
    let catalog = page.getByRole("dialog", { name: "Catalogue d’exercices" });
    await catalog
      .getByRole("button", { name: /Créer un exercice personnalisé/ })
      .click();
    const customForm = page.getByRole("dialog", {
      name: "Créer un exercice personnalisé",
    });
    await customForm.getByRole("textbox", { name: "Nom" }).fill(customName);
    await customForm
      .getByRole("combobox", { name: "Muscle principal" })
      .selectOption("quadriceps");
    await customForm
      .getByRole("combobox", { name: "Matériel" })
      .selectOption("machine");
    await customForm.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByRole("dialog", { name: "Exercice" })).toBeVisible();
    await page
      .getByRole("dialog", { name: "Exercice" })
      .getByRole("button", { name: "Enregistrer" })
      .click();

    catalog = await openCatalog(page);
    const search = catalog.getByRole("searchbox", {
      name: "Rechercher un exercice",
    });
    await search.fill(customName);
    await catalog
      .getByRole("button", { name: `Modifier ${customName}` })
      .click();
    const editForm = page.getByRole("dialog", {
      name: "Modifier un exercice personnalisé",
    });
    await editForm
      .getByRole("textbox", { name: "Nom" })
      .fill(renamedCustomName);
    await editForm.getByRole("button", { name: "Enregistrer" }).click();
    await search.fill(renamedCustomName);
    await expect(
      catalog.getByRole("button", { name: `Modifier ${renamedCustomName}` }),
    ).toBeVisible();

    await catalog
      .getByRole("button", { name: `Supprimer ${renamedCustomName}` })
      .click();
    const confirmation = page.getByRole("alertdialog", {
      name: "Supprimer cet exercice personnalisé ?",
    });
    await confirmation.getByRole("button", { name: "Annuler" }).click();
    await expect(
      catalog.getByRole("button", { name: `Supprimer ${renamedCustomName}` }),
    ).toBeVisible();
    await catalog
      .getByRole("button", { name: `Supprimer ${renamedCustomName}` })
      .click();
    await confirmation.getByRole("button", { name: "Supprimer" }).click();
    await expect(
      catalog.getByRole("button", { name: `Supprimer ${renamedCustomName}` }),
    ).toHaveCount(0);

    await search.fill("Bench press");
    const official = catalog
      .getByRole("listitem")
      .filter({ hasText: officialName });
    await expect(
      official.getByRole("button", { name: /Supprimer/ }),
    ).toHaveCount(0);
    await addResult(page, officialName);
    await expect(
      page.getByRole("region", { name: `Séries de ${customName}` }),
    ).toBeVisible();

    await page
      .getByRole("button", { name: "Réorganiser les exercices" })
      .click();
    await page
      .getByRole("dialog", { name: "Organisation de la séance" })
      .getByRole("button", { name: "Réordonner les exercices" })
      .click();
    const reorder = page.getByRole("dialog", {
      name: "Réordonner les exercices",
    });
    await reorder
      .getByRole("button", { name: `Monter ${officialName}` })
      .click();
    await reorder.getByRole("button", { name: "ENREGISTRER" }).click();
    await expect(
      page.getByRole("list", { name: "Exercices" }).getByRole("button").first(),
    ).toContainText(officialName);

    await page.getByRole("button", { name: "Démarrer la séance" }).click();
    await expect
      .poll(async () => (await readWorkouts(page)).sessions.length)
      .toBe(1);
    const store = await readWorkouts(page);
    expect(
      store.templates[0].exercises.map((exercise) => exercise.name),
    ).toContain(customName);
    expect(
      store.sessions[0].snapshot.exercises.map((exercise) => exercise.name),
    ).toContain(customName);
    const snapshot = store.sessions[0].snapshot.exercises.find(
      (exercise) => exercise.name === customName,
    );
    expect(snapshot?.exerciseDefinitionId).toBeTruthy();
    expect(snapshot?.definitionSnapshot?.name).toBe(customName);
    expect(snapshot?.definitionSnapshot?.muscleTargets).toEqual([
      { muscle: "quadriceps", role: "primary" },
    ]);
    await expectNoHorizontalOverflow(page);
  });

  test(`custom exercise stores several secondary muscles at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await prepareEmptyWorkout(page);
    const catalog = page.getByRole("dialog", { name: "Catalogue d’exercices" });
    await catalog
      .getByRole("button", { name: "+ Créer un exercice personnalisé" })
      .click();
    const form = page.getByRole("dialog", {
      name: "Créer un exercice personnalisé",
    });
    await form
      .getByRole("textbox", { name: "Nom" })
      .fill("Press multi-muscles");
    await form
      .getByRole("combobox", { name: "Muscle principal" })
      .selectOption("grand_pectoral");
    await form.getByText("Muscles secondaires (0)").click();
    const choices = form.getByRole("group", { name: "Muscles secondaires" });
    await choices.getByRole("checkbox", { name: "Triceps" }).check();
    await choices.getByRole("checkbox", { name: "Deltoïde antérieur" }).check();
    await expect(form.getByText("Muscles secondaires (2)")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await form.getByRole("button", { name: "Enregistrer" }).click();
    await page
      .getByRole("dialog", { name: "Exercice" })
      .getByRole("button", { name: "Enregistrer" })
      .click();
    const targets = [
      { muscle: "grand_pectoral", role: "primary" },
      { muscle: "triceps", role: "secondary" },
      { muscle: "deltoide_anterieur", role: "secondary" },
    ];
    await expect
      .poll(
        async () =>
          (await readWorkouts(page)).customDefinitions[0]?.muscleTargets,
      )
      .toEqual(targets);
    expect(
      (await readWorkouts(page)).templates[0].exercises[0].definitionSnapshot
        ?.muscleTargets,
    ).toEqual(targets);

    const editCatalog = await openCatalog(page);
    await editCatalog
      .getByRole("button", { name: "Modifier Press multi-muscles" })
      .click();
    const edit = page.getByRole("dialog", {
      name: "Modifier un exercice personnalisé",
    });
    await edit.getByText("Muscles secondaires (2)").click();
    await expect(edit.getByRole("checkbox", { name: "Triceps" })).toBeChecked();
    await expect(
      edit.getByRole("checkbox", { name: "Deltoïde antérieur" }),
    ).toBeChecked();
    await edit
      .getByRole("combobox", { name: "Muscle principal" })
      .selectOption("triceps");
    await expect(edit.getByText("Muscles secondaires (1)")).toBeVisible();
    await expect(edit.getByRole("checkbox", { name: "Triceps" })).toHaveCount(
      0,
    );
    await expectNoHorizontalOverflow(page);
  });
}
