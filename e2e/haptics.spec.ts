import { expect, test, type Page } from "@playwright/test";
import {
  __storageKey,
  addExercise,
  createWorkout,
  type WorkoutStore,
} from "../src/storage/database";

type HapticWindow = Window & { hapticCalls: Array<number | number[]> };

async function prepare(page: Page, browserName: string, count: number) {
  const store: WorkoutStore = {
    version: 2,
    templates: [addExercise(createWorkout("Haptics"), "Squat", count, 30)],
    sessions: [],
  };
  await page.addInitScript(
    ({ key, store, mock }) => {
      Object.defineProperty(window, "indexedDB", { value: undefined });
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(store));
      (window as HapticWindow).hapticCalls = [];
      // Chromium validates dispatch only; WebKit keeps its real API surface.
      if (mock)
        Object.defineProperty(navigator, "vibrate", {
          value: (pattern: number | number[]) => {
            (window as HapticWindow).hapticCalls.push(pattern);
            return true;
          },
        });
    },
    { key: __storageKey, store, mock: browserName === "chromium" },
  );
  await page.goto("/");
  if (browserName === "webkit")
    expect(await page.evaluate(() => typeof navigator.vibrate)).toBe(
      "undefined",
    );
  await page.getByRole("button", { name: "Ouvrir Mes séances" }).click();
  await page.locator(".workout-card").click();
}

async function expectCalls(
  page: Page,
  browserName: string,
  calls: Array<number | number[]>,
) {
  await expect
    .poll(() => page.evaluate(() => (window as HapticWindow).hapticCalls))
    .toEqual(browserName === "chromium" ? calls : []);
}

async function stored(page: Page): Promise<WorkoutStore> {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    __storageKey,
  );
}

test("dispatches start, final set, confirmation and persisted success; native WebKit stays a no-op", async ({
  page,
  browserName,
}) => {
  await page.clock.install();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await prepare(page, browserName, 1);
  await expectCalls(page, browserName, []);
  await page.getByRole("button", { name: "Démarrer la séance" }).click();
  await expectCalls(page, browserName, [20]);
  await page.getByRole("button", { name: "Lancer le repos" }).click();
  await expect(page.locator(".set-block")).toHaveClass(/status-performed/);
  await expectCalls(page, browserName, [20, 50]);
  await page.getByRole("button", { name: "Terminer la séance" }).click();
  const confirmation = page.getByRole("alertdialog", {
    name: "Terminer la séance ?",
  });
  await expect(confirmation).toBeVisible();
  await expectCalls(page, browserName, [20, 50, 50]);
  // The global clock rerenders while the same confirmation remains visible.
  await page.clock.runFor(2000);
  await expectCalls(page, browserName, [20, 50, 50]);
  await confirmation
    .getByRole("button", { name: "Terminer", exact: true })
    .click();
  await expect
    .poll(async () => (await stored(page)).sessions[0].status)
    .toBe("completed");
  await expectCalls(page, browserName, [20, 50, 50, [25, 35, 45]]);
  expect(errors).toEqual([]);
});

test("natural expiry emits once; manual rest only emits medium on confirmation opening", async ({
  page,
  browserName,
}) => {
  await page.clock.install();
  await prepare(page, browserName, 3);
  await page.getByRole("button", { name: "Démarrer la séance" }).click();
  const sets = page.locator(".set-block");
  await sets.nth(0).getByRole("button", { name: "Lancer le repos" }).click();
  await expectCalls(page, browserName, [20]);
  await page.clock.runFor(31000);
  await expect(sets.nth(0)).toHaveClass(/status-performed/);
  await expectCalls(page, browserName, [20, 20]);
  await page.evaluate(() => {
    window.dispatchEvent(new Event("pageshow"));
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.runFor(3000);
  await expectCalls(page, browserName, [20, 20]);
  await page.evaluate(() => {
    (window as HapticWindow).hapticCalls = [];
  });
  await sets.nth(1).getByRole("button", { name: "Lancer le repos" }).click();
  await expectCalls(page, browserName, []);
  await sets
    .nth(1)
    .getByRole("button", { name: "Mettre fin au repos" })
    .click();
  const confirmation = page.getByRole("alertdialog", {
    name: "Mettre fin au repos ?",
  });
  await expect(confirmation).toBeVisible();
  await expectCalls(page, browserName, [50]);
  await confirmation
    .getByRole("button", { name: "Mettre fin", exact: true })
    .click();
  await expect(sets.nth(1)).toHaveClass(/status-performed/);
  await expectCalls(page, browserName, [50]);
  await page.clock.runFor(31000);
  await expectCalls(page, browserName, [50]);
});

test("a suspended expired rest settles silently and an existing session resumes silently", async ({
  page,
  browserName,
}) => {
  await page.clock.install();
  await prepare(page, browserName, 2);
  await page.getByRole("button", { name: "Démarrer la séance" }).click();
  await page
    .locator(".set-block")
    .first()
    .getByRole("button", { name: "Lancer le repos" })
    .click();
  await page.clock.runFor(2000);
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  // Simulate suspended callbacks rather than continuously ticking in background.
  await page.clock.fastForward(120000);
  await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));
  await expect(page.locator(".set-block").first()).toHaveClass(
    /status-performed/,
  );
  await expectCalls(page, browserName, [20]);
  await page.getByRole("button", { name: "Retour aux séances" }).click();
  await page
    .getByRole("button", { name: "Reprendre la séance Haptics" })
    .click();
  await expect(page.locator(".set-block").first()).toHaveClass(
    /status-performed/,
  );
  await expectCalls(page, browserName, [20]);
});
