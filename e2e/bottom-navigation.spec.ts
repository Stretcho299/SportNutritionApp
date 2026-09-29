import { expect, test, type Page, type TestInfo } from "@playwright/test";

async function capture(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({
    path,
    animations: "disabled",
    fullPage: false,
    scale: "css",
  });
  await info.attach(name, { path, contentType: "image/png" });
}

async function createWorkoutPreparation(page: Page, name: string) {
  await page.getByRole("button", { name: "Ouvrir Mes séances" }).click();
  await page.getByRole("button", { name: "Créer une séance" }).click();
  const workoutForm = page.getByRole("dialog", { name: "Séance" });
  await workoutForm.getByRole("textbox", { name: "Nom" }).fill(name);
  await workoutForm.getByRole("button", { name: "Enregistrer" }).click();
  await expect(workoutForm).toHaveCount(0);
  await page.locator(".workout-card").click();
  await expect(page.locator(".workout-preparation, .empty")).toBeVisible();
}

async function addExercise(page: Page, name: string) {
  await page.getByRole("button", { name: "Gérer les exercices" }).click();
  await page
    .getByRole("dialog", { name: "Actions de la séance" })
    .getByRole("button", { name: "Ajouter un exercice", exact: true })
    .click();
  const form = page.getByRole("dialog", { name: "Exercice" });
  await form.getByRole("textbox", { name: "Nom" }).fill(name);
  await form.getByRole("button", { name: "Enregistrer" }).click();
  await expect(form).toHaveCount(0);
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

async function readSheetGeometry(page: Page) {
  return page.locator(".sheet-backdrop").evaluate((backdrop) => {
    const sheet = backdrop.querySelector<HTMLElement>(".bottom-sheet")!;
    const scroll = sheet.querySelector<HTMLElement>(".sheet-scroll")!;
    const backdropBounds = backdrop.getBoundingClientRect();
    const sheetBounds = sheet.getBoundingClientRect();
    const scrollBounds = scroll.getBoundingClientRect();
    const visualViewport = window.visualViewport;
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById("root")!;
    const appShell = document.querySelector<HTMLElement>(".app-shell")!;
    const visibleBottom =
      backdrop.dataset.keyboardOpen === "true"
        ? (visualViewport?.offsetTop ?? 0) +
          (visualViewport?.height ?? window.innerHeight)
        : window.innerHeight;
    const pointY = Math.max(0, Math.min(window.innerHeight, visibleBottom) - 1);
    const hit = document.elementFromPoint(window.innerWidth / 2, pointY);
    const hitSheet = hit?.closest<HTMLElement>(".bottom-sheet");
    const hitBackdrop = hit?.closest<HTMLElement>(".sheet-backdrop");
    const styleSummary = (element: Element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        tag: element.tagName.toLowerCase(),
        id: (element as HTMLElement).id,
        className: (element as HTMLElement).className,
        rect: { top: rect.top, bottom: rect.bottom, height: rect.height },
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        position: style.position,
        zIndex: style.zIndex,
      };
    };
    const probe = document.createElement("div");
    probe.style.paddingBottom = "env(safe-area-inset-bottom, 0px)";
    document.body.append(probe);
    const safeAreaInsetBottom = Number.parseFloat(
      getComputedStyle(probe).paddingBottom,
    );
    probe.remove();
    return {
      backdropTop: backdropBounds.top,
      backdropBottom: backdropBounds.bottom,
      sheetBottom: sheetBounds.bottom,
      scrollTop: scrollBounds.top,
      scrollBottom: scrollBounds.bottom,
      scrollPaddingBottom: Number.parseFloat(
        getComputedStyle(scroll).paddingBottom,
      ),
      safeAreaInsetBottom,
      layoutHeight: window.innerHeight,
      visualTop: visualViewport?.offsetTop ?? 0,
      visualHeight: visualViewport?.height ?? window.innerHeight,
      visualBottom:
        (visualViewport?.offsetTop ?? 0) +
        (visualViewport?.height ?? window.innerHeight),
      keyboardOpen: backdrop.dataset.keyboardOpen === "true",
      layers: {
        html: styleSummary(html),
        body: styleSummary(body),
        root: styleSummary(root),
        appShell: styleSummary(appShell),
        backdrop: styleSummary(backdrop),
        sheet: styleSummary(sheet),
        scroll: styleSummary(scroll),
      },
      bottomPaint: {
        hit: hit ? styleSummary(hit) : null,
        sheet: hitSheet ? styleSummary(hitSheet) : null,
        backdrop: hitBackdrop ? styleSummary(hitBackdrop) : null,
        parent: backdrop.parentElement
          ? styleSummary(backdrop.parentElement)
          : null,
      },
    };
  });
}

