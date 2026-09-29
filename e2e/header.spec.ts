import { expect, test } from "@playwright/test";
import {
  __storageKey,
  addExercise,
  completeWorkoutExecution,
  createWorkout,
  createWorkoutSession,
  skipExecutedExercise,
  type WorkoutStore,
} from "../src/storage/database";

// Real templates and a completed session make the library and preview scrollable.
function headerFixture(): WorkoutStore {
  let template = createWorkout("Programme header");
  for (let index = 0; index < 12; index++) {
    template = addExercise(template, `Exercice ${index + 1}`, 8, 30);
  }
  const session = createWorkoutSession(template, 100_000);
  const settled = template.exercises.reduce(
    (execution, exercise) => skipExecutedExercise(execution, exercise.id),
    session.execution,
  );
  return {
    version: 2,
    templates: [
      template,
      ...Array.from({ length: 10 }, (_, index) =>
        addExercise(createWorkout(`Programme ${index + 1}`), "Squat", 3, 30),
      ),
    ],
    sessions: [
      {
        ...session,
        status: "completed",
        completedAt: 200_000,
        execution: completeWorkoutExecution(settled, 200_000),
      },
    ],
  };
}

for (const width of [320, 390]) {
  test(`compact header remains on dashboard, library and preview at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Ouvrir Mes séances" }),
    ).toBeVisible();
    await page.evaluate(
      ({ key, store }) =>
        new Promise<void>((resolve, reject) => {
          const request = indexedDB.open("sport-nutrition", 2);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction("data", "readwrite");
            transaction.objectStore("data").put(store, key);
            transaction.oncomplete = () => {
              db.close();
              resolve();
            };
            transaction.onerror = () => reject(transaction.error);
          };
        }),
      { key: __storageKey, store: headerFixture() },
    );
    await page.reload();
    for (const screen of ["list", "workouts", "preview"] as const) {
      await test.step(screen, async () => {
        await page.evaluate(() =>
          window.scrollTo({ top: 0, behavior: "instant" }),
        );
        if (screen === "workouts") {
          await page
            .getByRole("button", { name: "Ouvrir Mes séances" })
            .click();
        } else if (screen === "preview") {
          await page
            .locator(".workout-card")
            .filter({ hasText: "Programme header" })
            .click();
          await expect(
            page.getByRole("button", { name: "PRÉPARER LA SÉANCE" }),
          ).toBeVisible();
        }
        await expect(page.locator(".app-shell")).toHaveClass(
          new RegExp(`screen-${screen}`),
        );
        const header = page.locator(".workout-control");
        const title = header.locator(
          screen === "list" ? ".brand-lockup" : "h1",
        );
        await expect(header).toHaveAttribute("data-compact-header", "true");
        await expect(header).not.toHaveAttribute("data-scrolled");
        await expect(header).toHaveCSS("position", "sticky");
        await expect(title).toHaveCSS("transform", "none");
        const before = await header.boundingBox();
        await page.evaluate(() =>
          window.scrollTo({ top: 160, behavior: "instant" }),
        );
        await expect
          .poll(() => page.evaluate(() => window.scrollY))
          .toBeGreaterThan(8);
        await expect(header).toHaveAttribute("data-scrolled", "true");
        await expect(title).toHaveCSS(
          "transform",
          "matrix(0.95, 0, 0, 0.95, 0, 0)",
        );
        const surface = await header.evaluate((element) => {
          const style = getComputedStyle(element, "::before");
          return {
            content: style.content,
            opacity: style.opacity,
            backdropFilter:
              style.backdropFilter !== "none"
                ? style.backdropFilter
                : style.webkitBackdropFilter,
            supportsBlur:
              CSS.supports("backdrop-filter", "blur(1px)") ||
              CSS.supports("-webkit-backdrop-filter", "blur(1px)"),
          };
        });
        expect(surface.content).toBe('""');
        expect(surface.opacity).toBe("1");
        if (surface.supportsBlur) {
          expect(surface.backdropFilter).toContain("blur(18px)");
        }
        const after = await header.boundingBox();
        expect(after!.height).toBe(before!.height);
        expect(after!.y).toBe(before!.y);
        await expect(header).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth,
          ),
        ).toBe(false);
      });
    }
  });

  test(`compact header keeps its visual state without motion at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const header = page.locator(".workout-control");
    const title = header.locator(".brand-lockup");
    await expect(header).toHaveAttribute("data-compact-header", "true");
    await page.evaluate(() =>
      window.scrollTo({ top: 160, behavior: "instant" }),
    );
    await expect(header).toHaveAttribute("data-scrolled", "true");
    await expect(title).toHaveCSS(
      "transform",
      "matrix(0.95, 0, 0, 0.95, 0, 0)",
    );
    expect(
      await header.evaluate((element) => {
        const surface = getComputedStyle(element, "::before");
        return [surface.opacity, surface.transitionDuration];
      }),
    ).toEqual(["1", "0s"]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);
  });
}
