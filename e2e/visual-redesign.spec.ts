import { expect, test, type Page, type TestInfo } from "@playwright/test";

async function addExercise(page: Page, name: string, count = "2", rest = "90") {
  await page.getByRole("button", { name: "Gérer les exercices" }).click();
  await page
    .getByRole("dialog", { name: "Actions de la séance" })
    .getByRole("button", { name: "Ajouter un exercice", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Nom" }).fill(name);
  if (count !== "1")
    await choosePickerValue(page, "Nombre de séries initiales", Number(count));
  if (rest !== "90")
    await choosePickerValue(page, "Repos par défaut", Number(rest));
  const form = page.getByRole("dialog", { name: "Exercice" });
  await form.getByRole("button", { name: "Enregistrer" }).click();
  await expect(form).toHaveCount(0);
}

async function choosePickerValue(page: Page, label: string, value: number) {
  await page.getByRole("button", { name: label, exact: true }).first().click();
  const picker = page.getByRole("dialog", { name: `Choisir ${label}` });
  const wheelName =
    label === "Charge (kg)"
      ? "Kilogrammes"
      : label === "Répétitions"
        ? "Répétitions"
        : label === "Nombre de séries initiales"
          ? "Séries"
          : "Minutes";
  await expect(
    picker.getByRole("listbox", { name: wheelName }).getByRole("option", {
      selected: true,
    }),
  ).toBeVisible();
  const close = picker.getByRole("button", { name: "Fermer le panneau" });
  const closeBox = await close.boundingBox();
  expect(closeBox?.width).toBeGreaterThanOrEqual(42);
  expect(closeBox?.height).toBeGreaterThanOrEqual(32);
  expect(closeBox?.width).toBeGreaterThanOrEqual(42);
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
    await picker
      .getByRole("listbox", {
        name:
          label === "Charge (kg)"
            ? "Kilogrammes"
            : label === "Nombre de séries initiales"
              ? "Séries"
              : "Répétitions",
      })
      .getByRole("option", { name: String(value), exact: true })
      .click();
  }
  await picker.getByRole("button", { name: "Valider" }).click();
}

async function flickWheel(
  page: Page,
  wheel: import("@playwright/test").Locator,
) {
  const box = await wheel.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;
  let y = box!.y + box!.height * 0.72;
  if (page.context().browser()?.browserType().name() === "chromium") {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    for (let i = 0; i < 5; i++) {
      y -= 28;
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y }],
      });
      await page.waitForTimeout(20);
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await cdp.detach();
  } else {
    for (let i = 0; i < 4; i++) await wheel.press("ArrowDown");
  }
  await expect
    .poll(() =>
      wheel.evaluate((el) => {
        const selected = el.querySelector<HTMLElement>(
          '[role="option"][aria-selected="true"]',
        );
        if (!selected) return Number.POSITIVE_INFINITY;
        return Math.abs(
          selected.getBoundingClientRect().top +
            selected.getBoundingClientRect().height / 2 -
            (el.getBoundingClientRect().top + el.clientHeight / 2),
        );
      }),
    )
    .toBeLessThan(6);
  expect(
    await wheel.getByRole("option", { selected: true }).textContent(),
  ).not.toBe("0");
}

