import { expect, test } from "@playwright/test";

for (const width of [320, 390]) {
  test(`sheet backdrop closes at ${width}px while internal taps and focus stay open`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "Ouvrir Mes séances" }).click();
    await page.getByRole("button", { name: "Créer une séance" }).click();

    const sheet = page.getByRole("dialog", { name: "Séance" });
    const backdrop = page.locator(".sheet-backdrop");
    await expect(sheet).toBeVisible();
    await sheet.getByRole("heading", { name: "Séance" }).click();
    await expect(sheet).toBeVisible();

    const name = sheet.getByRole("textbox", { name: "Nom" });
    await name.click();
    await name.fill("Brouillon");
    await expect(name).toBeFocused();
    await expect(sheet).toBeVisible();

    await backdrop.click({ position: { x: 4, y: 4 } });
    await expect(backdrop).toHaveClass(/is-closing/);
    await expect(sheet).toHaveCount(0);
    expect(await page.evaluate(() => document.body.style.position)).toBe("");
  });
}