async function expectSheetAtViewportBottom(page: Page, keyboardOpen = false) {
  const geometry = await readSheetGeometry(page);
  const expectedBottom = keyboardOpen
    ? geometry.visualTop + geometry.visualHeight
    : geometry.layoutHeight;
  expect(geometry.keyboardOpen).toBe(keyboardOpen);
  expect(geometry.backdropBottom).toBeCloseTo(expectedBottom, 0);
  expect(geometry.sheetBottom).toBeCloseTo(expectedBottom, 0);
  if (keyboardOpen) {
    expect(geometry.backdropTop).toBeCloseTo(geometry.visualTop, 0);
    expect(geometry.scrollPaddingBottom).toBe(14);
  } else {
    expect(geometry.backdropTop).toBeCloseTo(0, 0);
    expect(geometry.scrollPaddingBottom).toBeCloseTo(
      22 + geometry.safeAreaInsetBottom,
      0,
    );
    expect(geometry.scrollPaddingBottom).toBeGreaterThanOrEqual(22);
    expect(geometry.visualTop + geometry.visualHeight).toBeLessThan(
      geometry.layoutHeight,
    );
  }
  expect(geometry.scrollBottom).toBeLessThanOrEqual(geometry.sheetBottom);
  // Report the actual DOM painter at the lower edge of the layout viewport;
  // this does not claim to cover standalone iOS pixels outside that viewport.
  expect(geometry.bottomPaint.backdrop).not.toBeNull();
  expect(geometry.bottomPaint.sheet).not.toBeNull();
  expect(geometry.bottomPaint.sheet?.rect.bottom).toBeCloseTo(
    expectedBottom,
    0,
  );
  expect(geometry.bottomPaint.sheet?.backgroundColor).toBe(
    geometry.layers.sheet.backgroundColor,
  );
  expect(geometry.layers.backdrop.rect.bottom).toBeCloseTo(expectedBottom, 0);
  expect(geometry.layers.body.backgroundColor).toBeTruthy();
  expect(geometry.layers.root.backgroundColor).toBeTruthy();
  expect(geometry.layers.html.backgroundColor).toBeTruthy();
  return geometry;
}

async function expectNavigationHiddenDuringModal(page: Page) {
  const navigation = page.locator(".bottom-navigation");
  const surface = page.locator(".bottom-navigation-surface");
  await expect(navigation).toBeHidden();
  await expect(surface).toBeHidden();
  const styles = await navigation.evaluate((element) => {
    const hostStyle = getComputedStyle(element);
    const surfaceStyle = getComputedStyle(
      element.querySelector<HTMLElement>(".bottom-navigation-surface")!,
    );
    const lensStyle = getComputedStyle(
      element.querySelector<HTMLElement>(".bottom-navigation-lens")!,
    );
    return {
      hostVisibility: hostStyle.visibility,
      hostPointerEvents: hostStyle.pointerEvents,
      hostBackground: hostStyle.backgroundColor,
      hostBackdropFilter: hostStyle.backdropFilter,
      surfaceVisibility: surfaceStyle.visibility,
      surfaceBackground: surfaceStyle.backgroundColor,
      surfaceBoxShadow: surfaceStyle.boxShadow,
      surfaceBackdropFilter: surfaceStyle.backdropFilter,
      surfaceWebkitBackdropFilter: surfaceStyle.getPropertyValue(
        "-webkit-backdrop-filter",
      ),
      supportsWebkitBackdrop: CSS.supports(
        "-webkit-backdrop-filter",
        "blur(1px)",
      ),
      lensBorderColor: lensStyle.borderColor,
      lensBoxShadow: lensStyle.boxShadow,
    };
  });
  expect(styles.hostVisibility).toBe("hidden");
  expect(styles.hostPointerEvents).toBe("none");
  expect(styles.hostBackground).toMatch(/,\s*0\)$/);
  expect(styles.hostBackdropFilter).toBe("none");
  expect(styles.surfaceVisibility).toBe("hidden");
  expect(styles.surfaceBackground).toMatch(/,\s*0\)$/);
  expect(styles.surfaceBoxShadow).toBe("none");
  expect(styles.surfaceBackdropFilter).toBe("none");
  if (styles.supportsWebkitBackdrop)
    expect(styles.surfaceWebkitBackdropFilter).toBe("none");
  expect(styles.lensBorderColor).toMatch(/,\s*0\)$/);
  expect(styles.lensBoxShadow).toBe("none");
}

