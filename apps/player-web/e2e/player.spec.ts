import { expect, test, type Page } from "@playwright/test";
import { createResourceForNode, world } from "@lectoemocion/template-catalog";
import {
  createInitialLetterRound,
  createLettersRound
} from "@lectoemocion/template-sdk";
import {
  INITIAL_LETTER_LAYOUT,
  initialLetterColumnX
} from "../src/game/templates/initialLetterLayout";
import {
  LETTERS_LAYOUT,
  letterColumnX
} from "../src/game/templates/lettersLayout";

const ENTRY = "El encuentro";
const SECOND = "Las iniciales";
const ALBUM = "Nuestro álbum";

/**
 * Seeds a previous session's progress, through the same key the app reads.
 *
 * Each completed chapter is seeded with its chest already opened and its
 * letriestrellas already paid. A completed chapter with no animal is a chapter
 * that owes a ceremony, and these tests are about the world and the resources
 * rather than the reward.
 */
async function withProgress(page: Page, completedNodes: string[]) {
  const rewards = completedNodes.map((nodeId) => {
    const node = world.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) throw new Error(`No such world node: ${nodeId}`);
    return { nodeId, animalId: node.reward.choices[0]!.animalId };
  });

  await page.addInitScript(
    ({ nodes, rewards: claimed }) => {
      localStorage.setItem(
        "lectoemocion.progress.local",
        JSON.stringify({
          completedNodes: nodes,
          lastPlayedNode: nodes.at(-1),
          rewards: claimed,
          stars: nodes.length * 3
        })
      );
    },
    { nodes: completedNodes, rewards }
  );
}

/**
 * Takes the letriestrellas every finish pays and, when the chapter is owed
 * one, the animal after them — landing back on the map.
 */
async function takeTheReward(page: Page) {
  await takeTheStars(page);
  await page.getByRole("button", { name: "Abrir el cofre 1" }).click();
  await page.getByRole("button", { name: "Seguir" }).click();
}

/** Acknowledges the stars screen that follows every finish. */
async function takeTheStars(page: Page) {
  await expect(page.getByRole("status")).toContainText("letriestrellas");
  await page.getByRole("button", { name: "Seguir" }).click();
}

/**
 * The world list is hidden while a resource plays, so completion is observed
 * where it is actually recorded rather than through a button that is not on
 * screen yet.
 *
 * The timeout is generous because these resources are fixed timelines, not
 * races: the album alone runs about twenty seconds, and this suite shares a
 * machine with three viewport projects and the bypass spec's Vite builds. It
 * tracks the suite's per-test budget — a poll that expires first would report
 * contention as a missing completion.
 */
async function completed(page: Page, nodeId: string, timeout = 120_000) {
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
  await expect(page.getByRole("navigation", { name: "Mundo" })).toBeVisible();

  await expect(page.getByRole("button", { name: ENTRY })).toBeEnabled();
  await expect(page.getByRole("button", { name: SECOND })).toBeDisabled();
  await expect(page.getByRole("button", { name: ALBUM })).toBeDisabled();
});

test("playing the first chapter unlocks the next node and persists", async ({
  page
}) => {
  await page.goto("/");
  const stars = page.getByRole("region", { name: "Letriestrellas" });
  await expect(stars).toHaveText("0");

  await page.getByRole("button", { name: ENTRY }).click();
  await expect(page.locator("canvas")).toBeVisible();

  /* The cinematic completes when its choreography ends; nothing to win. */
  await completed(page, "encuentro");

  /* Finishing it hands the screen straight to the rewards, unasked: the
     letriestrellas it paid, and then the chests it owes. */
  await takeTheReward(page);
  await expect(page.getByRole("button", { name: SECOND })).toBeEnabled();
  await expect(stars).toHaveText("3");

  await page.reload();
  await expect(page.getByRole("button", { name: SECOND })).toBeEnabled();
  await expect(stars).toHaveText("3");
});

test("finishing a chapter hands out an animal for the collection", async ({
  page
}) => {
  await page.goto("/");
  /* One slot per chapter, counted from the world so a new one does not fail
     this test for having been added. */
  const empty = page.locator('.collection__slot[data-filled="false"]');
  await expect(empty).toHaveCount(world.nodes.length);

  await page.getByRole("button", { name: ENTRY }).click();
  await completed(page, "encuentro");

  await takeTheStars(page);

  const chests = page.getByRole("button", { name: /Abrir el cofre/ });
  await expect(chests).toHaveCount(3);
  await chests.nth(1).click();
  await page.getByRole("button", { name: "Seguir" }).click();

  const filled = page.locator('.collection__slot[data-filled="true"]');
  await expect(filled).toHaveCount(1);
  await expect(filled.locator("img")).toBeVisible();
  await expect(empty).toHaveCount(world.nodes.length - 1);
});

