import { expect, test } from "@playwright/test";

test("switches resources and keeps the game canvas visible", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "LectoEmoción" })).toBeVisible();
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();

  await page.getByRole("button", { name: "Juego de iniciales" }).click();
  await expect(
    page.getByRole("button", { name: "Juego de iniciales" })
  ).toHaveAttribute("aria-pressed", "true");
  await expect(canvas).toBeVisible();

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  expect(box!.height).toBeLessThanOrEqual(await page.evaluate(() => innerHeight));
});
