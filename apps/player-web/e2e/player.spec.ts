import { expect, test, type Page } from "@playwright/test";

const ENTRY = "El encuentro";
const SECOND = "Las iniciales";
const ALBUM = "Nuestro álbum";

/** Seeds a previous session's progress, through the same key the app reads. */
async function withProgress(page: Page, completedNodes: string[]) {
  await page.addInitScript((nodes) => {
    localStorage.setItem(
      "lectoemocion.progress.local",
      JSON.stringify({ completedNodes: nodes, lastPlayedNode: nodes.at(-1) })
    );
  }, completedNodes);
}

/**
 * The world list is hidden while a resource plays, so completion is observed
 * where it is actually recorded rather than through a button that is not on
 * screen yet.
 *
 * The timeout is generous because these resources are fixed timelines, not
 * races: the album alone runs about twenty seconds, and this suite shares a
 * machine with three viewport projects and the bypass spec's Vite builds.
 */
async function completed(page: Page, nodeId: string, timeout = 60_000) {
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          localStorage.getItem("lectoemocion.progress.local")
        ),
      { timeout }
    )
    .toContain(nodeId);
}

async function canvasBox(page: Page) {
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

test("a new player starts with one way in", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "LectoEmoción" })).toBeVisible();
  await expect(page.getByTestId("progress-summary")).toHaveText(
    "1 de 6 desbloqueados"
  );

  await expect(page.getByRole("button", { name: ENTRY })).toBeEnabled();
  await expect(page.getByRole("button", { name: SECOND })).toBeDisabled();
  await expect(page.getByRole("button", { name: ALBUM })).toBeDisabled();
});

test("playing the first chapter unlocks the next node and persists", async ({
  page
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: ENTRY }).click();
  await expect(page.locator("canvas")).toBeVisible();

  /* The cinematic completes when its choreography ends; nothing to win. */
  await completed(page, "encuentro");

  await page.getByRole("button", { name: "Volver al mapa" }).click();
  await expect(page.getByRole("button", { name: SECOND })).toBeEnabled();
  await expect(page.getByTestId("progress-summary")).toHaveText(
    "2 de 6 desbloqueados"
  );

  await page.reload();
  await expect(page.getByTestId("progress-summary")).toHaveText(
    "2 de 6 desbloqueados"
  );
  await expect(page.getByRole("button", { name: SECOND })).toBeEnabled();
});

test("a completed chapter stays replayable", async ({ page }) => {
  await withProgress(page, ["encuentro"]);
  await page.goto("/");

  const entry = page.getByRole("button", { name: ENTRY });
  await expect(entry).toHaveAttribute("data-state", "completed");
  await expect(entry).toBeEnabled();

  await entry.click();
  await expect(page.locator("canvas")).toBeVisible();
});

test("the non-interactive resource plays to its end", async ({ page }) => {
  await withProgress(page, [
    "encuentro",
    "iniciales",
    "parejas",
    "cual-es",
    "silabas"
  ]);
  await page.goto("/");

  const album = page.getByRole("button", { name: ALBUM });
  await expect(album).toBeEnabled();
  await album.click();
  await expect(page.locator("canvas")).toBeVisible();

  /* It is a fixed timeline: it finishes on its own, with nothing to press. */
  await completed(page, "album");

  await page.getByRole("button", { name: "Volver al mapa" }).click();
  await expect(page.getByRole("button", { name: ALBUM })).toHaveAttribute(
    "data-state",
    "completed"
  );
});

test("the world and every resource fit the viewport", async ({ page }) => {
  await withProgress(page, [
    "encuentro",
    "iniciales",
    "parejas",
    "cual-es",
    "silabas"
  ]);
  await page.goto("/");

  const viewport = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight
  }));

  const map = await canvasBox(page);
  expect(map.width).toBeLessThanOrEqual(viewport.width);
  expect(map.height).toBeLessThanOrEqual(viewport.height);

  for (const title of [
    ENTRY,
    SECOND,
    "El bosque de parejas",
    "¿Cuál es?",
    "El puente de sílabas",
    ALBUM
  ]) {
    await page.getByRole("button", { name: title, exact: true }).click();
    const box = await canvasBox(page);
    expect(box.width, `${title} fits`).toBeLessThanOrEqual(viewport.width);
    expect(box.height, `${title} fits`).toBeLessThanOrEqual(viewport.height);
    await page.getByRole("button", { name: "Volver al mapa" }).click();
  }
});

test("a minigame survives taps in the child reach band", async ({ page }) => {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));

  await withProgress(page, ["encuentro", "iniciales"]);
  await page.goto("/");
  await page.getByRole("button", { name: "El bosque de parejas" }).click();

  const box = await canvasBox(page);
  for (const fraction of [0.25, 0.5, 0.75]) {
    await page.mouse.click(
      box.x + box.width * fraction,
      box.y + box.height * 0.72
    );
  }

  expect(failures).toEqual([]);
});

test("the world list is gone while a resource plays", async ({ page }) => {
  await page.goto("/");
  const worldList = page.getByRole("navigation", { name: "Mundo" });
  await expect(worldList).toBeVisible();

  await page.getByRole("button", { name: ENTRY }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(worldList).toBeHidden();
  await expect(page.getByRole("button", { name: SECOND })).toHaveCount(0);

  await page.getByRole("button", { name: "Volver al mapa" }).click();
  await expect(worldList).toBeVisible();
});

test("a locked node cannot be opened from the map", async ({ page }) => {
  await page.goto("/");
  const locked = page.getByRole("button", { name: ALBUM });
  await expect(locked).toBeDisabled();

  await locked.click({ force: true });

  await expect(page.getByTestId("progress-summary")).toBeVisible();
});