test("the collection sits below the path, and the path is centred", async ({
  page
}) => {
  await withProgress(page, ["encuentro"]);
  await page.goto("/");

  const path = (await page.locator(".world-path").boundingBox())!;
  const collection = (await page.locator(".collection").boundingBox())!;
  const viewport = await page.evaluate(() => ({ height: innerHeight }));

  /* Below, and not overlapping: the row is a footer, not a second path. */
  expect(collection.y).toBeGreaterThanOrEqual(path.y + path.height);

  /*
   * The path holds the middle band rather than the bottom edge it used to sit
   * on, with the collection taking the space underneath it.
   */
  const centre = path.y + path.height / 2;
  expect(centre).toBeGreaterThan(viewport.height * 0.2);
  expect(centre).toBeLessThan(viewport.height * 0.7);
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
  /* Everything but the album itself, taken from the world rather than listed:
     what unlocks it is the world's business, and a hand-written list would
     leave this test locked out the next time a chapter is added before it. */
  await withProgress(
    page,
    world.nodes.map((node) => node.id).filter((id) => id !== "album")
  );
  await page.goto("/");

  const album = page.getByRole("button", { name: ALBUM });
  await expect(album).toBeEnabled();
  await album.click();
  await expect(page.locator("canvas")).toBeVisible();

  /* It is a fixed timeline: it finishes on its own, with nothing to press. */
  await completed(page, "album");

  await takeTheReward(page);
  await expect(page.getByRole("button", { name: ALBUM })).toHaveAttribute(
    "data-state",
    "completed"
  );
});

/**
 * Every node is seeded complete so that every one of them is open, and the
 * list swept is the world's own rather than a copy of it. A hand-written list
 * silently stops covering the world the moment a chapter is added — which is
 * exactly when a new resource has never been looked at on a real viewport.
 */
test("the world and every resource fit the viewport", async ({ page }) => {
  await withProgress(
    page,
    world.nodes.map((node) => node.id)
  );
  await page.goto("/");

  const viewport = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight
  }));

  /*
   * The map is DOM, not canvas. It may scroll sideways when the path outgrows
   * a narrow screen — that is the point of a path — but it must never make the
   * page itself scroll, in either axis.
   */
  const page_ = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight
  }));
  expect(page_.scrollWidth).toBeLessThanOrEqual(viewport.width);
  expect(page_.scrollHeight).toBeLessThanOrEqual(viewport.height);

  for (const title of [
    ENTRY,
    SECOND,
    "El bosque de parejas",
    "¿Cuál es?",
    "Las primeras letras",
    "El puente de sílabas",
    "El taller de letras",
    ALBUM
  ]) {
    await page.getByRole("button", { name: title, exact: true }).click();
    const box = await canvasBox(page);
    expect(box.width, `${title} fits`).toBeLessThanOrEqual(viewport.width);
    expect(box.height, `${title} fits`).toBeLessThanOrEqual(viewport.height);
    await page.getByRole("button", { name: "Volver al mapa" }).click();
  }
});

/**
 * A layout whose height is decided by the canvas, while the canvas is sized
 * from that same height, oscillates: the scale manager re-measures its parent
 * on a timer, so each pass feeds its own last answer back in. On screen that is
 * a picture that jumps and a page that scrolls away from the child.
 *
 * The check has to outlast several of those re-measurements, and it has to
 * cover the resource as well as the map, because leaving play changes the
 * header and re-triggers the whole measurement.
 */
async function holdsStill(page: Page) {
  const measure = () =>
    page.evaluate(() => {
      const root = document.documentElement;
      const canvas = document.querySelector("canvas")!.getBoundingClientRect();
      return {
        overflow: root.scrollHeight - root.clientHeight,
        canvas: [canvas.x, canvas.y, canvas.width, canvas.height].map(Math.round)
      };
    });

  const settled = await measure();
  expect(settled.overflow, "the page does not scroll").toBe(0);
  await page.waitForTimeout(1_600);
  expect(await measure()).toEqual(settled);
}