async function readNavigationAnchor(page: Page) {
  return page.locator(".bottom-navigation-surface").evaluate((surface) => {
    const rect = surface.getBoundingClientRect();
    const viewportBottom =
      (window.visualViewport?.offsetTop ?? 0) +
      (window.visualViewport?.height ?? window.innerHeight);
    return {
      top: rect.top,
      bottomGap: viewportBottom - rect.bottom,
      viewportBottom,
      viewportHeight: window.innerHeight,
    };
  });
}

for (const width of [390, 320]) {
  test(`floating navigation geometry, scroll minimize and sheet anchor at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);

    const navigation = page.getByRole("navigation", {
      name: "Navigation principale",
    });
    const surface = page.locator(".bottom-navigation-surface");
    const workouts = page.getByRole("button", { name: "Musculation" });
    const nutrition = page.getByRole("button", { name: "Nutrition" });
    await expect(navigation).toHaveAttribute("data-state", "expanded");
    await expect(workouts).toHaveAttribute("aria-current", "page");
    await expect(workouts.locator(".bottom-navigation-label")).toBeVisible();
    await expect(nutrition).toHaveAttribute("aria-disabled", "true");
    await nutrition.evaluate((element) =>
      (element as HTMLButtonElement).click(),
    );
    await expect(workouts).toHaveAttribute("aria-current", "page");
    await expect(nutrition).not.toHaveAttribute("aria-current");

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
    const geometry = await page.evaluate(() => {
      const navigation =
        document.querySelector<HTMLElement>(".bottom-navigation")!;
      const surface = navigation.querySelector<HTMLElement>(
        ".bottom-navigation-surface",
      )!;
      const button = navigation.querySelector<HTMLButtonElement>("button")!;
      const icon = button.querySelector("svg")!;
      const host = navigation.getBoundingClientRect();
      const capsule = surface.getBoundingClientRect();
      const target = button.getBoundingClientRect();
      const iconBounds = icon.getBoundingClientRect();
      const style = getComputedStyle(navigation);
      const surfaceStyle = getComputedStyle(surface);
      const lensStyle = getComputedStyle(
        surface.querySelector<HTMLElement>(".bottom-navigation-lens")!,
      );
      const rootStyles = getComputedStyle(document.documentElement);
      const viewportBottom =
        (window.visualViewport?.offsetTop ?? 0) +
        (window.visualViewport?.height ?? window.innerHeight);
      const background = surfaceStyle.backgroundColor;
      const alphaMatch = background.match(
        /rgba\([^,]+,\s*[^,]+,\s*[^,]+,\s*([^)]+)\)/,
      );
      return {
        hostBottom: host.bottom,
        hostHeight: host.height,
        hostPaddingBottom: Number.parseFloat(style.paddingBottom),
        hostBackground: style.backgroundColor,
        hostBackgroundImage: style.backgroundImage,
        hostBoxShadow: style.boxShadow,
        hostBackdropFilter: style.backdropFilter,
        buttonHeight: target.height,
        buttonBottomGap: viewportBottom - target.bottom,
        iconBottomGap: viewportBottom - iconBounds.bottom,
        capsule: {
          left: capsule.left,
          right: capsule.right,
          top: capsule.top,
          bottom: capsule.bottom,
          bottomGap: viewportBottom - capsule.bottom,
          width: capsule.width,
          center: capsule.left + capsule.width / 2,
          height: capsule.height,
          radius: surfaceStyle.borderRadius,
          background,
          alpha: alphaMatch ? Number.parseFloat(alphaMatch[1]) : 1,
          backdropFilter: surfaceStyle.backdropFilter,
          webkitBackdropFilter: surfaceStyle.webkitBackdropFilter,
          lensBackgroundImage: lensStyle.backgroundImage,
          touchAction: surfaceStyle.touchAction,
        },
        viewportBottom,
        floatingLift: Number.parseFloat(surfaceStyle.bottom),
        scrollReserve: Number.parseFloat(
          getComputedStyle(document.querySelector<HTMLElement>(".app-shell")!)
            .paddingBottom,
        ),
        visualOffset: Number.parseFloat(
          rootStyles.getPropertyValue("--bottom-nav-visual-offset"),
        ),
        supportsBackdrop: CSS.supports("backdrop-filter", "blur(1px)"),
        supportsWebkitBackdrop: CSS.supports(
          "-webkit-backdrop-filter",
          "blur(1px)",
        ),
      };
    });
    expect(
      geometry.hostBottom - geometry.viewportBottom,
    ).toBeGreaterThanOrEqual(0);
    expect(geometry.hostBottom - geometry.viewportBottom).toBeLessThanOrEqual(
      16,
    );
    expect(geometry.hostHeight).toBeLessThan(geometry.viewportBottom * 0.08);
    expect(geometry.buttonHeight).toBeGreaterThanOrEqual(44);
    expect(geometry.visualOffset).toBe(14);
    expect(geometry.floatingLift).toBeGreaterThan(0);
    expect(geometry.capsule.bottomGap).toBeCloseTo(simulatedSafeInset + 10, 0);
    expect(geometry.buttonBottomGap).toBeCloseTo(geometry.capsule.bottomGap, 0);
    expect(geometry.iconBottomGap).toBeGreaterThan(
      geometry.buttonBottomGap + 8,
    );
    expect(geometry.capsule.height).toBeGreaterThanOrEqual(44);
    expect(geometry.capsule.width).toBeLessThan(width - 24);
    expect(geometry.capsule.left).toBeGreaterThanOrEqual(12);
    expect(geometry.capsule.right).toBeLessThanOrEqual(width - 12);
    expect(geometry.capsule.center).toBeCloseTo(width / 2, 0);
    expect(geometry.capsule.radius).toBe("999px");
    const supportsGlass =
      geometry.supportsBackdrop || geometry.supportsWebkitBackdrop;
    if (supportsGlass) {
      expect(geometry.capsule.alpha).toBeGreaterThanOrEqual(0.24);
      expect(geometry.capsule.alpha).toBeLessThanOrEqual(0.28);
    } else {
      expect(geometry.capsule.alpha).toBeCloseTo(0.96, 2);
    }
    expect(geometry.capsule.touchAction).toBe("none");
    expect(geometry.hostBackground).toMatch(/rgba?\(/);
    expect(geometry.hostBackground).toMatch(/,\s*0\)$/);
    expect(geometry.hostBackgroundImage).toBe("none");
    expect(geometry.hostBoxShadow).toBe("none");
    expect(geometry.hostBackdropFilter).toBe("none");
    if (geometry.supportsBackdrop) {
      expect(geometry.capsule.backdropFilter).toContain("blur(12px)");
      expect(geometry.capsule.backdropFilter).toContain("saturate(2)");
    }
    if (geometry.supportsWebkitBackdrop) {
      expect(geometry.capsule.webkitBackdropFilter).toContain("blur(12px)");
      expect(geometry.capsule.webkitBackdropFilter).toContain("saturate(2)");
    }
    if (!geometry.supportsBackdrop && !geometry.supportsWebkitBackdrop)
      expect(geometry.capsule.alpha).toBeCloseTo(0.96, 2);
    expect(geometry.capsule.lensBackgroundImage).toContain("rgba(23, 23, 27");
    expect(geometry.capsule.lensBackgroundImage).toMatch(
      /rgba\(23, 23, 27, 0\.17\)/,
    );

    await page.evaluate(() =>
      document.documentElement.style.setProperty(
        "--bottom-navigation-safe-inset",
        "0px",
      ),
    );
    const noSafeAreaGap = await page.evaluate(() => {
      const capsule = document
        .querySelector<HTMLElement>(".bottom-navigation-surface")!
        .getBoundingClientRect();
      const viewportBottom =
        (window.visualViewport?.offsetTop ?? 0) +
        (window.visualViewport?.height ?? window.innerHeight);
      return viewportBottom - capsule.bottom;
    });
    expect(noSafeAreaGap).toBeCloseTo(10, 0);
    await page.evaluate(
      (inset) =>
        document.documentElement.style.setProperty(
          "--bottom-navigation-safe-inset",
          String(inset) + "px",
        ),
      simulatedSafeInset,
    );

    await capture(page, info, "dashboard-expanded-" + width);
    await page.evaluate(() => {
      document.documentElement.style.minHeight = "1800px";
      const shell = document.querySelector<HTMLElement>(".app-shell")!;
      const card = document.createElement("article");
      card.id = "tabbar-underlay-fixture";
      card.style.cssText =
        "display:grid;place-items:center;width:100%;height:240px;margin:700px 0 24px;border-radius:18px;background:#202027;color:#f7f7f4;font:600 18px system-ui;text-align:center";
      card.textContent = "CARTE SOMBRE · TEXTE DERRIÈRE LA CAPSULE";
      shell.append(card);
      const surface = document.querySelector<HTMLElement>(
        ".bottom-navigation-surface",
      )!;
      const surfaceBounds = surface.getBoundingClientRect();
      const cardTop = card.getBoundingClientRect().top + window.scrollY;
      const targetScroll =
        cardTop +
        card.offsetHeight / 2 -
        (surfaceBounds.top + surfaceBounds.height / 2);
      window.scrollTo({ top: targetScroll, behavior: "instant" });
    });
    const darkUnderlay = await page.evaluate(() => {
      const card = document
        .getElementById("tabbar-underlay-fixture")!
        .getBoundingClientRect();
      const surface = document
        .querySelector<HTMLElement>(".bottom-navigation-surface")!
        .getBoundingClientRect();
      return {
        scrollY: window.scrollY,
        cardTop: card.top,
        cardBottom: card.bottom,
        surfaceTop: surface.top,
        surfaceBottom: surface.bottom,
      };
    });
    expect(darkUnderlay.scrollY).toBeGreaterThan(0);
    expect(darkUnderlay.cardTop).toBeLessThan(darkUnderlay.surfaceBottom);
    expect(darkUnderlay.cardBottom).toBeGreaterThan(darkUnderlay.surfaceTop);
    await capture(page, info, "dashboard-dark-content-underlay-" + width);
    await page.locator("#tabbar-underlay-fixture").evaluate((element) => {
      (element as HTMLElement).style.background = "#ff5a1f";
      element.textContent = "ORANGE · TEXTE DERRIÈRE LA CAPSULE";
    });
    await capture(page, info, "navigation-orange-content-underlay-" + width);
    await page.locator("#tabbar-underlay-fixture").evaluate((element) => {
      (element as HTMLElement).style.background = "#178644";
      element.textContent = "VERT · TEXTE DERRIÈRE LA CAPSULE";
    });
    await capture(page, info, "navigation-green-content-underlay-" + width);
    await page.evaluate(() => {
      document.getElementById("tabbar-underlay-fixture")?.remove();
      document.documentElement.style.minHeight = "1400px";
      window.scrollTo({ top: 0, behavior: "instant" });
      document.dispatchEvent(new Event("scroll"));
    });
    await page.evaluate(() =>
      window.scrollTo({ top: 96, behavior: "instant" }),
    );
    await expect(navigation).toHaveAttribute("data-state", "minimized");
    await expect(workouts).toBeVisible();
    await expect(workouts.locator(".bottom-navigation-label")).toHaveCSS(
      "position",
      "absolute",
    );
    await expect(workouts.locator(".bottom-navigation-label")).toHaveCSS(
      "width",
      "1px",
    );
    await capture(page, info, `dashboard-minimized-${width}`);
    await page.evaluate(() =>
      window.scrollTo({ top: 54, behavior: "instant" }),
    );
    await expect(navigation).toHaveAttribute("data-state", "expanded");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect(navigation).toHaveAttribute("data-state", "expanded");
    const expandedWidth = Math.min(320, width - 32);
    await expect
      .poll(async () => (await surface.boundingBox())!.width)
      .toBeCloseTo(expandedWidth, 0);

    await page.getByRole("button", { name: "Ouvrir Mes séances" }).click();
    await page.getByRole("button", { name: "Créer une séance" }).click();
    const sheet = page.getByRole("dialog", { name: "Séance" });
    const navigationHost = page.locator(".bottom-navigation");
    await expect(navigationHost).toHaveAttribute("data-modal-open", "true");
    const stateWhenSheetOpens = await navigationHost.getAttribute("data-state");
    const expectedWidth =
      stateWhenSheetOpens === "minimized" ? 120 : expandedWidth;
    await expect
      .poll(async () => (await surface.boundingBox())!.width)
      .toBeCloseTo(expectedWidth, 0);
    const beforeSheet = await surface.boundingBox();
    expect(
      await navigationHost.evaluate((element) =>
        Number(getComputedStyle(element).zIndex),
      ),
    ).toBeLessThan(
      Number(
        await page
          .locator(".sheet-backdrop")
          .evaluate((element) => getComputedStyle(element).zIndex),
      ),
    );
    await expect(navigationHost).toHaveAttribute(
      "data-state",
      stateWhenSheetOpens!,
    );
    const duringSheet = await surface.boundingBox();
    expect(duringSheet!.x).toBeCloseTo(beforeSheet!.x, 0);
    expect(duringSheet!.y).toBeCloseTo(beforeSheet!.y, 0);
    await sheet.getByRole("textbox", { name: "Nom" }).fill(`Sheet ${width}`);
    await sheet.getByRole("button", { name: "Enregistrer" }).click();
    await expect(sheet).toHaveCount(0);
    await expect(navigationHost).not.toHaveAttribute("data-modal-open");
    await expect(navigationHost).toHaveAttribute(
      "data-state",
      stateWhenSheetOpens!,
    );
    const afterSheet = await surface.boundingBox();
    expect(afterSheet!.x).toBeCloseTo(beforeSheet!.x, 0);
    expect(afterSheet!.y).toBeCloseTo(beforeSheet!.y, 0);
  });

  test(`floating navigation pointer scrub and minimized tap at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    const navigation = page.getByRole("navigation", {
      name: "Navigation principale",
    });
    const surface = page.locator(".bottom-navigation-surface");
    const workouts = page.getByRole("button", { name: "Musculation" });
    const nutrition = page.getByRole("button", { name: "Nutrition" });
    const workoutsBox = await workouts.boundingBox();
    const nutritionBox = await nutrition.boundingBox();
    expect(workoutsBox).not.toBeNull();
    expect(nutritionBox).not.toBeNull();

    const muscleX = workoutsBox!.x + workoutsBox!.width / 2;
    const tabY = workoutsBox!.y + workoutsBox!.height / 2;
    await page.mouse.move(muscleX, tabY);
    await page.mouse.down();
    await page.mouse.move(nutritionBox!.x + nutritionBox!.width / 2, tabY, {
      steps: 5,
    });
    await expect(surface).toHaveAttribute("data-scrub-tab", "nutrition");
    await page.mouse.up();
    await expect(surface).not.toHaveClass(/is-interacting/);
    await expect(workouts).toHaveAttribute("aria-current", "page");
    await expect(nutrition).not.toHaveAttribute("aria-current");
    await expect(surface).toHaveAttribute("data-active-tab", "workouts");

    const updatedWorkoutsBox = await workouts.boundingBox();
    const positionBeforeVerticalScrub = await surface.boundingBox();
    const scrollBeforeVerticalScrub = await page.evaluate(() => window.scrollY);
    await page.mouse.move(
      updatedWorkoutsBox!.x + updatedWorkoutsBox!.width / 2,
      updatedWorkoutsBox!.y + updatedWorkoutsBox!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(width - 4, Math.max(120, tabY - 520), { steps: 8 });
    await expect(surface).toHaveClass(/is-interacting/);
    await expect(surface).toHaveAttribute("data-lens-dragging", "true");
    await expect(surface).toHaveAttribute("data-scrub-tab", "nutrition");
    const clampedLens = await surface.evaluate((element) =>
      Number.parseFloat(
        (element as HTMLElement).style.getPropertyValue(
          "--bottom-navigation-lens-x",
        ),
      ),
    );
    const lensWidth = await surface.evaluate(
      (element) => ((element as HTMLElement).offsetWidth - 8) / 2,
    );
    expect(clampedLens).toBeCloseTo(lensWidth, 0);
    expect(await page.evaluate(() => window.scrollY)).toBe(
      scrollBeforeVerticalScrub,
    );
    await page.mouse.up();
    await expect(surface).not.toHaveClass(/is-interacting/);
    await expect(workouts).toHaveAttribute("aria-current", "page");
    await expect(surface).toHaveAttribute("data-active-tab", "workouts");
    const positionAfterVerticalScrub = await surface.boundingBox();
    expect(positionAfterVerticalScrub!.y).toBeCloseTo(
      positionBeforeVerticalScrub!.y,
      0,
    );

    await page.evaluate(() => {
      document.documentElement.style.minHeight = "1400px";
      document.scrollingElement!.scrollTop = 96;
      document.dispatchEvent(new Event("scroll"));
    });
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(18);
    await expect(navigation).toHaveAttribute("data-state", "minimized");
    await page.evaluate(() => {
      document.scrollingElement!.scrollTop = 36;
      document.dispatchEvent(new Event("scroll"));
    });
    await expect(navigation).toHaveAttribute("data-state", "expanded");
    await page.evaluate(() => {
      document.scrollingElement!.scrollTop = 0;
      document.dispatchEvent(new Event("scroll"));
    });
    await page.evaluate(() => {
      document.scrollingElement!.scrollTop = 60;
      document.dispatchEvent(new Event("scroll"));
    });
    await expect(navigation).toHaveAttribute("data-state", "minimized");
    await expect
      .poll(async () => (await surface.boundingBox())!.width)
      .toBeLessThan(160);
    const compactWidth = (await surface.boundingBox())!.width;
    await expect(nutrition).toHaveAttribute("aria-disabled", "true");
    const compactNutritionBox = await nutrition.boundingBox();
    await page.mouse.move(
      compactNutritionBox!.x + compactNutritionBox!.width / 2,
      compactNutritionBox!.y + compactNutritionBox!.height / 2,
    );
    await page.mouse.down();
    await expect(navigation).toHaveAttribute("data-state", "expanded");
    await expect(surface).toHaveClass(/is-interacting/);
    await page.mouse.up();
    await expect(workouts).toHaveAttribute("aria-current", "page");
    await expect
      .poll(async () => (await surface.boundingBox())!.width)
      .toBeGreaterThan(compactWidth);
  });

  test(`workout detail listens only to planned-set vertical scroll at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await createWorkoutPreparation(page, `Navigation ${width}`);
    const names = [
      "Développé couché",
      "Rowing barre",
      "Presse à cuisses",
      "Soulevé de terre",
      "Développé épaules",
    ];
    for (const name of names) await addExercise(page, name);
    const addSetButton = page.getByRole("button", {
      name: "+ Ajouter une série",
    });
    for (let index = 0; index < 10; index++) await addSetButton.click();

    const navigation = page.getByRole("navigation", {
      name: "Navigation principale",
    });
    const header = page.locator(".workout-control");
    const headerHeight = await header.evaluate(
      (element) => element.getBoundingClientRect().height,
    );
    const headerTop = await header.evaluate(
      (element) => element.getBoundingClientRect().top,
    );
    const sets = page.locator(".planned-sets");
    await sets.evaluate((element) => {
      element.scrollTop = 0;
      element.dispatchEvent(new Event("scroll"));
    });
    await expect(navigation).toHaveAttribute("data-state", "expanded");
    await expect
      .poll(() =>
        sets.evaluate((element) => element.scrollHeight > element.clientHeight),
      )
      .toBe(true);
    await capture(page, info, `workout-expanded-${width}`);

    await sets.evaluate((element) => {
      element.scrollTop = 120;
      element.dispatchEvent(new Event("scroll"));
    });
    await expect(header).toHaveAttribute("data-scrolled", "true");
    expect(
      await header.evaluate(
        (element) => element.getBoundingClientRect().height,
      ),
    ).toBe(headerHeight);
    expect(
      await header.evaluate((element) => element.getBoundingClientRect().top),
    ).toBe(headerTop);
    await expect(navigation).toHaveAttribute("data-state", "minimized");
    await capture(page, info, `workout-minimized-${width}`);

    await sets.evaluate((element) => {
      element.scrollTop = 60;
      element.dispatchEvent(new Event("scroll"));
    });
    await expect(navigation).toHaveAttribute("data-state", "expanded");
    const exerciseNavigator = page.locator(".exercise-tabs");
    await exerciseNavigator.evaluate((element) => {
      element.scrollLeft = 24;
      element.dispatchEvent(new Event("scroll"));
    });
    await expect(navigation).toHaveAttribute("data-state", "expanded");

    await sets.evaluate((element) => {
      element.scrollTop = 120;
      element.dispatchEvent(new Event("scroll"));
    });
    await expect(navigation).toHaveAttribute("data-state", "minimized");
    await page
      .locator(".set-block")
      .first()
      .getByRole("button", { name: "Charge (kg)" })
      .evaluate((element) => (element as HTMLButtonElement).click());
    const picker = page.getByRole("dialog", { name: "Choisir Charge (kg)" });
    const navigationHost = page.locator(".bottom-navigation");
    const navigationSurface = page.locator(".bottom-navigation-surface");
    const anchorBeforePicker = await readNavigationAnchor(page);
    await expect(navigationHost).toHaveAttribute("data-modal-open", "true");
    await expect(navigationHost).toHaveAttribute("data-state", "minimized");
    await expectNavigationHiddenDuringModal(page);
    await picker
      .getByRole("listbox", { name: "Kilogrammes" })
      .evaluate((element) => {
        element.scrollTop = 40;
        element.dispatchEvent(new Event("scroll"));
      });
    await expect(navigationHost).toHaveAttribute("data-state", "minimized");
    await picker
      .getByRole("button", { name: "ENREGISTRER", exact: true })
      .click();
    await expect(picker).toHaveCount(0);
    await expect(navigation).toHaveAttribute("data-state", "minimized");
    await expect(navigationSurface).toBeVisible();
    const anchorAfterPicker = await readNavigationAnchor(page);
    expect(anchorAfterPicker.top).toBeCloseTo(anchorBeforePicker.top, 0);
    expect(anchorAfterPicker.bottomGap).toBeCloseTo(
      anchorBeforePicker.bottomGap,
      0,
    );
    expect(anchorAfterPicker.viewportBottom).toBeCloseTo(
      anchorBeforePicker.viewportBottom,
      0,
    );
    expect(anchorAfterPicker.viewportHeight).toBe(
      anchorBeforePicker.viewportHeight,
    );

    await sets.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      element.dispatchEvent(new Event("scroll"));
    });
    const finalAction = sets.getByRole("button", {
      name: "+ Ajouter une série",
    });
    await expect(finalAction).toBeVisible();
    const finalActionBounds = await finalAction.boundingBox();
    const capsuleBounds = await page
      .locator(".bottom-navigation-surface")
      .boundingBox();
    expect(
      finalActionBounds!.y + finalActionBounds!.height,
    ).toBeLessThanOrEqual(capsuleBounds!.y - 8);

    const notesTrigger = page
      .getByRole("button", { name: "Ajouter une note" })
      .first();
    const anchorBeforeNotes = await readNavigationAnchor(page);
    await notesTrigger.click();
    const notes = page.getByRole("dialog", { name: "Notes de l’exercice" });
    await expect(notes).toBeVisible();
    await expectNavigationHiddenDuringModal(page);
    await notes.getByRole("button", { name: "ENREGISTRER" }).click();
    await expect(notes).toHaveCount(0);
    await expect(navigationSurface).toBeVisible();
    const anchorAfterNotes = await readNavigationAnchor(page);
    expect(anchorAfterNotes.top).toBeCloseTo(anchorBeforeNotes.top, 0);
    expect(anchorAfterNotes.bottomGap).toBeCloseTo(
      anchorBeforeNotes.bottomGap,
      0,
    );
    expect(anchorAfterNotes.viewportBottom).toBeCloseTo(
      anchorBeforeNotes.viewportBottom,
      0,
    );
    expect(anchorAfterNotes.viewportHeight).toBe(
      anchorBeforeNotes.viewportHeight,
    );
  });
}

for (const width of [390, 320]) {
  test(
    "bottom sheets cover the layout viewport at " + width + "px",
    async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/");
      await createWorkoutPreparation(page, "Sheet viewport");

      const safeAreaVisualHeight = await page.evaluate(() => {
        const inset = Math.round(window.innerHeight * 0.04);
        return window.innerHeight - inset;
      });
      await setVisualViewport(page, safeAreaVisualHeight, 0);

      await page.getByRole("button", { name: "Gérer les exercices" }).click();
      const actions = page.getByRole("dialog", {
        name: "Actions de la séance",
      });
      await expect(actions).toBeVisible();
      await expectSheetAtViewportBottom(page);
      await actions
        .getByRole("button", { name: "Ajouter un exercice" })
        .click();

      const exerciseForm = page.getByRole("dialog", { name: "Exercice" });
      await expectSheetAtViewportBottom(page);
      await exerciseForm.getByRole("textbox", { name: "Nom" }).fill("Squat");
      await exerciseForm.getByRole("button", { name: "Enregistrer" }).click();
      await expect(exerciseForm).toHaveCount(0);

      for (const label of ["Charge (kg)", "Répétitions", "Repos"]) {
        await page
          .getByRole("button", { name: label, exact: true })
          .first()
          .click();
        const picker = page.getByRole("dialog", { name: "Choisir " + label });
        await expect(picker).toBeVisible();
        await expectSheetAtViewportBottom(page);
        await picker
          .getByRole("button", { name: "ENREGISTRER", exact: true })
          .click();
        await expect(picker).toHaveCount(0);
      }

      await page.getByRole("button", { name: "Ajouter une note" }).click();
      const notes = page.getByRole("dialog", { name: "Notes de l’exercice" });
      await expectSheetAtViewportBottom(page);
      const permanentNote = notes.getByRole("textbox", {
        name: "Note permanente",
      });
      await permanentNote.focus();
      const keyboardHeight = await page.evaluate(
        () => window.innerHeight - Math.round(window.innerHeight * 0.4),
      );
      await setVisualViewport(page, keyboardHeight, 0);
      await expectSheetAtViewportBottom(page, true);
      await expect(permanentNote).toBeFocused();
      await expect(permanentNote).toBeVisible();
      const fieldBounds = await permanentNote.boundingBox();
      const scrollBounds = await page.locator(".sheet-scroll").boundingBox();
      expect(fieldBounds!.y).toBeGreaterThanOrEqual(scrollBounds!.y);
      expect(fieldBounds!.y + fieldBounds!.height).toBeLessThanOrEqual(
        scrollBounds!.y + scrollBounds!.height,
      );

      await setVisualViewport(page, safeAreaVisualHeight, 0);
      await expectSheetAtViewportBottom(page);
      await notes.getByRole("button", { name: "ENREGISTRER" }).click();
      await expect(notes).toHaveCount(0);
    },
  );
}