async function screenshot(page: Page, info: TestInfo, name: string) {
  await page.screenshot({
    path: info.outputPath(`${name}.png`),
    animations: "disabled",
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

async function dragHandle(
  page: Page,
  sheet: import("@playwright/test").Locator,
  distance: number,
) {
  const handle = sheet.getByRole("button", { name: "Fermer le panneau" });
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + distance, { steps: 6 });
  await page.mouse.up();
}

async function createWorkoutAndOpenPreparation(page: Page, name: string) {
  await page.getByRole("button", { name: "Ouvrir Mes séances" }).click();
  await page.getByRole("button", { name: "Créer une séance" }).click();
  const workoutForm = page.getByRole("dialog", { name: "Séance" });
  await workoutForm.getByRole("textbox", { name: "Nom" }).fill(name);
  await workoutForm.getByRole("button", { name: "Enregistrer" }).click();
  await expect(workoutForm).toHaveCount(0);
  await page.locator(".workout-card").click();
  await page.getByRole("button", { name: "Refaire la séance" }).click();
}

for (const width of [390, 320]) {
  test(`mobile dashboard and workout navigation at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    const muscleNavigation = page.getByRole("button", {
      name: "Musculation",
    });
    await expect(muscleNavigation).toHaveAttribute("aria-current", "page");
    expect((await muscleNavigation.textContent())?.trim()).toBe("");
    await expect(
      page.getByRole("button", { name: "Nutrition" }),
    ).toHaveAttribute("aria-disabled", "true");
    const simulatedSafeInset = await page.evaluate(() => {
      const inset = Math.round(
        (window.visualViewport?.height ?? window.innerHeight) * 0.04,
      );
      document.documentElement.style.setProperty(
        "--bottom-navigation-safe-inset",
        `${inset}px`,
      );
      return inset;
    });
    const navigationGeometry = await page
      .getByRole("navigation")
      .evaluate((navigation) => {
        const bounds = navigation.getBoundingClientRect();
        const buttonBounds = navigation
          .querySelector("button")!
          .getBoundingClientRect();
        const iconBounds = navigation
          .querySelector("button svg")!
          .getBoundingClientRect();
        const styles = getComputedStyle(navigation);
        const rootStyles = getComputedStyle(document.documentElement);
        const viewportBottom =
          (window.visualViewport?.offsetTop ?? 0) +
          (window.visualViewport?.height ?? window.innerHeight);
        return {
          bottom: bounds.bottom,
          height: bounds.height,
          buttonHeight: buttonBounds.height,
          buttonBottomGap: viewportBottom - buttonBounds.bottom,
          iconBottomGap: viewportBottom - iconBounds.bottom,
          paddingBottom: Number.parseFloat(styles.paddingBottom),
          visualOffset: Number.parseFloat(
            rootStyles.getPropertyValue("--bottom-nav-visual-offset"),
          ),
          activeRadius: getComputedStyle(
            navigation.querySelector("button.active")!,
          ).borderRadius,
          viewportBottom,
        };
      });
    expect(
      navigationGeometry.bottom - navigationGeometry.viewportBottom,
    ).toBeGreaterThanOrEqual(0);
    expect(
      navigationGeometry.bottom - navigationGeometry.viewportBottom,
    ).toBeLessThanOrEqual(16);
    expect(navigationGeometry.height).toBeLessThan(
      navigationGeometry.viewportBottom * 0.08,
    );
    expect(navigationGeometry.buttonHeight).toBeGreaterThanOrEqual(44);
    expect(navigationGeometry.activeRadius).toBe("12px");
    expect(navigationGeometry.buttonBottomGap).toBeCloseTo(
      navigationGeometry.paddingBottom - navigationGeometry.visualOffset,
      0,
    );
    expect(navigationGeometry.buttonBottomGap).toBeGreaterThanOrEqual(
      simulatedSafeInset * 0.4 - navigationGeometry.visualOffset,
    );
    expect(navigationGeometry.buttonBottomGap).toBeLessThan(
      simulatedSafeInset * 0.6 - navigationGeometry.visualOffset,
    );
    expect(navigationGeometry.iconBottomGap).toBeGreaterThan(
      navigationGeometry.buttonBottomGap + 8,
    );
    expect(
      navigationGeometry.height - navigationGeometry.buttonHeight,
    ).toBeLessThanOrEqual(navigationGeometry.paddingBottom + 2);
    const sessionsTile = page.getByRole("button", {
      name: "Ouvrir Mes séances",
    });
    const calendarTile = page.getByRole("region", {
      name: "Calendrier bientôt disponible",
    });
    const sessionsBounds = await sessionsTile.boundingBox();
    const calendarBounds = await calendarTile.boundingBox();
    expect(
      Math.abs(sessionsBounds!.width - sessionsBounds!.height),
    ).toBeLessThan(2);
    expect(
      Math.abs(sessionsBounds!.width - calendarBounds!.width),
    ).toBeLessThan(2);
    await screenshot(page, info, "dashboard");
    const tileBox = await sessionsTile.boundingBox();
    await page.mouse.move(
      tileBox!.x + tileBox!.width / 2,
      tileBox!.y + tileBox!.height / 2,
    );
    await page.mouse.down();
    await expect
      .poll(() =>
        sessionsTile.evaluate(
          (element) => new DOMMatrix(getComputedStyle(element).transform).a,
        ),
      )
      .toBeLessThan(0.99);
    await page.mouse.move(0, 0);
    await page.mouse.up();
    await expect
      .poll(() =>
        sessionsTile.evaluate(
          (element) => new DOMMatrix(getComputedStyle(element).transform).a,
        ),
      )
      .toBe(1);
    await sessionsTile.click();
    const sessionsLibrary = page.getByRole("region", { name: "Mes séances" });
    await expect(sessionsLibrary).toHaveCSS(
      "animation-name",
      "page-forward-in",
    );
    await expect(sessionsLibrary).toHaveCSS("animation-duration", "0.22s");
    await expect(
      sessionsLibrary.getByText("Aucune séance prête"),
    ).toBeVisible();
    await expect(
      sessionsLibrary.getByText("Créez votre première séance."),
    ).toBeVisible();
    await expect(sessionsLibrary.locator(".sessions-empty button")).toHaveCount(
      0,
    );
    await screenshot(page, info, "library-empty");
    await page.getByRole("button", { name: "Créer une séance" }).click();
    const workoutForm = page.getByRole("dialog", { name: "Séance" });
    const workoutName = workoutForm.getByRole("textbox", { name: "Nom" });
    await expect(workoutName).not.toBeFocused();
    expect(await page.evaluate(() => document.body.style.position)).toBe(
      "fixed",
    );
    await screenshot(page, info, "workout-sheet");
    await workoutName.fill("Force · Haut du corps");
    await workoutForm.getByRole("button", { name: "Enregistrer" }).click();
    await expect(workoutForm).toHaveCount(0);
    expect(await page.evaluate(() => document.body.style.position)).toBe("");
    await screenshot(page, info, "library");
    await page.getByRole("button", { name: "Retour aux séances" }).click();
    await expect(page.getByRole("region", { name: "Entraînement" })).toHaveCSS(
      "animation-name",
      "page-back-in",
    );
    const populatedSessionsTile = page.getByRole("button", {
      name: "Ouvrir Mes séances",
    });
    await expect(populatedSessionsTile).toContainText("1 prête");
    const populatedTileBounds = await populatedSessionsTile.boundingBox();
    expect(populatedTileBounds!.width).toBeCloseTo(sessionsBounds!.width, 0);
    expect(populatedTileBounds!.height).toBeCloseTo(sessionsBounds!.height, 0);
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe(
      "BUTTON",
    );
    await populatedSessionsTile.click();
    await page.locator(".workout-card").click();
    await expect(
      page.getByRole("region", { name: "Aperçu de Force · Haut du corps" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Démarrer la séance" }),
    ).toHaveCount(0);
    await expect(page.getByText("Pas encore de données")).toHaveCount(2);
    await page.getByRole("button", { name: "Refaire la séance" }).click();
    await addExercise(page, "Développé couché", "12");
    await page.getByRole("button", { name: "Retour aux séances" }).click();
    const populatedPreview = page.getByRole("region", {
      name: "Aperçu de Force · Haut du corps",
    });
    await expect(populatedPreview.getByText("12 séries")).toBeVisible();
    await screenshot(page, info, "preview-populated");
    await noOverflow(page);
  });

  test(`mobile picker controls at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await createWorkoutAndOpenPreparation(page, "Force · Haut du corps");
    await addExercise(page, "Développé couché", "12");
    await page.getByRole("button", { name: "Charge (kg)" }).first().click();
    const weightPicker = page.getByRole("dialog", {
      name: "Choisir Charge (kg)",
    });
    const weightWheel = weightPicker.getByRole("listbox", {
      name: "Kilogrammes",
    });
    expect(await page.evaluate(() => document.body.style.position)).toBe(
      "fixed",
    );
    const wheelStyles = await weightWheel.evaluate((element) => {
      const styles = getComputedStyle(element);
      return {
        overflowY: styles.overflowY,
        overscrollBehaviorY: styles.overscrollBehaviorY,
        scrollSnapType: styles.scrollSnapType,
        touchAction: styles.touchAction,
      };
    });
    expect(wheelStyles.overflowY).toBe("auto");
    expect(wheelStyles.overscrollBehaviorY).toBe("contain");
    expect(wheelStyles.scrollSnapType).toContain("y");
    expect(wheelStyles.touchAction).toBe("pan-y");
    await dragHandle(page, weightPicker, 28);
    await expect(weightPicker).toBeVisible();
    await expect(weightPicker).toHaveCSS(
      "transform",
      /matrix\(1, 0, 0, 1, 0, 0\)/,
    );
    await screenshot(page, info, "picker-weight");
    await flickWheel(page, weightWheel);
    await page.locator(".picker-backdrop").dispatchEvent("pointerdown");
    await expect(weightPicker).toHaveCount(0);
    await choosePickerValue(page, "Charge (kg)", 62.5);
    await page.getByRole("button", { name: "Répétitions" }).first().click();
    const repetitionsPicker = page.getByRole("dialog", {
      name: "Choisir Répétitions",
    });
    await page.locator(".picker-backdrop").dispatchEvent("pointerdown");
    await expect(repetitionsPicker).toHaveCount(0);
    await choosePickerValue(page, "Répétitions", 10);
    await page.getByRole("button", { name: "Repos" }).first().click();
    const restPicker = page.getByRole("dialog", {
      name: "Choisir Repos",
    });
    await dragHandle(page, restPicker, 120);
    await expect(restPicker).toHaveCount(0);
    expect(await page.evaluate(() => document.body.style.position)).toBe("");
    await choosePickerValue(page, "Repos", 90);
    const firstSet = page.locator(".set-block").first();
    const values = firstSet.locator(".picker-trigger-value strong");
    await expect(values).toHaveCount(3);
    for (const value of await values.all()) {
      expect(
        await value.evaluate((element) =>
          Number.parseFloat(getComputedStyle(element).fontSize),
        ),
      ).toBeGreaterThanOrEqual(22);
    }
    const units = firstSet.locator(".picker-trigger-value small");
    await expect(units).toHaveCount(2);
    for (const unit of await units.all()) {
      expect(
        await unit.evaluate((element) =>
          Number.parseFloat(getComputedStyle(element).fontSize),
        ),
      ).toBeLessThan(12);
    }
    await noOverflow(page);
    await screenshot(page, info, "preparation");
  });

  test(`mobile dense preparation layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await createWorkoutAndOpenPreparation(page, "Force · Haut du corps");
    await addExercise(page, "Développé couché", "12");
    for (const name of [
      "Rowing",
      "Tractions",
      "Élévations latérales",
      "Curl incliné",
      "Extension triceps à la poulie haute",
    ]) {
      await addExercise(page, name, "1");
    }
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
    expect(navBounds!.y + navBounds!.height).toBeCloseTo(844, 0);
  });

  test(`mobile short viewport bottom sheet at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await createWorkoutAndOpenPreparation(page, "Force · Haut du corps");
    // A short screen (e.g. keyboard) must allow page scrolling to all controls.
    await page.setViewportSize({ width, height: 480 });
    await page.getByRole("button", { name: "Gérer les exercices" }).click();
    await page
      .getByRole("dialog", { name: "Actions de la séance" })
      .getByRole("button", { name: "Ajouter un exercice", exact: true })
      .click();
    await page.getByRole("textbox", { name: "Nom" }).fill("Mobilité");
    const shortSheet = page.getByRole("dialog", { name: "Exercice" });
    const shortHandle = shortSheet.getByRole("button", {
      name: "Fermer le panneau",
    });
    await shortHandle.scrollIntoViewIfNeeded();
    await expect(shortHandle).toBeInViewport();
    await screenshot(page, info, "exercise-sheet-short-viewport");
    await noOverflow(page);
    await page.locator(".sheet-backdrop").dispatchEvent("pointerdown");
  });

  test(`mobile persistent execution at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await createWorkoutAndOpenPreparation(page, "Force · Haut du corps");
    await addExercise(page, "Développé couché", "2", "90");
    await addExercise(page, "Rowing", "2", "90");
    await choosePickerValue(page, "Charge (kg)", 62.5);
    await choosePickerValue(page, "Répétitions", 10);
    await page.getByRole("button", { name: "Démarrer la séance" }).click();
    const finishExercise = page.getByRole("button", {
      name: "Terminer l’exercice",
    });
    const finishAlignment = await finishExercise.evaluate((button) => {
      const buttonBounds = button.getBoundingClientRect();
      const labelBounds = button.querySelector("span")!.getBoundingClientRect();
      const styles = getComputedStyle(button);
      return {
        display: styles.display,
        alignItems: styles.alignItems,
        justifyContent: styles.justifyContent,
        textAlign: styles.textAlign,
        horizontalOffset: Math.abs(
          buttonBounds.x +
            buttonBounds.width / 2 -
            (labelBounds.x + labelBounds.width / 2),
        ),
        verticalOffset: Math.abs(
          buttonBounds.y +
            buttonBounds.height / 2 -
            (labelBounds.y + labelBounds.height / 2),
        ),
        overflows: button.scrollWidth > button.clientWidth + 1,
      };
    });
    expect(finishAlignment).toMatchObject({
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      overflows: false,
    });
    expect(finishAlignment.horizontalOffset).toBeLessThan(1);
    expect(finishAlignment.verticalOffset).toBeLessThan(1);
    await screenshot(page, info, "execution-started");
    await page.getByRole("button", { name: "Retour aux séances" }).click();
    const activeModule = page.getByRole("region", { name: "Séance en cours" });
    await expect(activeModule.locator(".active-session-dot")).toBeVisible();
    await expect(activeModule).toContainText("Force · Haut du corps");
    await expect(activeModule).toContainText("0 / 4 séries");
    await expect(activeModule).toContainText("Reprendre");
    await expect(activeModule.locator(".workout-card")).toHaveCount(1);
    await expect(activeModule.locator(".active-session-module")).toHaveCount(0);
    await screenshot(page, info, "dashboard-active");
    await activeModule.locator(".workout-card").click();
    const first = page.locator(".set-block").first();
    const rail = page.getByRole("list", { name: "Exercices" });
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator(".order")).toHaveCount(1);
    await expect(
      page.locator(".set-block").nth(1).locator(".order"),
    ).toHaveCount(1);
    await first.getByRole("button", { name: "Lancer le repos" }).click();
    const timer = page.getByRole("timer");
    await expect(timer).toBeVisible();
    const ringProgress = timer.locator(".countdown-value");
    const initialOffset = Number(
      await ringProgress.getAttribute("stroke-dashoffset"),
    );
    await expect
      .poll(() => ringProgress.getAttribute("stroke-dashoffset").then(Number))
      .toBeGreaterThan(initialOffset);
    await expect(timer).toHaveAttribute("data-reference-seconds", "90");
    await expect(
      page.getByRole("dialog", { name: "Détail du repos" }),
    ).toHaveCount(0);
    await expect(first.getByLabel("Charge (kg)")).toBeEnabled();
    await rail.getByRole("button").nth(1).click();
    await expect(rail.locator("li").nth(1)).toHaveClass(/execution-upcoming/);
    await expect(
      page.locator(".set-block").first().getByRole("button", {
        name: "Lancer le repos",
      }),
    ).toBeDisabled();
    await expect(timer).toBeVisible();
    await rail.getByRole("button").first().click();
    await screenshot(page, info, "rest");
    await page
      .getByRole("button", { name: "+ Ajouter une série" })
      .scrollIntoViewIfNeeded();
    await expect(timer).toBeInViewport();
    // Reload restores the deadline and numeric execution data from IndexedDB.
    await page.reload();
    await expect(page.locator(".workout-card")).toBeVisible();
    await page.locator(".workout-card").click();
    await expect(timer).toBeVisible();
    await expect(first.getByLabel("Charge (kg)")).toHaveAttribute(
      "data-value",
      "62.5",
    );
    await rail.getByRole("button").nth(1).click();
    await expect(rail.locator("li").nth(1)).toHaveClass(/execution-upcoming/);
    const upcomingFirst = page.locator(".set-block").first();
    await expect(upcomingFirst.locator(".order")).toHaveCount(1);
    await expect(
      page.locator(".set-block").nth(1).locator(".order"),
    ).toHaveCount(1);
    await expect(timer).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Progression de la séance" }),
    ).toContainText("Développé couché");
    await rail.getByRole("button").first().click();
    await first.getByRole("button", { name: "Mettre fin au repos" }).click();
    const stopDialog = page.getByRole("alertdialog", {
      name: "Mettre fin au repos ?",
    });
    await expect(stopDialog).toContainText(/Il reste \d+ secondes?/);
    await stopDialog.getByRole("button", { name: "Annuler" }).click();
    await expect(first).toHaveClass(/status-resting/);
    await first.getByRole("button", { name: "Mettre fin au repos" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Mettre fin" })
      .click();
    await expect(first).toHaveClass(/status-performed/);
    await expect(page.locator(".set-block").nth(1)).toHaveClass(
      /status-active/,
    );
    await expect(page.getByRole("progressbar")).toHaveAttribute("value", "1");
    await screenshot(page, info, "states");
    await noOverflow(page);
    for (let i = 0; i < 2; i++) {
      await rail.getByRole("button").nth(i).click();
      await page.getByRole("button", { name: "Terminer l’exercice" }).click();
      await page
        .getByRole("alertdialog", { name: "Mettre fin à cet exercice ?" })
        .getByRole("button", { name: "Mettre fin" })
        .click();
    }
    await page
      .getByRole("button", { name: "Terminer la séance", exact: true })
      .click();
    await page
      .getByRole("alertdialog", { name: "Terminer la séance ?" })
      .getByRole("button", { name: "Terminer" })
      .click();
    await expect(
      page.getByRole("button", { name: "Démarrer la séance" }),
    ).toBeVisible();
    await screenshot(page, info, "completed");
    await page.reload();
    await page.getByRole("button", { name: "Ouvrir Mes séances" }).click();
    await page.locator(".workout-card").click();
    await page.getByRole("button", { name: "Refaire la séance" }).click();
    await expect(
      page.getByRole("button", { name: "Démarrer la séance" }),
    ).toBeVisible();
  });
}

test("bottom sheet follows the drag handle and restores the locked page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Ouvrir Mes séances" }).click();
  await page.getByRole("button", { name: "Créer une séance" }).click();
  const sheet = page.getByRole("dialog", { name: "Séance" });
  const name = sheet.getByRole("textbox", { name: "Nom" });
  await expect(name).not.toBeFocused();
  expect(await page.evaluate(() => document.body.style.position)).toBe("fixed");

  const handle = sheet.getByRole("button", { name: "Fermer le panneau" });
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 120, { steps: 6 });
  await expect(sheet).toHaveCSS("transform", /matrix\(1, 0, 0, 1, 0, 120\)/);
  await page.mouse.up();
  await expect(sheet).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.position)).toBe("");
});

test("exposes the iPhone standalone PWA metadata", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.locator('meta[name="apple-mobile-web-app-capable"]'),
  ).toHaveAttribute("content", "yes");
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    "content",
    /viewport-fit=cover/,
  );
  const manifest = await page.evaluate(async () =>
    fetch("/manifest.webmanifest").then((response) => response.json()),
  );
  expect(manifest).toMatchObject({
    display: "standalone",
    start_url: "/",
    scope: "/",
    background_color: "#060608",
    theme_color: "#0F0F14",
  });
});

test("honors reduced motion for dashboard and page navigation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const tile = page.getByRole("button", { name: "Ouvrir Mes séances" });
  await expect(tile).toHaveCSS("animation-name", "none");
  await tile.click();
  await expect(page.locator(".sessions-library")).toHaveCSS(
    "animation-name",
    "none",
  );
});

test("finishing the rest marks the set performed and advances progress", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Ouvrir Mes séances" }).click();
  await page.getByRole("button", { name: "Créer une séance" }).click();
  await page.getByRole("textbox", { name: "Nom" }).fill("Tempo");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.locator(".workout-card").click();
  await page.getByRole("button", { name: "Refaire la séance" }).click();
  await addExercise(page, "Squat", "2", "1");
  await page.getByRole("button", { name: "Démarrer la séance" }).click();
  const firstSet = page
    .getByRole("region", { name: "Séries de Squat" })
    .getByRole("listitem")
    .first();
  await firstSet.getByRole("button", { name: "Lancer le repos" }).click();
  await expect(page.getByRole("timer")).toBeVisible();
  await expect(firstSet).toHaveClass(/status-resting/);
  await expect(firstSet).toHaveClass(/status-performed/, { timeout: 5_000 });
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "1");
});

test("manually scrolls an overflowing timeline before locking reorder", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Ouvrir Mes séances" }).click();
  await page.getByRole("button", { name: "Créer une séance" }).click();
  await page.getByRole("textbox", { name: "Nom" }).fill("Overflow");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.locator(".workout-card").click();
  await page.getByRole("button", { name: "Refaire la séance" }).click();
  for (let index = 0; index < 8; index += 1)
    await addExercise(page, "Exercice " + (index + 1), "1");

  const rail = page.getByRole("list", { name: "Exercices" });
  const overflow = await rail.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeGreaterThan(overflow.clientWidth);
  const initialScrollLeft = await rail.evaluate(
    (element) => element.scrollLeft,
  );
  const first = rail.getByRole("button").first();
  const box = await first.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 100, y, { steps: 6 });
  await page.mouse.up();
  expect(await rail.evaluate((element) => element.scrollLeft)).toBeGreaterThan(
    initialScrollLeft,
  );
  await expect(rail).not.toHaveClass(/is-reordering/);

  const visibleIndex = await rail.getByRole("button").evaluateAll((buttons) => {
    const railBounds = (
      buttons[0].parentElement?.parentElement as HTMLElement
    ).getBoundingClientRect();
    return buttons.findIndex((button) => {
      const bounds = button.getBoundingClientRect();
      return bounds.left >= railBounds.left && bounds.right <= railBounds.right;
    });
  });
  expect(visibleIndex).toBeGreaterThanOrEqual(0);
  const reorderButton = rail.getByRole("button").nth(visibleIndex);
  const reorderBox = await reorderButton.boundingBox();
  expect(reorderBox).not.toBeNull();
  const reorderX = reorderBox!.x + reorderBox!.width / 2;
  const reorderY = reorderBox!.y + reorderBox!.height / 2;
  await page.mouse.move(reorderX, reorderY);
  await page.mouse.down();
  await page.waitForTimeout(350);
  await expect(rail).toHaveClass(/is-reordering/);
  await page.mouse.move(reorderX + 120, reorderY, { steps: 2 });
  await expect(rail).toHaveClass(/is-reordering/);
  await page.mouse.up();
  await expect(rail).not.toHaveClass(/is-reordering/);
});

test("exercise navigation animates according to workout order without changing execution state", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Ouvrir Mes séances" }).click();
  await page.getByRole("button", { name: "Créer une séance" }).click();
  await page.getByRole("textbox", { name: "Nom" }).fill("Direction");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.locator(".workout-card").click();
  await page.getByRole("button", { name: "Refaire la séance" }).click();
  await addExercise(page, "Premier", "1");
  await addExercise(page, "Deuxième", "1");
  await addExercise(page, "Troisième", "1");

  const rail = page.getByRole("list", { name: "Exercices" });
  const preparation = page.locator(".workout-preparation");
  const statusesBefore = await rail
    .locator("li")
    .evaluateAll((items) => items.map((item) => item.className));

  await rail.getByRole("button").nth(1).click();
  await expect(preparation).toHaveClass(/transition-next/);
  const currentVisual = page.locator(".exercise-transition-current");
  const outgoingVisual = page.locator(".exercise-transition-outgoing");
  await expect(currentVisual).toHaveCSS("animation-name", "exercise-next-in");
  await expect(currentVisual).toHaveCSS("animation-duration", "0.32s");
  await expect(outgoingVisual).toHaveCSS("animation-name", "exercise-next-out");
  await expect(outgoingVisual).toHaveCSS("pointer-events", "none");
  await expect(page.getByRole("heading", { name: "Deuxième" })).toBeVisible();

  expect(
    await page
      .locator(".workout-preparation, .workout-fixed-zones, .exercise-hero")
      .evaluateAll((elements) =>
        elements.map((element) => getComputedStyle(element).transform),
      ),
  ).toEqual(["none", "none", "none"]);

  await rail.getByRole("button").nth(2).click();
  await expect(preparation).toHaveClass(/transition-next/);
  await expect(page.getByRole("heading", { name: "Troisième" })).toBeVisible();

  await rail.getByRole("button").nth(1).click();
  await expect(preparation).toHaveClass(/transition-previous/);
  await expect(currentVisual).toHaveCSS(
    "animation-name",
    "exercise-previous-in",
  );
  await expect(currentVisual).toHaveCSS("animation-duration", "0.32s");
  await expect(outgoingVisual).toHaveCSS(
    "animation-name",
    "exercise-previous-out",
  );
  await expect(page.getByRole("heading", { name: "Deuxième" })).toBeVisible();
  expect(
    await rail
      .locator("li")
      .evaluateAll((items) =>
        items.map((item) => item.className.replace("selected ", "")),
      ),
  ).toEqual(statusesBefore.map((status) => status.replace("selected ", "")));
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const thirdTab = rail.getByRole("button").nth(2);
  const thirdBox = await thirdTab.boundingBox();
  const firstBox = await rail.getByRole("button").first().boundingBox();
  expect(thirdBox).not.toBeNull();
  expect(firstBox).not.toBeNull();
  await page.mouse.move(
    thirdBox!.x + thirdBox!.width / 2,
    thirdBox!.y + thirdBox!.height / 2,
  );
  await page.mouse.down();
  await page.waitForTimeout(450);
  await page.mouse.move(firstBox!.x - 12, thirdBox!.y + thirdBox!.height / 2, {
    steps: 6,
  });
  await page.mouse.up();
  await expect(rail.getByRole("button").first()).toHaveAccessibleName(
    /Troisième/,
  );

  await page.emulateMedia({ reducedMotion: "reduce" });
  await rail.getByRole("button").nth(2).click();
  expect(
    await page.locator(".exercise-hero").evaluate((hero) => {
      const current = hero.querySelector(".exercise-transition-current")!;
      const outgoing = hero.querySelector(".exercise-transition-outgoing");
      return {
        currentAnimation: getComputedStyle(current).animationName,
        outgoingDisplay: outgoing ? getComputedStyle(outgoing).display : "none",
      };
    }),
  ).toEqual({
    currentAnimation: "none",
    outgoingDisplay: "none",
  });
  await expect(page.getByRole("heading", { name: "Deuxième" })).toBeVisible();
});
