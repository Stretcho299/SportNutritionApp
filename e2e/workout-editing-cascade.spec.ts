import { expect, test, type Page } from "@playwright/test";

async function createWorkoutPreview(page: Page, name: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Ouvrir Mes séances" }).click();
  await page.getByRole("button", { name: "Créer une séance" }).click();
  const form = page.getByRole("dialog", { name: "Séance" });
  await form.getByRole("textbox", { name: "Nom" }).fill(name);
  await form.getByRole("button", { name: "Enregistrer" }).click();
  await expect(form).toHaveCount(0);
  await page.locator(".workout-card").click();
  await expect(
    page.getByRole("region", { name: `Aperçu de ${name}` }),
  ).toBeVisible();
}

async function openPreparation(page: Page) {
  await page
    .getByRole("button", { name: "DÉMARRER LA SÉANCE", exact: true })
    .click();
}

async function addExercise(
  page: Page,
  name: string,
  options: { sets?: number; rest?: number } = {},
) {
  await page.getByRole("button", { name: "Gérer les exercices" }).click();
  const actions = page.getByRole("dialog", { name: "Actions de la séance" });
  await actions
    .getByRole("button", { name: "Ajouter un exercice", exact: true })
    .click();
  const form = page.getByRole("dialog", { name: "Exercice" });
  await form.getByRole("textbox", { name: "Nom" }).fill(name);
  if (options.sets !== undefined)
    await choosePickerValue(page, "Nombre de séries initiales", options.sets);
  if (options.rest !== undefined)
    await choosePickerValue(page, "Repos par défaut", options.rest);
  await form.getByRole("button", { name: "Enregistrer" }).click();
  await expect(form).toHaveCount(0);
}

async function choosePickerValue(page: Page, label: string, value: number) {
  await page.getByRole("button", { name: label, exact: true }).first().click();
  const picker = page.getByRole("dialog", { name: `Choisir ${label}` });
  if (label.startsWith("Repos")) {
    await picker
      .getByRole("listbox", { name: "Minutes" })
      .getByRole("option", {
        name: String(Math.floor(value / 60)),
        exact: true,
      })
      .click();
    await picker
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
    await picker
      .getByRole("listbox", { name: listbox })
      .getByRole("option", { name: String(value), exact: true })
      .click();
  }
  await picker.getByRole("button", { name: "Valider" }).click();
  await expect(picker).toHaveCount(0);
}

async function editSetValue(
  page: Page,
  label: string,
  setIndex: number,
  value: number,
  applyToFollowing = false,
) {
  await page
    .locator(".set-block")
    .nth(setIndex)
    .getByRole("button", { name: label, exact: true })
    .click();
  const picker = page.getByRole("dialog", { name: `Choisir ${label}` });
  await expect(picker).toBeVisible();
  if (label === "Repos") {
    await picker
      .getByRole("listbox", { name: "Minutes" })
      .getByRole("option", {
        name: String(Math.floor(value / 60)),
        exact: true,
      })
      .click();
    await picker
      .getByRole("listbox", { name: "Secondes" })
      .getByRole("option", { name: String(value % 60), exact: true })
      .click();
  } else {
    const listbox = label === "Charge (kg)" ? "Kilogrammes" : "Répétitions";
    await picker
      .getByRole("listbox", { name: listbox })
      .getByRole("option", { name: String(value), exact: true })
      .click();
  }
  const toggle = picker.getByRole("button", {
    name: "Appliquer aux séries suivantes",
  });
  if (applyToFollowing) {
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(
      picker.getByText(new RegExp(`Séries ${setIndex + 1} → 4`)),
    ).toBeVisible();
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
  } else if (setIndex < 3) {
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
  } else {
    await expect(toggle).toHaveCount(0);
  }
  await picker.getByRole("button", { name: "Valider" }).click();
  await expect(picker).toHaveCount(0);
}

async function expectSetValue(
  page: Page,
  label: string,
  setIndex: number,
  value: number,
) {
  await expect(
    page
      .locator(".set-block")
      .nth(setIndex)
      .getByRole("button", { name: label, exact: true }),
  ).toHaveAttribute("data-value", String(value));
}

for (const width of [390, 320]) {
  test(`2C.1 first session and exercise defaults at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await createWorkoutPreview(page, `Première ${width}`);
    const preview = page.getByRole("region", {
      name: `Aperçu de Première ${width}`,
    });
    await expect(preview.getByText("Première séance")).toBeVisible();
    await expect(preview.locator(".preview-metric-unavailable")).toHaveCount(0);
    await expect(preview.getByText("Pas encore de données")).toHaveCount(0);
    await expect(preview.locator(".preview-metrics > div")).toHaveCount(2);
    await expect(preview.getByText("Exercices", { exact: true })).toBeVisible();
    await expect(
      preview.getByText("Séries prévues", { exact: true }),
    ).toBeVisible();
    await expect(
      preview.getByRole("button", {
        name: "DÉMARRER LA SÉANCE",
        exact: true,
      }),
    ).toBeVisible();
    await openPreparation(page);
    await addExercise(page, "Développé couché");
    await expect(page.locator(".set-block")).toHaveCount(3);
    for (const setBlock of await page.locator(".set-block").all()) {
      await expect(
        setBlock.getByRole("button", { name: "Repos", exact: true }),
      ).toHaveAttribute("data-value", "150");
    }
  });

  test(`2C.1 cascades KG, reps, rest and OFF edits at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await createWorkoutPreview(page, `Cascade ${width}`);
    await openPreparation(page);
    await addExercise(page, "Squat", { sets: 4, rest: 30 });

    await editSetValue(page, "Charge (kg)", 0, 40);
    await editSetValue(page, "Charge (kg)", 1, 80, true);
    await expectSetValue(page, "Charge (kg)", 0, 40);
    for (const index of [1, 2, 3])
      await expectSetValue(page, "Charge (kg)", index, 80);

    await editSetValue(page, "Répétitions", 0, 6);
    await editSetValue(page, "Répétitions", 1, 10, true);
    await expectSetValue(page, "Répétitions", 0, 6);
    for (const index of [1, 2, 3])
      await expectSetValue(page, "Répétitions", index, 10);

    await editSetValue(page, "Repos", 0, 30);
    await editSetValue(page, "Repos", 1, 75, true);
    await expectSetValue(page, "Repos", 0, 30);
    for (const index of [1, 2, 3])
      await expectSetValue(page, "Repos", index, 75);

    await editSetValue(page, "Charge (kg)", 1, 85);
    await expectSetValue(page, "Charge (kg)", 0, 40);
    await expectSetValue(page, "Charge (kg)", 1, 85);
    await expectSetValue(page, "Charge (kg)", 2, 80);
    await expectSetValue(page, "Charge (kg)", 3, 80);
    await editSetValue(page, "Charge (kg)", 3, 90);
  });
}
