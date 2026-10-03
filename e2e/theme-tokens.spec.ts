import { expect, test, type Page } from "@playwright/test";

async function expectThemeApplied(page: Page) {
  const palette = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return Object.fromEntries(
      [
        "--background",
        "--surface",
        "--surface-raised",
        "--surface-inset",
        "--line",
        "--text",
        "--muted",
        "--accent",
        "--accent-cta-start",
        "--accent-gradient-end",
        "--accent-soft",
        "--accent-ink",
        "--danger",
        "--success",
      ].map((token) => [token, style.getPropertyValue(token).trim()]),
    );
  });
  expect(palette).toMatchObject({
    "--background": "#101012",
    "--surface": "#1c1b1e",
    "--surface-raised": "#27262a",
    "--surface-inset": "#141316",
    "--line": "#3e3b40",
    "--text": "#f5f1ef",
    "--muted": "#b7b0ae",
    "--accent": "#ff5708",
    "--accent-cta-start": "#ff5a1f",
    "--accent-gradient-end": "#ff3f25",
    "--accent-soft": "#ffb77f",
    "--accent-ink": "#351000",
    "--danger": "#ff5258",
    "--success": "#a8d8ba",
  });

  const themedElements = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLElement>(
        ".app-shell, .dashboard-tile, .bottom-navigation-surface, .workout-card, .exercise-hero, .set-block, .catalog-result, .confirmation-dialog",
      ),
    )
      .filter((element) => element.getClientRects().length > 0)
      .map((element) => {
        const style = getComputedStyle(element);
        return {
          name: element.className,
          values: [
            style.color,
            style.backgroundColor,
            style.backgroundImage,
            style.borderColor,
            style.boxShadow,
          ],
        };
      }),
  );
  expect(themedElements.length).toBeGreaterThan(0);
  for (const element of themedElements)
    expect(element.values.join(" "), element.name).not.toContain("var(");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

for (const width of [320, 390]) {
  test(`keeps the dark orange theme consistent across screens at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await expectThemeApplied(page);

    const sessionsTile = page.getByRole("button", {
      name: "Ouvrir Mes séances",
    });
    const navigation = page.locator(".bottom-navigation-surface");
    await expect(navigation).toBeVisible();
    expect(
      await navigation.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      ),
    ).not.toBe("rgba(0, 0, 0, 0)");

    await sessionsTile.click();
    const library = page.getByRole("region", { name: "Mes séances" });
    await expect(library).toBeVisible();
    await expectThemeApplied(page);

    await page.getByRole("button", { name: "Créer une séance" }).click();
    const workoutForm = page.getByRole("dialog", { name: "Séance" });
    await workoutForm.getByRole("textbox", { name: "Nom" }).fill("Thème E2E");
    await workoutForm.getByRole("button", { name: "Enregistrer" }).click();
    await expect(workoutForm).toHaveCount(0);
    const workoutCard = page
      .locator(".workout-card")
      .filter({ hasText: "Thème E2E" });
    await expect(workoutCard).toBeVisible();
    expect(
      await workoutCard.evaluate(
        (element) => getComputedStyle(element).backgroundImage,
      ),
    ).not.toBe("none");
    await workoutCard.click();
    await expect(page.locator(".workout-preparation, .empty")).toBeVisible();
    await page.getByRole("button", { name: "Ajouter un exercice" }).click();

    const catalog = page.getByRole("region", { name: "Catalogue d’exercices" });
    await expect(catalog).toBeVisible();
    const catalogResultVisual = catalog
      .locator(".catalog-exercise-visual")
      .first();
    await expect(catalogResultVisual).toBeVisible();
    expect(
      await catalogResultVisual.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      ),
    ).not.toBe("rgba(0, 0, 0, 0)");
    await expectThemeApplied(page);
    await catalog
      .getByRole("button", { name: "+ Créer un exercice personnalisé" })
      .click();
    const customForm = page.getByRole("dialog", {
      name: "Créer un exercice personnalisé",
    });
    await customForm
      .getByRole("textbox", { name: "Nom" })
      .fill("Accent custom");
    await customForm.getByRole("button", { name: "Enregistrer" }).click();
    const exerciseForm = page.getByRole("dialog", { name: "Exercice" });
    await exerciseForm.getByRole("button", { name: "Enregistrer" }).click();
    await expect(exerciseForm).toHaveCount(0);
    await expect(page.locator(".exercise-hero")).toBeVisible();
    await expectThemeApplied(page);

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

    await page.locator(".exercise-menu button.danger").click();
    const deleteConfirmation = page.getByRole("alertdialog", {
      name: "Supprimer cet exercice ?",
    });
    const deleteButton = deleteConfirmation.getByRole("button", {
      name: "Supprimer",
      exact: true,
    });
    await expect(deleteButton).toHaveCSS("color", "rgb(255, 82, 88)");
    await expect(deleteButton).toHaveCSS("background-color", "rgb(53, 23, 25)");
    await deleteConfirmation.getByRole("button", { name: "Annuler" }).click();

    await page.getByRole("button", { name: "Démarrer la séance" }).click();
    const sets = page.locator(".set-block");
    await expect(sets.first()).toBeVisible();
    await expectThemeApplied(page);
    await sets.first().getByRole("button", { name: "Lancer le repos" }).click();
    await sets
      .first()
      .getByRole("button", { name: "Mettre fin au repos" })
      .click();
    const restConfirmation = page.getByRole("alertdialog", {
      name: "Mettre fin au repos ?",
    });
    await restConfirmation.getByRole("button", { name: "Mettre fin" }).click();
    const performedSet = page.locator(".set-block.status-performed").first();
    await expect(performedSet).toBeVisible();
    await expect(performedSet.locator(".set-status")).toHaveCSS(
      "color",
      "rgb(168, 216, 186)",
    );
    await expect(page.getByRole("navigation")).toBeVisible();
    await expectThemeApplied(page);
  });
}