test("a playing resource holds still and the page never scrolls", async ({
  page
}) => {
  /*
   * A minigame, not the cinematic. Every finish now hands the screen to the
   * letriestrellas, so a fixed timeline would end mid-measurement and take
   * away the canvas this checks; a minigame ends when the child solves it, and
   * this test never touches it.
   */
  await withProgress(page, ["encuentro", "iniciales"]);
  await page.goto("/");
  await page.getByRole("button", { name: "El bosque de parejas" }).click();
  await expect(page.locator("canvas")).toBeVisible();

  await holdsStill(page);
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
  /* A minigame, so nothing can finish under this test and pull the screen to
     the rewards. */
  await withProgress(page, ["encuentro", "iniciales"]);
  await page.goto("/");
  const worldList = page.getByRole("navigation", { name: "Mundo" });
  await expect(worldList).toBeVisible();

  await page.getByRole("button", { name: "El bosque de parejas" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(worldList).toBeHidden();
  await expect(page.getByRole("button", { name: SECOND })).toHaveCount(0);
  /* The star counter belongs to the map too: nothing counts up beside a
     running game. */
  await expect(page.getByRole("region", { name: "Letriestrellas" })).toHaveCount(
    0
  );

  await page.getByRole("button", { name: "Volver al mapa" }).click();
  await expect(worldList).toBeVisible();
});

test("the world reads as one horizontal path, with no page header", async ({
  page
}) => {
  await withProgress(page, ["encuentro"]);
  await page.goto("/");

  await expect(page.locator("header")).toHaveCount(0);
  await expect(page.locator("h1")).toHaveCount(0);

  /* Derived, not written down: adding a chapter must not fail this test. */
  const nodes = page.locator(".world-node");
  await expect(nodes).toHaveCount(world.nodes.length);

  /* Every node shares a row: same top edge, strictly increasing left edge. */
  const boxes = await nodes.evaluateAll((elements) =>
    elements.map((element) => {
      const { x, y } = element.getBoundingClientRect();
      return { x, y };
    })
  );
  const [first] = boxes;
  expect(first).toBeDefined();
  for (const [index, box] of boxes.entries()) {
    expect(Math.abs(box.y - first!.y), "shares the row").toBeLessThan(2);
    if (index > 0) expect(box.x).toBeGreaterThan(boxes[index - 1]!.x);
  }
});

test("playing shows only the way back", async ({ page }) => {
  /* Replayed, for the same reason: a first run ends in a screen of chests. */
  await withProgress(page, ["encuentro"]);
  await page.goto("/");
  await page.getByRole("button", { name: ENTRY }).click();
  await expect(page.locator("canvas")).toBeVisible();

  const back = page.getByRole("button", { name: "Volver al mapa" });
  await expect(back).toBeVisible();
  await expect(page.getByRole("button")).toHaveCount(1);

  /* Top-left, clear of where a child's hands land during play. */
  const box = (await back.boundingBox())!;
  const viewport = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight
  }));
  expect(box.x).toBeLessThan(viewport.width / 4);
  expect(box.y).toBeLessThan(viewport.height / 4);
});

test("a locked node cannot be opened from the map", async ({ page }) => {
  await page.goto("/");
  const locked = page.getByRole("button", { name: ALBUM });
  await expect(locked).toBeDisabled();

  await locked.click({ force: true });

  await expect(page.getByRole("navigation", { name: "Mundo" })).toBeVisible();
});

/**
 * One drag, paced so the game sees it as a drag.
 *
 * Phaser reads its pointer queue once per frame. A press, a move, and a
 * release delivered inside a single frame collapse into something that is not
 * a drag at all, so the letter lands nowhere — and three of those lose the
 * round, after which the chapter can never be finished and the test can only
 * time out. Delivered fast enough, that is exactly what happens: this passed
 * run alone and timed out under a loaded three-project run.
 *
 * The waits buy a frame at each stage on a machine that is rendering two other
 * viewports at the same time. They are not a guess at how long the app takes:
 * every assertion after this still polls.
 */
async function dragAcrossCanvas(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number }
) {
  const frames = 100;
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.waitForTimeout(frames);
  /* Stepped, because a single jump can be read as a click rather than a drag. */
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.waitForTimeout(frames);
  await page.mouse.up();
  await page.waitForTimeout(frames);
}

