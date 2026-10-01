import { expect, test, type Page } from "@playwright/test";

const officialName = "Développé couché à la barre";
const customName = "Presse de test";
const renamedCustomName = "Presse de test modifiée";

type StoredExercise = {
  id: string;
  name: string;
  position: number;
  permanentNote?: string;
  exerciseDefinitionId?: string;
  definitionSnapshot?: {
    id: string;
    name: string;
    muscleTargets: unknown[];
    illustrationId?: string;
  };
  plannedSets: Array<{
    id: string;
    position: number;
    weightKg: number | null;
    repetitions: number | null;
    restSeconds: number;
  }>;
};

type StoredWorkouts = {
  templates: Array<{ id: string; name: string; exercises: StoredExercise[] }>;
  sessions: Array<{
    id: string;
    templateId: string;
    status: string;
    snapshot: { exercises: StoredExercise[] };
  }>;
  customDefinitions: Array<{
    id: string;
    name: string;
    muscleTargets: unknown[];
    equipment: string[];
  }>;
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
          get.onsuccess = () => {
            db.close();
            resolve(get.result);
          };
          get.onerror = () => {
            db.close();
            reject(get.error);
          };
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
  await expect(form.getByText(name, { exact: true })).toBeVisible();
  await form.getByRole("button", { name: "Enregistrer" }).click();
  await expect(form).toHaveCount(0);
}

async function seedHistoricalSessionSnapshot(page: Page) {
  await page.evaluate(() => {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("sport-nutrition", 2);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("IndexedDB open blocked"));
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction("data", "readwrite");
        const objectStore = transaction.objectStore("data");
        const get = objectStore.get("sport-nutrition-workouts");
        get.onerror = () => {
          db.close();
          reject(get.error);
        };
        get.onsuccess = () => {
          const store = get.result as StoredWorkouts;
          const template = store.templates[0];
          store.sessions.push({
            id: "history-custom-snapshot",
            templateId: template.id,
            status: "completed",
            snapshot: JSON.parse(JSON.stringify(template)),
          });
          objectStore.put(store, "sport-nutrition-workouts");
        };
        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        transaction.onerror = () => {
          db.close();
          reject(transaction.error);
        };
        transaction.onabort = () => {
          db.close();
          reject(transaction.error ?? new Error("IndexedDB write aborted"));
        };
      };
    });
  });
}

async function chooseSetCount(page: Page, value: string) {
  await page.getByRole("button", { name: "Nombre de séries initiales" }).tap();
  const picker = page.getByRole("dialog", {
    name: "Choisir Nombre de séries initiales",
  });
  await picker.getByRole("option", { name: value, exact: true }).tap();
  await picker.getByRole("button", { name: "ENREGISTRER" }).tap();
}

