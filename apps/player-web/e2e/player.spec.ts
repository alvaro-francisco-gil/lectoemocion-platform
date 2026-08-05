import { expect, test } from "@playwright/test";

const RESOURCES = [
  "Historia de nombres",
  "Juego de iniciales",
  "Parejas",
  "¿Cuál es?",
  "Sílabas"
];

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

test("renders every resource within the viewport", async ({ page }) => {
  await page.goto("/");
  const canvas = page.locator("canvas");

  for (const label of RESOURCES) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(
      page.getByRole("button", { name: label, exact: true })
    ).toHaveAttribute("aria-pressed", "true");
    await expect(canvas).toBeVisible();

    const box = await canvas.boundingBox();
    expect(box, `${label} renders a canvas`).not.toBeNull();
    expect(box!.width).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
    expect(box!.height).toBeLessThanOrEqual(
      await page.evaluate(() => innerHeight)
    );
  }
});

test("a vocabulary game survives taps in the child reach band", async ({
  page
}) => {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));

  await page.goto("/");
  await page.getByRole("button", { name: "Parejas", exact: true }).click();
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  for (const fraction of [0.25, 0.5, 0.75]) {
    await page.mouse.click(
      box!.x + box!.width * fraction,
      box!.y + box!.height * 0.72
    );
  }

  expect(failures).toEqual([]);
});
