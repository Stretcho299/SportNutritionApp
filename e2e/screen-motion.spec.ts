import { expect, test, type Locator, type Page } from "@playwright/test";

type PersistedStore = {
  sessions: Array<{
    id: string;
    startedAt: number;
    status: string;
  }>;
};

type MotionEvent = {
  type: "animationstart" | "animationend";
  animationName: string;
  targetClassName: string;
};

type PageMotionProfile = {
  animationName: string;
  duration: string;
  easing: string;
  keyframes: Array<{ opacity: string; translateX: number }>;
  targetClassName: string;
  targetParentClassName: string;
};

async function chooseValue(page: Page, label: string, value: number) {
  await page.getByRole("button", { name: label, exact: true }).first().click();
  const picker = page.getByRole("dialog", { name: `Choisir ${label}` });
  const listbox = label === "Nombre de séries initiales" ? "Séries" : "Minutes";
  await picker
    .getByRole("listbox", { name: listbox })
    .getByRole("option", { name: String(value), exact: true })
    .click();
  await picker
    .getByRole("button", { name: "ENREGISTRER", exact: true })
    .click();
  await expect(picker).toHaveCount(0);
}

async function addExercise(page: Page, name: string) {
  await page.getByRole("button", { name: "Gérer les exercices" }).click();
  await page
    .getByRole("dialog", { name: "Actions de la séance" })
    .getByRole("button", { name: "Ajouter un exercice", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Nom" }).fill(name);
  await chooseValue(page, "Nombre de séries initiales", 1);
  const form = page.getByRole("dialog", { name: "Exercice" });
  await form.getByRole("button", { name: "Enregistrer" }).click();
  await expect(form).toHaveCount(0);
}

async function createWorkoutPreparation(
  page: Page,
  name: string,
  exercises = ["Exercice A"],
) {
  await page.goto("/");
  await page.getByRole("button", { name: "Ouvrir Mes séances" }).click();
  await page.getByRole("button", { name: "Créer une séance" }).click();
  const form = page.getByRole("dialog", { name: "Séance" });
  await form.getByRole("textbox", { name: "Nom" }).fill(name);
  await form.getByRole("button", { name: "Enregistrer" }).click();
  await expect(form).toHaveCount(0);
  await page.locator(".workout-card").click();
  await expect(page.locator(".workout-preparation, .empty")).toBeVisible();
  for (const exercise of exercises) await addExercise(page, exercise);
  await expect(page.locator(".workout-preparation")).toBeVisible();
}

async function readPersistedStore(page: Page): Promise<PersistedStore> {
  return page.evaluate(
    () =>
      new Promise<PersistedStore>((resolve, reject) => {
        const request = indexedDB.open("sport-nutrition", 2);
        request.onsuccess = () => {
          const get = request.result
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

async function expectPageMotion(
  page: Page,
  target: Locator,
  direction: "forward" | "back",
): Promise<PageMotionProfile> {
  await expect(target).toHaveClass(new RegExp(`page-${direction}`));
  await expect
    .poll(() =>
      target.evaluate((element) => getComputedStyle(element).animationName),
    )
    .toBe(`page-${direction}-in`);
  await expect
    .poll(() =>
      target.evaluate(
        (element, animationName) =>
          element
            .getAnimations()
            .some(
              (animation) =>
                (animation as CSSAnimation).animationName === animationName,
            ),
        `page-${direction}-in`,
      ),
    )
    .toBe(true);
  const profile = await target.evaluate((element, direction) => {
    const computed = getComputedStyle(element);
    const animationName = `page-${direction}-in`;
    const animation = element
      .getAnimations()
      .find((item) => (item as CSSAnimation).animationName === animationName);
    return {
      animationName: computed.animationName,
      duration: computed.animationDuration,
      easing: computed.animationTimingFunction,
      targetClassName: element.getAttribute("class") ?? "",
      targetParentClassName: element.parentElement?.getAttribute("class") ?? "",
      keyframes:
        animation?.effect?.getKeyframes().map((frame) => ({
          opacity: String(frame.opacity),
          translateX:
            frame.transform === "none"
              ? 0
              : new DOMMatrixReadOnly(frame.transform ?? "none").m41,
        })) ?? [],
    };
  }, direction);
  expect(profile).toMatchObject({
    animationName: `page-${direction}-in`,
    duration: "0.22s",
    easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
  });
  expect(profile.keyframes).toEqual([
    { opacity: "0.12", translateX: direction === "forward" ? 26 : -26 },
    { opacity: "1", translateX: 0 },
  ]);
  expect(profile.targetClassName.split(/\s+/)).toContain(`page-${direction}`);
  expect(profile.targetParentClassName.split(/\s+/)).toContain("app-shell");
  return profile;
}

function expectMirroredPageMotion(
  forward: PageMotionProfile,
  back: PageMotionProfile,
) {
  expect(forward.animationName).toBe("page-forward-in");
  expect(back.animationName).toBe("page-back-in");
  expect(forward.duration).toBe(back.duration);
  expect(forward.easing).toBe(back.easing);
  expect(forward.keyframes[0].opacity).toBe(back.keyframes[0].opacity);
  expect(forward.keyframes[0].translateX).toBe(-back.keyframes[0].translateX);
  expect(forward.keyframes[1]).toEqual(back.keyframes[1]);
}

async function recordMotionEvents(page: Page) {
  await page.addInitScript(() => {
    const motionWindow = window as typeof window & {
      __motionEvents?: MotionEvent[];
    };
    motionWindow.__motionEvents = [];
    for (const type of ["animationstart", "animationend"] as const) {
      document.addEventListener(
        type,
        (event) => {
          const target = event.target;
          if (!(target instanceof Element)) return;
          motionWindow.__motionEvents?.push({
            type,
            animationName: event.animationName,
            targetClassName: target.getAttribute("class") ?? "",
          });
        },
        true,
      );
    }
  });
}

async function motionEventCount(
  page: Page,
  type: MotionEvent["type"],
  className: string,
  animationName: string,
) {
  return page.evaluate(
    ({ type, className, animationName }) => {
      const motionWindow = window as typeof window & {
        __motionEvents?: MotionEvent[];
      };
      return (
        motionWindow.__motionEvents?.filter(
          (event) =>
            event.type === type &&
            event.animationName === animationName &&
            event.targetClassName.split(/\s+/).includes(className),
        ).length ?? 0
      );
    },
    { type, className, animationName },
  );
}

async function waitForMotionEnd(
  page: Page,
  className: string,
  animationName: string,
  previousCount: number,
) {
  await expect
    .poll(() =>
      motionEventCount(page, "animationend", className, animationName),
    )
    .toBeGreaterThan(previousCount);
  await expect
    .poll(() => page.locator(`.${className}`).first().getAttribute("class"))
    .not.toMatch(/page-(forward|back)/);
}

async function waitForMotionStart(
  page: Page,
  className: string,
  animationName: string,
  previousCount: number,
) {
  await expect
    .poll(() =>
      motionEventCount(page, "animationstart", className, animationName),
    )
    .toBeGreaterThan(previousCount);
}

async function expectNoHorizontalOverflow(page: Page) {
  const { documentWidth, viewportWidth } = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(
    documentWidth,
    `document width ${documentWidth}px exceeds viewport width ${viewportWidth}px`,
  ).toBeLessThanOrEqual(viewportWidth);
}

async function expectSameRect(
  before: { x: number; y: number; width: number; height: number } | null,
  after: { x: number; y: number; width: number; height: number } | null,
) {
  expect(before).not.toBeNull();
  expect(after).not.toBeNull();
  expect(Math.abs(before!.x - after!.x)).toBeLessThan(1);
  expect(Math.abs(before!.y - after!.y)).toBeLessThan(1);
  expect(Math.abs(before!.width - after!.width)).toBeLessThan(1);
  expect(Math.abs(before!.height - after!.height)).toBeLessThan(1);
}

for (const width of [320, 390]) {
  test(`screen routes keep direction and fixed chrome at ${width}px`, async ({
    page,
  }) => {
    await recordMotionEvents(page);
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    const dashboard = page.locator(".dashboard");
    await expect(dashboard).toBeVisible();
    expect(
      await dashboard.evaluate(
        (element) => getComputedStyle(element).animationName,
      ),
    ).toBe("none");
    await expectNoHorizontalOverflow(page);

    const bottomNavigation = page.locator(".bottom-navigation");
    const navBefore = await bottomNavigation.boundingBox();
    const forwardStartCount = await motionEventCount(
      page,
      "animationstart",
      "sessions-library",
      "page-forward-in",
    );
    const forwardCount = await motionEventCount(
      page,
      "animationend",
      "sessions-library",
      "page-forward-in",
    );
    await page.getByRole("button", { name: "Ouvrir Mes séances" }).click();
    const workouts = page.locator(".sessions-library");
    const workoutsForwardMotion = await expectPageMotion(
      page,
      workouts,
      "forward",
    );
    await expectNoHorizontalOverflow(page);
    await waitForMotionStart(
      page,
      "sessions-library",
      "page-forward-in",
      forwardStartCount,
    );
    await waitForMotionEnd(
      page,
      "sessions-library",
      "page-forward-in",
      forwardCount,
    );
    await expectSameRect(navBefore, await bottomNavigation.boundingBox());

    const backCount = await motionEventCount(
      page,
      "animationend",
      "dashboard",
      "page-back-in",
    );
    const backStartCount = await motionEventCount(
      page,
      "animationstart",
      "dashboard",
      "page-back-in",
    );
    await page.getByLabel("Retour aux séances").click();
    const dashboardBackMotion = await expectPageMotion(page, dashboard, "back");
    await expectNoHorizontalOverflow(page);
    await waitForMotionStart(page, "dashboard", "page-back-in", backStartCount);
    await waitForMotionEnd(page, "dashboard", "page-back-in", backCount);
    expectMirroredPageMotion(workoutsForwardMotion, dashboardBackMotion);
    await expectSameRect(navBefore, await bottomNavigation.boundingBox());

    const nextForwardCount = await motionEventCount(
      page,
      "animationend",
      "sessions-library",
      "page-forward-in",
    );
    const nextForwardStartCount = await motionEventCount(
      page,
      "animationstart",
      "sessions-library",
      "page-forward-in",
    );
    await page.getByRole("button", { name: "Ouvrir Mes séances" }).click();
    await expectPageMotion(page, workouts, "forward");
    await waitForMotionStart(
      page,
      "sessions-library",
      "page-forward-in",
      nextForwardStartCount,
    );
    await waitForMotionEnd(
      page,
      "sessions-library",
      "page-forward-in",
      nextForwardCount,
    );
    await page.getByRole("button", { name: "Créer une séance" }).click();
    const workoutForm = page.getByRole("dialog", { name: "Séance" });
    await workoutForm.getByRole("textbox", { name: "Nom" }).fill("Motion");
    await workoutForm.getByRole("button", { name: "Enregistrer" }).click();
    await expect(workoutForm).toHaveCount(0);
    const emptyForwardStartCount = await motionEventCount(
      page,
      "animationstart",
      "empty",
      "page-forward-in",
    );
    const emptyForwardEndCount = await motionEventCount(
      page,
      "animationend",
      "empty",
      "page-forward-in",
    );
    await page.locator(".workout-card").click();
    const emptyDetail = page.locator(".empty");
    const emptyForwardMotion = await expectPageMotion(
      page,
      emptyDetail,
      "forward",
    );
    await waitForMotionStart(
      page,
      "empty",
      "page-forward-in",
      emptyForwardStartCount,
    );
    await waitForMotionEnd(
      page,
      "empty",
      "page-forward-in",
      emptyForwardEndCount,
    );
    await addExercise(page, "Exercice A");
    const preparedDetail = page.locator(".workout-preparation");
    await expect(preparedDetail).not.toHaveClass(/page-(forward|back)/);
    expect(
      await preparedDetail.evaluate(
        (element) => getComputedStyle(element).animationName,
      ),
    ).toBe("none");

    const detailBackStartCount = await motionEventCount(
      page,
      "animationstart",
      "sessions-library",
      "page-back-in",
    );
    const detailBackEndCount = await motionEventCount(
      page,
      "animationend",
      "sessions-library",
      "page-back-in",
    );
    await page.getByLabel("Retour aux séances").click();
    const returnedWorkouts = page.locator(".sessions-library");
    const detailBackMotion = await expectPageMotion(
      page,
      returnedWorkouts,
      "back",
    );
    await waitForMotionStart(
      page,
      "sessions-library",
      "page-back-in",
      detailBackStartCount,
    );
    await waitForMotionEnd(
      page,
      "sessions-library",
      "page-back-in",
      detailBackEndCount,
    );

    const detailForwardStartCount = await motionEventCount(
      page,
      "animationstart",
      "workout-preparation",
      "page-forward-in",
    );
    const detailForwardEndCount = await motionEventCount(
      page,
      "animationend",
      "workout-preparation",
      "page-forward-in",
    );
    await page.locator(".workout-card").click();
    const directDetail = page.locator(".workout-preparation");
    const directDetailForwardMotion = await expectPageMotion(
      page,
      directDetail,
      "forward",
    );
    await waitForMotionStart(
      page,
      "workout-preparation",
      "page-forward-in",
      detailForwardStartCount,
    );
    await waitForMotionEnd(
      page,
      "workout-preparation",
      "page-forward-in",
      detailForwardEndCount,
    );
    expectMirroredPageMotion(directDetailForwardMotion, detailBackMotion);
    expectMirroredPageMotion(emptyForwardMotion, detailBackMotion);

    await page.getByRole("button", { name: "Démarrer la séance" }).click();
    await page
      .getByRole("region", { name: "Séries de Exercice A" })
      .getByRole("button", { name: "Lancer le repos" })
      .click();
    await page.getByRole("button", { name: "Terminer la séance" }).click();
    await page
      .getByRole("alertdialog", { name: "Terminer la séance ?" })
      .getByRole("button", { name: "Terminer" })
      .click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);

    const previewBackCount = await motionEventCount(
      page,
      "animationend",
      "workout-preview",
      "page-back-in",
    );
    const previewBackStartCount = await motionEventCount(
      page,
      "animationstart",
      "workout-preview",
      "page-back-in",
    );
    await page.getByLabel("Retour aux séances").click();
    const preview = page.locator(".workout-preview");
    await expect(preview).toBeVisible();
    const detailToPreviewBackMotion = await expectPageMotion(
      page,
      preview,
      "back",
    );
    await expectNoHorizontalOverflow(page);
    await waitForMotionStart(
      page,
      "workout-preview",
      "page-back-in",
      previewBackStartCount,
    );
    await waitForMotionEnd(
      page,
      "workout-preview",
      "page-back-in",
      previewBackCount,
    );
    const previewToSessionsBackCount = await motionEventCount(
      page,
      "animationend",
      "sessions-library",
      "page-back-in",
    );
    const previewToSessionsBackStartCount = await motionEventCount(
      page,
      "animationstart",
      "sessions-library",
      "page-back-in",
    );
    await page.getByLabel("Retour aux séances").click();
    const previewToSessionsBackMotion = await expectPageMotion(
      page,
      workouts,
      "back",
    );
    await waitForMotionStart(
      page,
      "sessions-library",
      "page-back-in",
      previewToSessionsBackStartCount,
    );
    await waitForMotionEnd(
      page,
      "sessions-library",
      "page-back-in",
      previewToSessionsBackCount,
    );
    const sessionsToPreviewForwardCount = await motionEventCount(
      page,
      "animationend",
      "workout-preview",
      "page-forward-in",
    );
    const sessionsToPreviewForwardStartCount = await motionEventCount(
      page,
      "animationstart",
      "workout-preview",
      "page-forward-in",
    );
    await page.locator(".workout-card").click();
    const completedPreview = page.locator(".workout-preview");
    const sessionsToPreviewForwardMotion = await expectPageMotion(
      page,
      completedPreview,
      "forward",
    );
    await expectNoHorizontalOverflow(page);
    await waitForMotionStart(
      page,
      "workout-preview",
      "page-forward-in",
      sessionsToPreviewForwardStartCount,
    );
    await waitForMotionEnd(
      page,
      "workout-preview",
      "page-forward-in",
      sessionsToPreviewForwardCount,
    );
    expectMirroredPageMotion(
      sessionsToPreviewForwardMotion,
      previewToSessionsBackMotion,
    );
    const prepareDetailForwardEndCount = await motionEventCount(
      page,
      "animationend",
      "workout-preparation",
      "page-forward-in",
    );
    const prepareDetailForwardStartCount = await motionEventCount(
      page,
      "animationstart",
      "workout-preparation",
      "page-forward-in",
    );
    await page.getByRole("button", { name: "PRÉPARER LA SÉANCE" }).click();
    const detail = page.locator(".workout-preparation");
    const previewToDetailForwardMotion = await expectPageMotion(
      page,
      detail,
      "forward",
    );
    expectMirroredPageMotion(
      previewToDetailForwardMotion,
      detailToPreviewBackMotion,
    );
    await expectNoHorizontalOverflow(page);
    const header = page.locator(".workout-control");
    expect(
      await header.evaluate(
        (element) => getComputedStyle(element).animationName,
      ),
    ).toBe("none");
    await waitForMotionStart(
      page,
      "workout-preparation",
      "page-forward-in",
      prepareDetailForwardStartCount,
    );
    await waitForMotionEnd(
      page,
      "workout-preparation",
      "page-forward-in",
      prepareDetailForwardEndCount,
    );
    await expectSameRect(navBefore, await bottomNavigation.boundingBox());
  });

  test(`capsule resumes the same session without replaying page motion at ${width}px`, async ({
    page,
  }) => {
    await recordMotionEvents(page);
    await page.setViewportSize({ width, height: 844 });
    await createWorkoutPreparation(page, "Capsule", [
      "Exercice A",
      "Exercice B",
    ]);
    await page.getByRole("button", { name: "Démarrer la séance" }).click();
    const before = (await readPersistedStore(page)).sessions[0];
    expect(before.status).toBe("inProgress");

    const dashboardBackCount = await motionEventCount(
      page,
      "animationend",
      "dashboard",
      "page-back-in",
    );
    await page.getByLabel("Retour aux séances").click();
    const dashboard = page.locator(".dashboard");
    await expectPageMotion(page, dashboard, "back");
    await waitForMotionEnd(
      page,
      "dashboard",
      "page-back-in",
      dashboardBackCount,
    );
    const bottomNavigation = page.locator(".bottom-navigation");
    const navBefore = await bottomNavigation.boundingBox();
    const capsule = page.getByRole("button", {
      name: "Reprendre la séance Capsule",
    });
    await expect(capsule).toBeVisible();
    const detailStartCount = await motionEventCount(
      page,
      "animationstart",
      "workout-preparation",
      "page-forward-in",
    );
    const detailEndCount = await motionEventCount(
      page,
      "animationend",
      "workout-preparation",
      "page-forward-in",
    );
    await capsule.click();

    const detail = page.locator(".workout-preparation");
    await expectPageMotion(page, detail, "forward");
    await expectNoHorizontalOverflow(page);
    await waitForMotionEnd(
      page,
      "workout-preparation",
      "page-forward-in",
      detailEndCount,
    );
    expect(
      await motionEventCount(
        page,
        "animationstart",
        "workout-preparation",
        "page-forward-in",
      ),
    ).toBe(detailStartCount + 1);
    await detail.evaluate((element) => {
      const motionWindow = window as typeof window & {
        __animatedDetail?: Element | null;
      };
      motionWindow.__animatedDetail = element;
    });
    const header = page.locator(".workout-control");
    const headerBefore = await header.boundingBox();
    const detailBefore = await detail.boundingBox();
    const timer = page.getByRole("timer", { name: "Durée de la séance" });
    const timerBefore = await timer.textContent();
    await expect
      .poll(async () => (await timer.textContent())?.trim())
      .not.toBe(timerBefore?.trim());

    expect(
      await motionEventCount(
        page,
        "animationstart",
        "workout-preparation",
        "page-forward-in",
      ),
    ).toBe(detailStartCount + 1);
    expect(
      await detail.evaluate((element) => {
        const motionWindow = window as typeof window & {
          __animatedDetail?: Element | null;
        };
        return motionWindow.__animatedDetail === element;
      }),
    ).toBe(true);
    await expectSameRect(detailBefore, await detail.boundingBox());
    await expectSameRect(headerBefore, await header.boundingBox());
    await expectSameRect(navBefore, await bottomNavigation.boundingBox());
    await expectNoHorizontalOverflow(page);
    expect(
      await header.evaluate(
        (element) => getComputedStyle(element).animationName,
      ),
    ).toBe("none");

    const exercises = page.getByRole("list", { name: "Exercices" });
    await exercises.getByRole("button", { name: /Exercice B/ }).click();
    const currentIdentity = page.locator(".exercise-transition-current");
    await expect
      .poll(() =>
        currentIdentity.evaluate(
          (element) => getComputedStyle(element).animationName,
        ),
      )
      .toBe("exercise-next-in");
    await expectNoHorizontalOverflow(page);
    const after = (await readPersistedStore(page)).sessions[0];
    expect(after.id).toBe(before.id);
    expect(after.startedAt).toBe(before.startedAt);
    expect(after.status).toBe("inProgress");
  });

  test(`reduced motion removes page and exercise animation at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.getByRole("button", { name: "Ouvrir Mes séances" }).click();
    const workouts = page.locator(".sessions-library");
    await expect(workouts).toHaveClass(/page-forward/);
    expect(
      await workouts.evaluate(
        (element) => getComputedStyle(element).animationName,
      ),
    ).toBe("none");

    await createWorkoutPreparation(page, "Reduced", [
      "Exercice A",
      "Exercice B",
    ]);
    const preparation = page.locator(".workout-preparation");
    expect(
      await preparation.evaluate(
        (element) => getComputedStyle(element).animationName,
      ),
    ).toBe("none");
    await page
      .getByRole("list", { name: "Exercices" })
      .getByRole("button", { name: /Exercice B/ })
      .click();
    const currentIdentity = page.locator(".exercise-transition-current");
    expect(
      await currentIdentity.evaluate(
        (element) => getComputedStyle(element).animationName,
      ),
    ).toBe("none");
    expect(
      await page
        .locator(".exercise-transition-outgoing")
        .evaluate((element) => getComputedStyle(element).display),
    ).toBe("none");
    await expectNoHorizontalOverflow(page);
  });
}