/**
 * The letters game, won by dragging.
 *
 * The other minigames are proved by their rules tests; a drag cannot be. It is
 * the one placement gesture where the rules can be perfectly right and the
 * child still unable to finish, because nothing was wired between the pointer
 * and `placeLetter`. So this plays the real chapter through the real canvas.
 *
 * Where to press comes from the two things that decide it — the seeded deal
 * (`createLettersRound` on the resource the world builds) and `LETTERS_LAYOUT`
 * — rather than from numbers copied into this file, which would keep passing
 * after the row moved out from under the child.
 */
test("the letters game is won by dragging each letter into its slot", async ({
  page
}) => {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));

  await withProgress(page, ["encuentro", "iniciales", "parejas", "silabas"]);
  await page.goto("/");
  await page.getByRole("button", { name: "El taller de letras" }).click();

  const box = await canvasBox(page);
  const node = world.nodes.find((candidate) => candidate.id === "letras")!;
  const resource = createResourceForNode(node);
  if (resource.template.id !== "letters-game") {
    throw new Error("The letters chapter no longer plays the letters game");
  }
  const round = createLettersRound(resource);

  /* Logical canvas units to screen pixels: the canvas letterboxes to fit. */
  const scale = Math.min(
    box.width / LETTERS_LAYOUT.canvasWidth,
    box.height / LETTERS_LAYOUT.canvasHeight
  );
  const at = (x: number, y: number) => ({
    x: box.x + box.width / 2 + (x - LETTERS_LAYOUT.canvasWidth / 2) * scale,
    y: box.y + box.height / 2 + (y - LETTERS_LAYOUT.canvasHeight / 2) * scale
  });

  for (const [trayIndex, card] of round.tray.entries()) {
    const from = at(
      letterColumnX(trayIndex, round.tray.length),
      LETTERS_LAYOUT.trayRowY
    );
    const to = at(
      letterColumnX(card.slotIndex, round.slots.length),
      LETTERS_LAYOUT.slotRowY
    );

    await dragAcrossCanvas(page, from, to);
  }

  await completed(page, "letras");
  expect(failures).toEqual([]);
});

/**
 * The initial-letter game, won by tapping.
 *
 * Its rules are proved by their own tests; what cannot be is that each of the
 * two rows is actually under the pointer. The letter row is a different size
 * from the picture row, so a card whose drawing and whose hit area disagree
 * would leave a child pressing a letter that never answers — and every rules
 * test would still pass.
 *
 * Where to press is derived from the seeded deal and `INITIAL_LETTER_LAYOUT`,
 * never copied here.
 */
test("the initial-letter game is won by tapping each picture and its letter", async ({
  page
}) => {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));

  await withProgress(page, ["encuentro", "iniciales", "parejas", "cual-es"]);
  await page.goto("/");
  await page.getByRole("button", { name: "Las primeras letras" }).click();

  const box = await canvasBox(page);
  const node = world.nodes.find(
    (candidate) => candidate.id === "primeras-letras"
  )!;
  const resource = createResourceForNode(node);
  if (resource.template.id !== "initial-letter-game") {
    throw new Error("The chapter no longer plays the initial-letter game");
  }
  const round = createInitialLetterRound(resource);

  const scale = Math.min(
    box.width / INITIAL_LETTER_LAYOUT.canvasWidth,
    box.height / INITIAL_LETTER_LAYOUT.canvasHeight
  );
  const at = (x: number, y: number) => ({
    x:
      box.x +
      box.width / 2 +
      (x - INITIAL_LETTER_LAYOUT.canvasWidth / 2) * scale,
    y:
      box.y +
      box.height / 2 +
      (y - INITIAL_LETTER_LAYOUT.canvasHeight / 2) * scale
  });

  const row = (group: "picture" | "letter") =>
    round.cards.filter((card) => card.group === group);
  const pictures = row("picture");
  const letters = row("letter");

  for (const [index, picture] of pictures.entries()) {
    const letterIndex = letters.findIndex(
      (card) => card.initial === picture.initial
    );
    const from = at(
      initialLetterColumnX(index, pictures.length),
      INITIAL_LETTER_LAYOUT.pictureRowY
    );
    const to = at(
      initialLetterColumnX(letterIndex, letters.length),
      INITIAL_LETTER_LAYOUT.letterRowY
    );

    await page.mouse.click(from.x, from.y);
    await page.mouse.click(to.x, to.y);
  }

  await completed(page, "primeras-letras");
  expect(failures).toEqual([]);
});
