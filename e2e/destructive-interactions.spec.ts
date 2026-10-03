import { expect, test, type Page } from "@playwright/test";

async function createWorkout(page: Page, name: string) {
  await page.getByRole("button", { name: "Créer une séance" }).click();
  const sheet = page.getByRole("dialog", { name: "Séance" });
  await sheet.getByRole("textbox", { name: "Nom" }).fill(name);
  await sheet.getByRole("button", { name: "Enregistrer" }).click();
  await expect(sheet).toHaveCount(0);
}

async function addCustomExercise(page: Page, name: string) {
  await page.getByRole("button", { name: "Gérer les exercices" }).click();
  const actions = page.getByRole("dialog", { name: "Actions de la séance" });
  await actions
    .getByRole("button", { name: "Ajouter un exercice", exact: true })
    .click();
  const catalog = page.getByRole("region", {
    name: "Catalogue d’exercices",
  });
  await catalog
    .getByRole("button", { name: "+ Créer un exercice personnalisé" })
    .click();
  const customForm = page.getByRole("dialog", {
    name: "Créer un exercice personnalisé",
  });
  await customForm.getByRole("textbox", { name: "Nom" }).fill(name);
  await customForm.getByRole("button", { name: "Enregistrer" }).click();
  await expect(customForm).toHaveCount(0);
  const exerciseForm = page.getByRole("dialog", { name: "Exercice" });
  await exerciseForm.getByRole("button", { name: "Enregistrer" }).click();
  await expect(exerciseForm).toHaveCount(0);
}

async function createWorkoutAndOpen(page: Page, name: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Ouvrir Mes séances" }).click();
  await createWorkout(page, name);
  await page.locator(".workout-card").filter({ hasText: name }).click();
  await expect(page.locator(".workout-preparation, .empty")).toBeVisible();
}