async function chooseRest(page: Page, minutes: string, seconds: string) {
  await page.getByRole("button", { name: "Repos par défaut" }).tap();
  const picker = page.getByRole("dialog", { name: "Choisir Repos par défaut" });
  await picker
    .getByRole("listbox", { name: "Minutes" })
    .getByRole("option", {
      name: minutes,
      exact: true,
    })
    .tap();
  await picker
    .getByRole("listbox", { name: "Secondes" })
    .getByRole("option", {
      name: seconds,
      exact: true,
    })
    .tap();
  await picker.getByRole("button", { name: "ENREGISTRER" }).tap();
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
  test(`a direct panel change clears a pending sheet close at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await prepareEmptyWorkout(page);
    await page
      .getByRole("dialog", { name: "Catalogue d’exercices" })
      .getByRole("list", { name: "Résultats du catalogue" })
      .getByRole("button", { name: new RegExp(officialName) })
      .click();
    const form = page.getByRole("dialog", { name: "Exercice" });
    const backdrop = page.locator(".sheet-backdrop");
    await backdrop.click({ position: { x: 4, y: 4 } });
    await expect(backdrop).toHaveClass(/is-closing/);
    await form.getByRole("button", { name: "Changer" }).dispatchEvent("click");
    const catalog = page.getByRole("dialog", {
      name: "Catalogue d’exercices",
    });
    await expect(catalog).toBeVisible();
    await expect(page.locator(".sheet-backdrop.is-closing")).toHaveCount(0);
    await page.waitForTimeout(240);
    await expect(catalog).toBeVisible();
  });

  test(`reselecting on the same exercise sheet keeps touch controls aligned at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await prepareEmptyWorkout(page);
    const catalog = page.getByRole("dialog", { name: "Catalogue d’exercices" });
    const customCta = catalog.getByRole("button", {
      name: "+ Créer un exercice personnalisé",
    });
    await expect(customCta).toBeVisible();
    const ctaBounds = await customCta.boundingBox();
    const catalogBounds = await catalog.boundingBox();
    expect(ctaBounds?.width).toBeGreaterThanOrEqual(width - 64);
    expect(ctaBounds!.y + ctaBounds!.height).toBeLessThanOrEqual(
      catalogBounds!.y + catalogBounds!.height,
    );
    await catalog
      .getByRole("list", { name: "Résultats du catalogue" })
      .getByRole("button", { name: new RegExp(officialName) })
      .tap();
    const form = page.getByRole("dialog", { name: "Exercice" });
    await expect(
      form.getByRole("region", { name: "Exercice sélectionné" }),
    ).toBeVisible();
    await chooseSetCount(page, "5");
    await chooseRest(page, "3", "0");
    await form.getByRole("button", { name: "Changer" }).tap();
    const secondCatalog = page.getByRole("dialog", {
      name: "Catalogue d’exercices",
    });
    await secondCatalog
      .getByRole("searchbox", { name: "Rechercher un exercice" })
      .tap();
    await secondCatalog
      .getByRole("searchbox", { name: "Rechercher un exercice" })
      .fill("Élévations latérales");
    await secondCatalog
      .getByRole("list", { name: "Résultats du catalogue" })
      .getByRole("button", { name: /Élévations latérales aux haltères/ })
      .tap();
    const secondForm = page.getByRole("dialog", { name: "Exercice" });
    await expect(
      secondForm.getByRole("button", { name: "Changer" }),
    ).toBeVisible();
    await expect(
      secondForm.getByRole("button", { name: "Nombre de séries initiales" }),
    ).toHaveAttribute("data-value", "5");
    await expect(
      secondForm.getByRole("button", { name: "Repos par défaut" }),
    ).toHaveAttribute("data-value", "180");
    await chooseSetCount(page, "5");
    await chooseRest(page, "3", "0");
    await chooseSetCount(page, "4");
    await chooseRest(page, "2", "45");
    await secondForm.getByRole("button", { name: "Enregistrer" }).tap();
    await expect(secondForm).toHaveCount(0);
    const stored = await readWorkouts(page);
    expect(stored.templates[0].exercises[0].name).toBe(
      "Élévations latérales aux haltères",
    );
    expect(stored.templates[0].exercises[0].plannedSets).toHaveLength(4);
    expect(
      stored.templates[0].exercises[0].plannedSets.map(
        (set) => set.restSeconds,
      ),
    ).toEqual([165, 165, 165, 165]);
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "Gérer les exercices" }).click();
    const actions = page.getByRole("dialog", { name: "Actions de la séance" });
    const handle = actions.getByRole("button", { name: "Fermer le panneau" });
    const bounds = await handle.boundingBox();
    await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + 10);
    await page.mouse.down();
    await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + 100);
    await page.mouse.up();
    await expect(actions).toHaveCount(0);
  });

  test(`official replacement preserves occurrence structure and clears old values at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await prepareEmptyWorkout(page);
    await addResult(page, officialName);
    const catalog = await openCatalog(page);
    await catalog
      .getByRole("list", { name: "Résultats du catalogue" })
      .getByRole("button", { name: /Squat à la barre/ })
      .click();
    await page
      .getByRole("dialog", { name: "Exercice" })
      .getByRole("button", { name: "Enregistrer" })
      .click();
    const firstSet = page.locator(".set-block").first();
    await firstSet.getByRole("button", { name: "Charge (kg)" }).click();
    let valuePicker = page.getByRole("dialog", { name: "Choisir Charge (kg)" });
    await valuePicker
      .getByRole("listbox", { name: "Kilogrammes" })
      .getByRole("option", { name: "45", exact: true })
      .click();
    await valuePicker.getByRole("button", { name: "ENREGISTRER" }).click();
    await firstSet.getByRole("button", { name: "Répétitions" }).click();
    valuePicker = page.getByRole("dialog", { name: "Choisir Répétitions" });
    await valuePicker
      .getByRole("listbox", { name: "Répétitions" })
      .getByRole("option", { name: "9", exact: true })
      .click();
    await valuePicker.getByRole("button", { name: "ENREGISTRER" }).click();
    await firstSet.getByRole("button", { name: "Repos" }).click();
    valuePicker = page.getByRole("dialog", { name: "Choisir Repos" });
    await valuePicker
      .getByRole("listbox", { name: "Minutes" })
      .getByRole("option", { name: "3", exact: true })
      .click();
    await valuePicker
      .getByRole("listbox", { name: "Secondes" })
      .getByRole("option", { name: "15", exact: true })
      .click();
    await valuePicker.getByRole("button", { name: "ENREGISTRER" }).click();
    const before = await readWorkouts(page);
    const original = before.templates[0].exercises[0];
    await page.getByRole("button", { name: "Changer l’exercice" }).tap();
    const replaceCatalog = page.getByRole("dialog", {
      name: "Changer l’exercice",
    });
    await replaceCatalog
      .getByRole("list", { name: "Résultats du catalogue" })
      .getByRole("button", { name: /Élévations latérales aux haltères/ })
      .tap();
    await expect(replaceCatalog).toHaveCount(0);
    await expect(
      page.getByRole("heading", {
        name: "Élévations latérales aux haltères",
        exact: true,
      }),
    ).toBeVisible();
    const replaced = (await readWorkouts(page)).templates[0].exercises.find(
      (exercise) => exercise.id === original.id,
    )!;
    expect(replaced).toMatchObject({
      id: original.id,
      position: 0,
      name: "Élévations latérales aux haltères",
      exerciseDefinitionId: "official:lateral-raise-dumbbell",
      definitionSnapshot: {
        id: "official:lateral-raise-dumbbell",
        name: "Élévations latérales aux haltères",
      },
    });
    expect(replaced.permanentNote).toBeUndefined();
    expect(replaced.plannedSets).toHaveLength(original.plannedSets.length);
    expect(replaced.plannedSets[0]).toMatchObject({
      id: original.plannedSets[0].id,
      position: original.plannedSets[0].position,
      weightKg: null,
      repetitions: null,
      restSeconds: 195,
    });
  });

  test(`custom edit from the exercise block updates templates and preserves history at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await prepareEmptyWorkout(page);
    const catalog = page.getByRole("dialog", { name: "Catalogue d’exercices" });
    await catalog
      .getByRole("button", { name: "+ Créer un exercice personnalisé" })
      .click();
    const createForm = page.getByRole("dialog", {
      name: "Créer un exercice personnalisé",
    });
    await createForm.getByRole("textbox", { name: "Nom" }).fill("Presse perso");
    await createForm
      .getByRole("combobox", { name: "Muscle principal" })
      .selectOption("grand_pectoral");
    await createForm.getByText("Muscles secondaires (0)").click();
    await createForm.getByRole("checkbox", { name: "Triceps" }).check();
    await createForm.getByRole("button", { name: "Enregistrer" }).click();
    await page
      .getByRole("dialog", { name: "Exercice" })
      .getByRole("button", { name: "Enregistrer" })
      .click();

    await seedHistoricalSessionSnapshot(page);
    await page.getByRole("button", { name: "Modifier l’exercice" }).click();
    const editForm = page.getByRole("dialog", {
      name: "Modifier un exercice personnalisé",
    });
    await editForm
      .getByRole("textbox", { name: "Nom" })
      .fill("Presse convergente");
    await editForm
      .getByRole("combobox", { name: "Muscle principal" })
      .selectOption("quadriceps");
    await editForm
      .getByRole("combobox", { name: "Matériel" })
      .selectOption("machine");
    await editForm.getByRole("button", { name: "Enregistrer" }).click();
    await expect(
      page.getByRole("heading", { name: "Presse convergente", exact: true }),
    ).toBeVisible();

    await expect
      .poll(async () => (await readWorkouts(page)).customDefinitions[0]?.name)
      .toBe("Presse convergente");
    const store = await readWorkouts(page);
    expect(store.customDefinitions[0]).toMatchObject({
      name: "Presse convergente",
      muscleTargets: [
        { muscle: "quadriceps", role: "primary" },
        { muscle: "triceps", role: "secondary" },
      ],
      equipment: ["machine"],
    });
    expect(store.templates[0].exercises[0]).toMatchObject({
      name: "Presse convergente",
      exerciseDefinitionId: store.customDefinitions[0].id,
      definitionSnapshot: store.customDefinitions[0],
    });
    expect(store.sessions[0].snapshot.exercises[0]).toMatchObject({
      name: "Presse perso",
      definitionSnapshot: {
        name: "Presse perso",
        muscleTargets: [
          { muscle: "grand_pectoral", role: "primary" },
          { muscle: "triceps", role: "secondary" },
        ],
      },
    });
    const updatedCatalog = await openCatalog(page);
    await updatedCatalog
      .getByRole("searchbox", { name: "Rechercher un exercice" })
      .fill("Presse convergente");
    await expect(
      updatedCatalog.getByRole("button", {
        name: "Modifier Presse convergente",
      }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

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
      page.getByRole("button", { name: "Changer l’exercice" }),
    ).toBeDisabled();
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
      page.getByRole("region", { name: `Séries de ${renamedCustomName}` }),
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
    ).toContain(renamedCustomName);
    expect(
      store.sessions[0].snapshot.exercises.map((exercise) => exercise.name),
    ).toContain(renamedCustomName);
    const snapshot = store.sessions[0].snapshot.exercises.find(
      (exercise) => exercise.name === renamedCustomName,
    );
    expect(snapshot?.exerciseDefinitionId).toBeTruthy();
    expect(snapshot?.definitionSnapshot?.name).toBe(renamedCustomName);
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
