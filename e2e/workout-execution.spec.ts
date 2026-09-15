import { expect, test } from "@playwright/test";

test("keeps zone 0 add action visible and usable during execution", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: /Créer une séance/i }).click();
  await page.getByLabel("Nom").fill("Séance E2E");
  await page.getByRole("button", { name: /Enregistrer/i }).click();
  await page.locator(".workout-card").click();
  await page.getByRole("button", { name: /Gérer les exercices/i }).click();
  await page
    .getByRole("dialog", { name: /Actions de la séance/i })
    .getByRole("button", { name: /Ajouter un exercice/i })
    .click();
  await page.getByRole("textbox", { name: "Nom" }).fill("Exercice A");
  await page.getByLabel(/Nombre de séries/i).fill("1");
  await page
    .getByRole("spinbutton", { name: "Repos par défaut (secondes)" })
    .fill("30");
  await page.getByRole("button", { name: /Enregistrer/i }).click();

  const addButton = page.getByRole("button", { name: "Gérer les exercices" });
  await expect(addButton).toBeVisible();
  const before = await addButton.boundingBox();
  expect(before).not.toBeNull();
  expect(before!.x).toBeGreaterThanOrEqual(0);
  expect(before!.y).toBeGreaterThanOrEqual(0);
  expect(before!.x + before!.width).toBeLessThanOrEqual(390);
  expect(before!.y + before!.height).toBeLessThanOrEqual(844);

  await page.getByRole("button", { name: /Démarrer la séance/i }).click();
  await expect(addButton).toBeVisible();
  const after = await addButton.boundingBox();
  expect(after).not.toBeNull();
  expect(after!.x).toBeGreaterThanOrEqual(0);
  expect(after!.y).toBeGreaterThanOrEqual(0);
  expect(after!.x + after!.width).toBeLessThanOrEqual(390);
  expect(after!.y + after!.height).toBeLessThanOrEqual(844);
  await page.screenshot({
    path: testInfo.outputPath("after-start.png"),
    fullPage: false,
  });

  await addButton.click();
  await page
    .getByRole("dialog", { name: /Actions de la séance/i })
    .getByRole("button", { name: /Ajouter un exercice/i })
    .click();
  await expect(page.getByRole("dialog", { name: "Exercice" })).toBeVisible();
  await page.getByRole("textbox", { name: "Nom" }).fill("Exercice B");
  await page.getByLabel(/Nombre de séries/i).fill("1");
  await page.getByRole("spinbutton", { name: "Repos (secondes)" }).fill("30");
  await page.getByRole("button", { name: /Enregistrer/i }).click();
  await expect(page.getByRole("button", { name: /Exercice B/i })).toBeVisible();
});