for (const width of [320, 390]) {
  test(`workout swipe follows the finger and deletes directly at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "Ouvrir Mes séances" }).click();
    await createWorkout(page, "Push");
    await createWorkout(page, "Pull");

    let card = page.locator(".workout-swipe").filter({ hasText: "Push" });
    const colors = await card.evaluate((element) => {
      const danger = getComputedStyle(document.documentElement)
        .getPropertyValue("--danger")
        .trim();
      const background = getComputedStyle(element).backgroundColor;
      const action = element.querySelector<HTMLElement>(".workout-delete")!;
      return {
        danger,
        background,
        actionBackground: getComputedStyle(action).backgroundColor,
        actionColor: getComputedStyle(action).color,
        touchAction: getComputedStyle(element).touchAction,
      };
    });
    expect(colors.danger).toBe("#ff5258");
    expect(colors.background).toBe("rgb(255, 82, 88)");
    expect(colors.actionBackground).toBe(colors.background);
    expect(colors.actionColor).toBe("rgb(27, 9, 11)");
    expect(colors.touchAction).toBe("pan-y");

    let cardButton = card.locator(".workout-card");
    await cardButton.click();
    await expect(
      page.getByRole("heading", { name: "Push", level: 1 }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Retour aux séances" }).click();
    card = page.locator(".workout-swipe").filter({ hasText: "Push" });
    cardButton = card.locator(".workout-card");

    const box = await cardButton.boundingBox();
    expect(box).not.toBeNull();
    const startX = box!.x + box!.width * 0.78;
    const startY = box!.y + box!.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, startY + 40, { steps: 3 });
    await page.mouse.up();
    await expect(card).not.toHaveClass(/open/);
    expect(
      await cardButton.evaluate((element) => element.getAttribute("style")),
    ).toContain("translateX(0px)");

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX - 20, startY, { steps: 2 });
    await expect
      .poll(() =>
        cardButton.evaluate(
          (element) => (element as HTMLElement).style.transform,
        ),
      )
      .toBe("translateX(-20px)");
    await page.mouse.up();
    await expect(card).not.toHaveClass(/open/);

    const dragBounds = await cardButton.boundingBox();
    expect(dragBounds).not.toBeNull();
    const dragStartX = dragBounds!.x + dragBounds!.width * 0.78;
    const dragStartY = dragBounds!.y + dragBounds!.height / 2;
    await page.mouse.move(dragStartX, dragStartY);
    await page.mouse.down();
    await page.mouse.move(Math.max(1, dragStartX - 220), dragStartY, {
      steps: 5,
    });
    const overshootTransform = await cardButton.evaluate(
      (element) => (element as HTMLElement).style.transform,
    );
    const overshootOffset = Number(
      overshootTransform.match(/translateX\((-?[\d.]+)px\)/)?.[1],
    );
    expect(overshootOffset).toBeLessThan(-102);
    expect(overshootOffset).toBeGreaterThan(-122);
    await page.mouse.up();
    await expect(card).toHaveClass(/open/);
    await expect
      .poll(() =>
        cardButton.evaluate(
          (element) => (element as HTMLElement).style.transform,
        ),
      )
      .toBe("translateX(-102px)");
    await expect(
      card.getByRole("button", { name: "Supprimer Push" }),
    ).toBeVisible();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);

    await expect(page.locator(".workout-preparation")).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: "Mes séances" }),
    ).toBeVisible();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);

    await card.getByRole("button", { name: "Supprimer Push" }).click();
    await expect(card).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Entraînement", level: 1 }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Ouvrir Mes séances" }).click();
    await expect(page.getByText("Pull", { exact: true })).toBeVisible();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
  });

  test(`destructive exercise controls use the danger color at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await createWorkoutAndOpen(page, "Danger");
    await addCustomExercise(page, "Custom Danger");

    const danger = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--danger")
        .trim(),
    );
    const setDelete = page.locator(".set-block .order button").first();
    const exerciseDelete = page.locator(".exercise-menu button.danger");
    expect(
      await setDelete.evaluate((button) => button.classList.contains("danger")),
    ).toBe(true);
    expect(
      await setDelete.evaluate((button) => getComputedStyle(button).color),
    ).toBe("rgb(255, 82, 88)");
    expect(
      await exerciseDelete.evaluate((button) => getComputedStyle(button).color),
    ).toBe("rgb(255, 82, 88)");
    expect(danger).toBe("#ff5258");

    await page
      .getByRole("button", { name: "Répétitions", exact: true })
      .first()
      .click();
    const repetitions = page.getByRole("dialog", {
      name: "Choisir Répétitions",
    });
    await repetitions
      .getByRole("listbox", { name: "Répétitions" })
      .getByRole("option", { name: "10", exact: true })
      .click();
    await repetitions
      .getByRole("button", { name: "ENREGISTRER", exact: true })
      .click();

    await setDelete.click();
    const setConfirmation = page.getByRole("alertdialog", {
      name: "Supprimer cette série ?",
    });
    await expect(
      setConfirmation.getByRole("button", { name: "Supprimer", exact: true }),
    ).toHaveClass(/danger/);
    await setConfirmation.getByRole("button", { name: "Annuler" }).click();

    await exerciseDelete.click();
    const exerciseConfirmation = page.getByRole("alertdialog", {
      name: "Supprimer cet exercice ?",
    });
    await expect(
      exerciseConfirmation.getByRole("button", {
        name: "Supprimer",
        exact: true,
      }),
    ).toHaveClass(/danger/);
    await exerciseConfirmation.getByRole("button", { name: "Annuler" }).click();

    await page.getByRole("button", { name: "Gérer les exercices" }).click();
    await page
      .getByRole("dialog", { name: "Actions de la séance" })
      .getByRole("button", { name: "Ajouter un exercice", exact: true })
      .click();
    await page.getByRole("tab", { name: "Mes exercices" }).click();
    await page.getByRole("button", { name: "Options Custom Danger" }).click();
    const customDelete = page.getByRole("menuitem", {
      name: "Supprimer Custom Danger",
    });
    expect(
      await customDelete.evaluate((button) => getComputedStyle(button).color),
    ).toBe("rgb(255, 82, 88)");
    await customDelete.click();
    const confirmation = page.getByRole("alertdialog", {
      name: "Supprimer cet exercice personnalisé ?",
    });
    const confirm = confirmation.getByRole("button", {
      name: "Supprimer",
      exact: true,
    });
    await expect(confirm).toHaveClass(/danger/);
    await expect(confirm).toHaveCSS("background-color", "rgb(53, 23, 25)");
    await confirmation.getByRole("button", { name: "Annuler" }).click();
  });

  test(`one continuous drag reaches both offscreen timeline ends at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width, height: 844 });
    await createWorkoutAndOpen(page, "Reorder");
    for (let index = 1; index <= 8; index += 1)
      await addCustomExercise(page, "Exercise " + index);

    const rail = page.getByRole("list", { name: "Exercices" });
    const first = rail.getByRole("button").first();
    const last = rail.getByRole("button").last();
    await expect(last).not.toBeInViewport();
    const railBounds = await rail.boundingBox();
    const firstBounds = await first.boundingBox();
    expect(railBounds).not.toBeNull();
    expect(firstBounds).not.toBeNull();
    const startX = firstBounds!.x + firstBounds!.width / 2;
    const y = firstBounds!.y + firstBounds!.height / 2;
    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.waitForTimeout(350);
    await page.mouse.move(railBounds!.x + railBounds!.width - 2, y, {
      steps: 8,
    });
    await expect(rail).toHaveClass(/is-reordering/);
    await expect
      .poll(
        () =>
          rail
            .locator("li")
            .evaluateAll((items) =>
              items.findIndex((item) =>
                item.classList.contains("reorder-target"),
              ),
            ),
        { timeout: 8_000 },
      )
      .toBe(7);
    await page.mouse.up();
    await expect(rail.getByRole("button").first()).toHaveAccessibleName(
      /Exercise 2/,
    );
    await expect(rail.getByRole("button").last()).toHaveAccessibleName(
      /Exercise 1/,
    );

    const source = rail.getByRole("button").last();
    await source.scrollIntoViewIfNeeded();
    const sourceBounds = await source.boundingBox();
    const currentRailBounds = await rail.boundingBox();
    expect(sourceBounds).not.toBeNull();
    expect(currentRailBounds).not.toBeNull();
    const reverseY = sourceBounds!.y + sourceBounds!.height / 2;
    await page.mouse.move(sourceBounds!.x + sourceBounds!.width / 2, reverseY);
    await page.mouse.down();
    await page.waitForTimeout(350);
    await page.mouse.move(currentRailBounds!.x + 2, reverseY, { steps: 8 });
    await expect
      .poll(
        () =>
          rail
            .locator("li")
            .evaluateAll((items) =>
              items.findIndex((item) =>
                item.classList.contains("reorder-target"),
              ),
            ),
        { timeout: 8_000 },
      )
      .toBe(0);
    await page.mouse.up();
    await expect(rail.getByRole("button").first()).toHaveAccessibleName(
      /Exercise 1/,
    );
    await expect(rail.getByRole("button").last()).toHaveAccessibleName(
      /Exercise 8/,
    );
  });
}
