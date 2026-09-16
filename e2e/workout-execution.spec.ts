import { expect, test } from "@playwright/test";

async function prepareWorkout(page, setCount = "2") {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /Créer une séance/i }).click();
  await page.getByRole("textbox", { name: "Nom" }).fill("Séance E2E");
  await page.getByRole("button", { name: /Enregistrer/i }).click();
  await page.locator(".workout-card").click();
  await page.getByRole("button", { name: /Gérer les exercices/i }).click();
  await page
    .getByRole("dialog", { name: /Actions de la séance/i })
    .getByRole("button", { name: /Ajouter un exercice/i })
    .click();
  await page.getByRole("textbox", { name: "Nom" }).fill("Exercice A");
  await page.getByLabel(/Nombre de séries initiales/i).fill(setCount);
  await page
    .getByRole("spinbutton", { name: "Repos par défaut (secondes)" })
    .fill("30");
  await page.getByRole("button", { name: /Enregistrer/i }).click();
}

test("adds a third set after starting a workout", async ({ page }) => {
  await prepareWorkout(page);
  await page.getByRole("button", { name: /Démarrer la séance/i }).click();
  const region = page.getByRole("region", { name: "Séries de Exercice A" });
  const addSet = page.getByRole("button", { name: "+ Ajouter une série" });
  await expect(addSet).toBeVisible();
  await addSet.click();
  await expect(region.getByRole("listitem")).toHaveCount(3);
  await expect(region.getByRole("heading", { name: "SÉRIE 3" })).toBeVisible();
});

test("adds a third set while the first set is active", async ({ page }) => {
  await prepareWorkout(page);
  await page.getByRole("button", { name: /Démarrer la séance/i }).click();
  const region = page.getByRole("region", { name: "Séries de Exercice A" });
  const blocks = region.getByRole("listitem");
  await blocks.nth(0).getByRole("button", { name: "Lancer le repos" }).click();
  const addSet = page.getByRole("button", { name: "+ Ajouter une série" });
  await expect(addSet).toBeVisible();
  await addSet.click();
  await expect(blocks).toHaveCount(3);
  await expect(blocks.nth(0)).toContainText("Repos en cours");
  await expect(blocks.nth(2)).toContainText("À venir");
});

test("does not activate the next exercise when deleting an upcoming set", async ({
  page,
}) => {
  await prepareWorkout(page);
  await page.getByRole("button", { name: /Gérer les exercices/i }).click();
  await page
    .getByRole("dialog", { name: /Actions de la séance/i })
    .getByRole("button", { name: /Ajouter un exercice/i })
    .click();
  await page.getByRole("textbox", { name: "Nom" }).fill("Exercice B");
  await page.getByLabel(/Nombre de séries initiales/i).fill("1");
  await page
    .getByRole("spinbutton", { name: "Repos par défaut (secondes)" })
    .fill("30");
  await page.getByRole("button", { name: /Enregistrer/i }).click();
  await page.getByRole("button", { name: /Démarrer la séance/i }).click();
  const aRegion = page.getByRole("region", { name: "Séries de Exercice A" });
  await aRegion
    .getByRole("listitem")
    .nth(1)
    .getByRole("button", { name: "Supprimer" })
    .click();
  const tabs = page.getByRole("list", { name: "Exercices" }).locator("li");
  await expect(tabs.nth(0)).toHaveClass(/execution-active/);
  await expect(tabs.nth(1)).toHaveClass(/execution-upcoming/);
  await aRegion.getByRole("button", { name: "Lancer le repos" }).click();
  await aRegion.getByRole("button", { name: "Terminer le repos" }).click();
  await expect(tabs.nth(0)).toHaveClass(/execution-completed/);
  await expect(tabs.nth(1)).toHaveClass(/execution-active/);
});

test("persists two independent sessions when a template is reused", async ({
  page,
}) => {
  await prepareWorkout(page, "1");
  await page.getByRole("button", { name: /Gérer les exercices/i }).click();
  await page
    .getByRole("dialog", { name: /Actions de la séance/i })
    .getByRole("button", { name: /Ajouter un exercice/i })
    .click();
  await page.getByRole("textbox", { name: "Nom" }).fill("Exercice B");
  await page.getByLabel(/Nombre de séries initiales/i).fill("1");
  await page
    .getByRole("spinbutton", { name: "Repos par défaut (secondes)" })
    .fill("30");
  await page.getByRole("button", { name: /Enregistrer/i }).click();
  await page.getByRole("button", { name: /Démarrer la séance/i }).click();
  let region = page.getByRole("region", { name: "Séries de Exercice A" });
  await region.getByRole("button", { name: "Lancer le repos" }).click();
  await region.getByRole("button", { name: "Terminer le repos" }).click();
  await page.getByRole("button", { name: "Exercice B" }).click();
  region = page.getByRole("region", { name: "Séries de Exercice B" });
  await region.getByRole("button", { name: "Lancer le repos" }).click();
  await region.getByRole("button", { name: "Terminer le repos" }).click();
  await page.getByRole("button", { name: /Terminer la séance/i }).click();
  await page.getByRole("button", { name: /Retour aux séances/i }).click();
  await page.locator(".workout-card").click();
  await page.getByRole("button", { name: /Démarrer la séance/i }).click();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("sport-nutrition-workouts") || "{}"),
  );
  expect(stored.version).toBe(2);
  expect(stored.templates).toHaveLength(1);
  expect(stored.sessions).toHaveLength(2);
  expect(stored.sessions[0].id).not.toBe(stored.sessions[1].id);
  expect(
    stored.sessions.every(
      (session: { templateId: string }) =>
        session.templateId === stored.templates[0].id,
    ),
  ).toBe(true);
});
