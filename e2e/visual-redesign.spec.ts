import { expect, test, type Page, type TestInfo } from "@playwright/test";

async function addExercise(page: Page, name: string, count = "2") {
  await page.getByRole("button", { name: "Gérer les exercices" }).click();
  await page
    .getByRole("dialog", { name: "Actions de la séance" })
    .getByRole("button", { name: "Ajouter un exercice", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Nom" }).fill(name);
  await page.getByLabel("Nombre de séries initiales").fill(count);
  await page.getByLabel("Repos par défaut (secondes)").fill("90");
  await page.getByRole("button", { name: "Enregistrer" }).click();
}

async function screenshot(page: Page, info: TestInfo, name: string) {
  await page.screenshot({
    path: info.outputPath(`${name}.png`),
    fullPage: false,
    scale: "css",
  });
  await info.attach(name, {
    path: info.outputPath(`${name}.png`),
    contentType: "image/png",
  });
}

async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  for (const selector of [
    ".workout-control",
    ".exercise-hero",
    ".set-metrics",
    "[role=dialog]",
  ]) {
    for (const element of await page.locator(selector).all()) {
      expect(
        await element.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
    }
  }
}

for (const width of [390, 320]) {
  test(`mobile layout and persistent execution at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await screenshot(page, info, "empty");
    await page.getByRole("button", { name: "Créer une séance" }).click();
    await page
      .getByRole("textbox", { name: "Nom" })
      .fill("Force · Haut du corps");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await screenshot(page, info, "library");
    await page.locator(".workout-card").click();
    await addExercise(page, "Développé couché", "12");
    for (const name of [
      "Rowing",
      "Tractions",
      "Élévations latérales",
      "Curl incliné",
      "Extension triceps à la poulie haute",
    ]) {
      await addExercise(page, name);
    }
    const first = page.locator(".set-block").first();
    await first.getByLabel("Charge (kg)").fill("62.5");
    await first.getByLabel("Répétitions").fill("10");
    await noOverflow(page);
    await screenshot(page, info, "preparation");
    const rail = page.getByRole("list", { name: "Exercices" });
    const lastTab = rail.getByRole("button").last();
    await lastTab.click();
    await expect(
      page.getByRole("heading", {
        name: "Extension triceps à la poulie haute",
      }),
    ).toBeVisible();
    expect(await rail.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    await noOverflow(page);
    await screenshot(page, info, "long-name");
    await rail.getByRole("button").first().click();
    const fixedBefore = await page
      .locator(".workout-fixed-zones")
      .boundingBox();
    await page.getByRole("button", { name: "+ Ajouter une série" }).click();
    await expect(page.locator(".set-block")).toHaveCount(13);
    expect(await page.locator(".workout-fixed-zones").boundingBox()).toEqual(
      fixedBefore,
    );
    expect(
      await page.locator(".planned-sets").evaluate((el) => el.scrollTop),
    ).toBeGreaterThan(0);
    await page
      .getByRole("button", { name: "+ Ajouter une série" })
      .scrollIntoViewIfNeeded();
    const addBounds = await page
      .getByRole("button", { name: "+ Ajouter une série" })
      .boundingBox();
    const navBounds = await page.getByRole("navigation").boundingBox();
    expect(addBounds!.y + addBounds!.height).toBeLessThanOrEqual(navBounds!.y);
    await screenshot(page, info, "scrolled");
    await page.getByRole("button", { name: "Démarrer la séance" }).click();
    await first.getByRole("button", { name: "Lancer le repos" }).click();
    const timer = page.getByRole("timer");
    await expect(timer).toBeVisible();
    const initialOffset = Number(
      await timer.locator(".countdown-value").getAttribute("stroke-dashoffset"),
    );
    await expect
      .poll(async () =>
        Number(
          await timer
            .locator(".countdown-value")
            .getAttribute("stroke-dashoffset"),
        ),
      )
      .toBeGreaterThan(initialOffset);
    await expect(first.getByLabel("Charge (kg)")).toBeDisabled();
    await screenshot(page, info, "rest");
    await page
      .getByRole("button", { name: "+ Ajouter une série" })
      .scrollIntoViewIfNeeded();
    await expect(timer).toBeInViewport();
    // Reload restores the deadline and numeric execution data from IndexedDB.
    await page.reload();
    await page.locator(".workout-card").click();
    await expect(timer).toBeVisible();
    await expect(first.getByLabel("Charge (kg)")).toHaveValue("62.5");
    await rail.getByRole("button").nth(1).click();
    await expect(rail.locator("li").nth(1)).toHaveClass(/execution-upcoming/);
    await expect(timer).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Progression de la séance" }),
    ).toContainText("Développé couché");
    await rail.getByRole("button").first().click();
    await first.getByRole("button", { name: "Terminer le repos" }).click();
    await expect(first).toHaveClass(/status-performed/);
    await expect(page.locator(".set-block").nth(1)).toHaveClass(
      /status-active/,
    );
    await expect(page.getByRole("progressbar")).toHaveAttribute("value", "1");
    await screenshot(page, info, "states");
    await noOverflow(page);
    // A short screen (e.g. keyboard) must allow page scrolling to all controls.
    await page.setViewportSize({ width, height: 480 });
    await page.getByRole("button", { name: "Gérer les exercices" }).click();
    await page
      .getByRole("button", { name: "Ajouter un exercice", exact: true })
      .click();
    await page.getByRole("textbox", { name: "Nom" }).fill("Mobilité");
    await page
      .getByRole("button", { name: "Annuler", exact: true })
      .scrollIntoViewIfNeeded();
    await expect(
      page.getByRole("button", { name: "Annuler", exact: true }),
    ).toBeInViewport();
    await noOverflow(page);
    await screenshot(page, info, "short-screen-sheet");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.getByRole("button", { name: "+ Ajouter une série" }).click();
    await noOverflow(page);
    await page.setViewportSize({ width, height: 844 });
    for (let i = 0; i < 7; i++) {
      await rail.getByRole("button").nth(i).click();
      await page.getByRole("button", { name: "Terminer l’exercice" }).click();
    }
    await page
      .getByRole("button", { name: "Terminer la séance", exact: true })
      .click();
    await expect(
      page.getByText("Séance terminée", { exact: true }),
    ).toBeVisible();
    await screenshot(page, info, "completed");
    await page.reload();
    await expect(page.locator(".workout-badge")).toContainText("Terminée");
    await page.locator(".workout-card").click();
    await expect(
      page.getByText("Séance terminée", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Démarrer la séance" }),
    ).toHaveCount(0);
  });
}
