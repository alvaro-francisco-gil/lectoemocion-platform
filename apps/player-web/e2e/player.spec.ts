import { writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { worldNodes } from "@lectoemocion/resource-schema";
import { createResourceForNode, world } from "@lectoemocion/template-catalog";
import {
  createInitialLetterRound,
  createInitialSyllableRound,
  createLettersRound,
  createSyllablesRound
} from "@lectoemocion/template-sdk";
import {
  DEFAULT_PRIZE_GOAL,
  MAX_PRIZE_GOAL,
  MIN_PRIZE_GOAL
} from "@lectoemocion/domain";
import {
  INITIAL_LETTER_LAYOUT,
  initialLetterColumnX
} from "../src/game/templates/initialLetterLayout";
import {
  choiceColumnX,
  INITIAL_SYLLABLE_LAYOUT
} from "../src/game/templates/initialSyllableLayout";
import {
  LETTERS_LAYOUT,
  letterColumnX
} from "../src/game/templates/lettersLayout";
import {
  SYLLABLES_LAYOUT,
  syllableColumnX
} from "../src/game/templates/syllablesLayout";
import { STARS_PER_COMPLETION } from "../src/world/worldView";
import { LOCAL_OWNER, storageKey } from "../src/world/progressStore";
import { LOCAL_GROUP, prizeGoalKey } from "../src/world/prizeStore";

/*
 * The starter profile's progress, by the app's own key builder.
 *
 * Spelling the key out here would keep this suite passing after the real key
 * changed shape, which is the one thing an end-to-end test must never do.
 */
const STARTER_PROGRESS_KEY = storageKey(LOCAL_OWNER);

/** A point on the page, in screen pixels. */
interface Point {
  readonly x: number;
  readonly y: number;
}

const ENTRY = "El encuentro";
const SECOND = "Las iniciales";
const ALBUM = "Nuestro álbum";

/**
 * Seeds a previous session's progress, through the same key the app reads.
 *
 * Each completed chapter is seeded with its chest already opened and its
 * letriestrellas already paid. A completed chapter with no animal is a chapter
 * that owes a ceremony, and these tests are about the world and the resources
 * rather than the reward — so the goal is pushed out past anywhere that many
 * letriestrellas can reach, one layer up in the same seed, for the same
 * reason: a gift owed on top of the chests would take the very screen these
 * tests are reading, over a prize none of them is about.
 */
async function withProgress(page: Page, completedNodes: string[]) {
  const rewards = completedNodes.map((nodeId) => {
    const node = worldNodes(world).find((candidate) => candidate.id === nodeId);
    if (!node) throw new Error(`No such world node: ${nodeId}`);
    return { nodeId, animalId: node.reward.animal.animalId };
  });

  await page.addInitScript(
    ({ key, nodes, rewards: claimed }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          completedNodes: nodes,
          lastPlayedNode: nodes.at(-1),
          rewards: claimed,
          stars: nodes.length * 3
        })
      );
    },
    { key: STARTER_PROGRESS_KEY, nodes: completedNodes, rewards }
  );
  await withGoal(page, MAX_PRIZE_GOAL);
}

/**
 * Seeds the adults' side: the goal the group is playing towards.
 *
 * Through the same key the app reads, for the same reason `withProgress` does:
 * a test that reaches past the store is testing something the product does not
 * do. The goal is the group's — the gifts a child earns against it are filed
 * under that child, and no test here needs to plant one.
 */
async function withGoal(page: Page, goal: number) {
  await page.addInitScript(
    ({ key, seed }) => {
      localStorage.setItem(key, JSON.stringify(seed));
    },
    { key: prizeGoalKey(LOCAL_GROUP), seed: { goal } }
  );
}

/**
 * Seeds a previous session's letriestrellas alone, with nothing completed
 * yet — an adult picking up a device mid-way through an earlier sitting. The
 * shape mirrors `withProgress`'s, minus the completion this test still has to
 * play for real.
 */
async function withBankedStars(page: Page, stars: number) {
  await page.addInitScript(
    ({ key, banked }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          completedNodes: [],
          lastPlayedNode: null,
          rewards: [],
          stars: banked
        })
      );
    },
    { key: STARTER_PROGRESS_KEY, banked: stars }
  );
}

/**
 * Opens a chapter, moving to the section it stands in first.
 *
 * Which section that is comes from the world rather than from a list here, so a
 * chapter that moves to the shelf does not quietly stop being covered.
 */
async function openChapter(page: Page, nodeId: string) {
  const node = worldNodes(world).find((candidate) => candidate.id === nodeId);
  if (!node) throw new Error(`No such world node: ${nodeId}`);

  await page
    .getByRole("button", {
      name: node.surface === "recursos" ? "Recursos" : "Juegos"
    })
    .click();
  await page.getByRole("button", { name: node.title, exact: true }).click();
}

/** Every chapter on the path. The shelf is reached by its own section. */
const GAMES = worldNodes(world).filter((node) => node.surface === "juegos");

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
        page.evaluate((key) => localStorage.getItem(key), STARTER_PROGRESS_KEY),
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
  const stars = page.locator(".prize-count");
  /* Not on screen at all until the first one is won. */
  await expect(stars).toHaveCount(0);

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

  const book = page.getByRole("dialog", { name: "Mis animales" });
  const openBook = () =>
    page.getByRole("button", { name: "Mis animales" }).click();
  /* Shut by tapping the world around it, which is the only way out it has. */
  const closeBook = () => book.click({ position: { x: 4, y: 4 } });
  const owed = page.locator('.animal-book__page[data-earned="false"]');
  const earned = page.locator('.animal-book__page[data-earned="true"]');

  /* One page per chapter, counted from the world so a new one does not fail
     this test for having been added. Every one of them draws its animal from
     the first screen: the book shows which animal is owed, not merely that one
     is. */
  await openBook();
  await expect(owed).toHaveCount(worldNodes(world).length);
  await expect(owed.first().locator("img")).toBeVisible();
  await closeBook();

  await page.getByRole("button", { name: ENTRY }).click();
  await completed(page, "encuentro");

  await takeTheStars(page);

  const chests = page.getByRole("button", { name: /Abrir el cofre/ });
  await expect(chests).toHaveCount(3);
  await chests.nth(1).click();
  await page.getByRole("button", { name: "Seguir" }).click();

  /* The book opens itself, stamps the animal in, and takes itself away. */
  await expect(earned).toHaveCount(1);
  await expect(earned.locator("img")).toBeVisible();
  await expect(owed).toHaveCount(worldNodes(world).length - 1);
  await expect(book).toBeHidden();

  /* And it is still there when the child goes back to look. */
  await openBook();
  await expect(earned).toHaveCount(1);
});

/*
 * The whole book on one page is the point, so it has to actually fit one.
 *
 * The stickers were laid out in a fixed number of columns with square cells, so
 * the rows were sized from the column width and knew nothing about the height
 * they had: an eleventh chapter added a third row and pushed the bottom of it
 * off the paper. This measures what a child sees rather than the rule that
 * produced it, so any future way of overflowing fails here too.
 */
test("every sticker sits on the page, at every size", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Mis animales" }).click();

  const sheet = (await page.locator(".animal-book__pages").boundingBox())!;
  const viewport = page.viewportSize()!;

  /* The paper itself is on screen. */
  expect(sheet.x).toBeGreaterThanOrEqual(0);
  expect(sheet.y).toBeGreaterThanOrEqual(0);
  expect(sheet.x + sheet.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(sheet.y + sheet.height).toBeLessThanOrEqual(viewport.height + 1);

  const pages = page.locator(".animal-book__page");
  const count = await pages.count();
  expect(count).toBe(worldNodes(world).length);

  for (let index = 0; index < count; index += 1) {
    const box = (await pages.nth(index).boundingBox())!;
    expect(box.x, `sticker ${index} left`).toBeGreaterThanOrEqual(sheet.x - 1);
    expect(box.y, `sticker ${index} top`).toBeGreaterThanOrEqual(sheet.y - 1);
    expect(
      box.x + box.width,
      `sticker ${index} right`
    ).toBeLessThanOrEqual(sheet.x + sheet.width + 1);
    expect(
      box.y + box.height,
      `sticker ${index} bottom`
    ).toBeLessThanOrEqual(sheet.y + sheet.height + 1);
  }
});

test("the bar sits below the cards without covering them", async ({ page }) => {
  await withProgress(page, ["encuentro"]);
  await page.goto("/");

  const row = (await page.locator(".world-path").boundingBox())!;
  const bar = (await page.locator(".tab-bar__tabs").boundingBox())!;
  const viewport = await page.evaluate(() => ({ height: innerHeight }));

  /* Below, and not overlapping: the bar is chrome, not a second row. */
  expect(bar.y).toBeGreaterThanOrEqual(row.y + row.height);

  /* The cards hold the middle band rather than the bottom edge. */
  const centre = row.y + row.height / 2;
  expect(centre).toBeGreaterThan(viewport.height * 0.15);
  expect(centre).toBeLessThan(viewport.height * 0.7);
});

/* The shelf is open from the first screen, and what is on it is not on the
   path: two sections, not one list shown twice. */
test("the story is on the shelf, open to a brand new player", async ({
  page
}) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "El gallo Rayo" })).toHaveCount(
    0
  );

  await page.getByRole("button", { name: "Recursos" }).click();
  const story = page.getByRole("button", { name: "El gallo Rayo" });
  await expect(story).toBeEnabled();
  await expect(page.getByRole("button", { name: ENTRY })).toHaveCount(0);

  await story.click();
  await expect(page.locator("canvas")).toBeVisible();
});

/* Shut, and refused: dimming a section a child cannot reach is presentation,
   not the rule. */
test("Multijugador is shut", async ({ page }) => {
  await page.goto("/");
  const blocked = page.getByRole("button", { name: /Multijugador/ });

  await expect(blocked).toBeDisabled();
  await expect(page.getByRole("button", { name: ENTRY })).toBeVisible();
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
    worldNodes(world).map((node) => node.id).filter((id) => id !== "album")
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
    worldNodes(world).map((node) => node.id)
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

  for (const node of worldNodes(world)) {
    await openChapter(page, node.id);
    const box = await canvasBox(page);
    expect(box.width, `${node.title} fits`).toBeLessThanOrEqual(viewport.width);
    expect(box.height, `${node.title} fits`).toBeLessThanOrEqual(
      viewport.height
    );
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
  await openChapter(page, "parejas");
  await expect(page.locator("canvas")).toBeVisible();

  await holdsStill(page);
});

test("a minigame survives taps in the child reach band", async ({ page }) => {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));

  await withProgress(page, ["encuentro", "iniciales"]);
  await page.goto("/");
  await openChapter(page, "parejas");

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

  await openChapter(page, "parejas");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(worldList).toBeHidden();
  await expect(page.getByRole("button", { name: SECOND })).toHaveCount(0);
  /* The meter and the bar belong to the world screens too: nothing fills, and
     nothing offers a way out sideways, beside a running game. */
  await expect(
    page.getByRole("meter", { name: "Letriestrellas hacia el próximo regalo" })
  ).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Secciones" })).toHaveCount(
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
  await expect(nodes).toHaveCount(GAMES.length);

  /* Every card shares a row: same top edge, strictly increasing left edge. */
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

/*
 * The card is a picture.
 *
 * A child of three cannot read the title and cannot count, so what tells one
 * chapter from another has to be the illustration. Big enough to aim a finger
 * at, too: measured here so that a layout change cannot quietly shrink a card
 * back to a bullet.
 */
test("every chapter is a picture card, drawn large", async ({ page }) => {
  await withProgress(page, ["encuentro"]);
  await page.goto("/");

  const markers = page.locator(".world-node__marker");
  await expect(markers).toHaveCount(GAMES.length);

  const drawn = await markers.evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return {
        hasPicture: element.querySelector("img") !== null,
        width: box.width,
        height: box.height
      };
    })
  );

  for (const marker of drawn) {
    expect(marker.hasPicture, "the chapter's own picture").toBe(true);
    expect(marker.width).toBeGreaterThanOrEqual(120);
    /* A rectangle, not a disc: wider than it is tall. */
    expect(marker.width).toBeGreaterThan(marker.height);
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
 * Waits for the page to actually paint `count` frames.
 *
 * Paced against the browser's own frame clock rather than the wall clock. A
 * fixed millisecond wait is a bet on how long a frame takes, and that bet is
 * lost exactly when three viewport projects — one of them 4K — are rendering
 * at once, which is when this suite runs.
 *
 * Six is not a tuned number: it is "comfortably more than the one frame Phaser
 * strictly needs", bought in the only currency that stays honest under load.
 * On an idle machine it costs about a tenth of a second per stage; on a loaded
 * one it costs longer, which is the entire point.
 */
async function nextFrames(page: Page, count = 6) {
  await page.evaluate(
    (frames: number) =>
      new Promise<void>((resolve) => {
        let left = frames;
        const tick = () => {
          if (left <= 0) {
            resolve();
            return;
          }
          left -= 1;
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    count
  );
}

/**
 * One drag, paced so the game sees it as a drag.
 *
 * Phaser reads its pointer queue once per frame. A press, a move, and a
 * release delivered inside a single frame collapse into a click, which these
 * games deliberately do nothing with, so the card lands nowhere and the
 * chapter is never finished — the test can only time out.
 *
 * That is not hypothetical: it is what made this suite flaky under load, on
 * three separate tests, before the pacing below stopped being measured in
 * milliseconds. Every stage now waits for real frames, so a loaded machine
 * takes longer rather than dropping the gesture. Every assertion after this
 * still polls.
 */
async function dragAcrossCanvas(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number }
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await nextFrames(page);
  /* Stepped, because a single jump can be read as a click rather than a drag. */
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await nextFrames(page);
  await page.mouse.up();
  await nextFrames(page);
}

/**
 * Plays an ordering game to its end by dragging, and tolerates a dropped
 * gesture without tolerating a broken one.
 *
 * Winning one of these chapters takes every card placed, so the chance of the
 * harness losing *some* synthetic drag compounds with the length of the word.
 * A trace of one such failure shows three letters seated and the fourth still
 * in the row: nothing wrong with the game, one gesture that never arrived.
 *
 * So the pass is repeated. Re-dragging a card already in its slot is a no-op —
 * its card is hidden and its pointer target disabled — so a repeat only ever
 * retries what did not land. This cannot paper over a drag that does not work:
 * if the wiring were broken, every pass would place nothing and the poll below
 * would still fail. It absorbs dropped input, which is the harness's problem,
 * and nothing else.
 */
async function winBySequenceOfDrags(
  page: Page,
  nodeId: string,
  drags: readonly { from: Point; to: Point }[],
  passes = 3
) {
  for (let pass = 1; pass <= passes; pass += 1) {
    for (const { from, to } of drags) await dragAcrossCanvas(page, from, to);

    const progress = await page.evaluate(
      (key) => localStorage.getItem(key),
      STARTER_PROGRESS_KEY
    );
    if (progress?.includes(nodeId)) return;
  }

  /* Every pass placed nothing, or not everything: report it as the failure. */
  await completed(page, nodeId, 5_000);
}

/**
 * Plays a chapter to its end, reopening it from the map if a gesture is lost.
 *
 * The counterpart of `winBySequenceOfDrags` for a game answered by taps, where
 * replaying in place is not safe: a lost second tap leaves a card selected, and
 * a fresh pass starting against that selection pairs the wrong two cards and
 * thrashes. Going back to the map and opening the chapter again deals a new
 * round with nothing selected, so each attempt starts from a state the caller
 * can reason about.
 *
 * As with the drags, this absorbs input the harness dropped and nothing else:
 * a game that could not be won by tapping fails every attempt, and the poll at
 * the end still fails the test.
 */
async function winByReplayingChapter(
  page: Page,
  nodeId: string,
  chapterName: string,
  play: () => Promise<void>,
  attempts = 3
) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await play();

    const progress = await page.evaluate(
      (key) => localStorage.getItem(key),
      STARTER_PROGRESS_KEY
    );
    if (progress?.includes(nodeId)) return;
    if (attempt === attempts) break;

    await page.getByRole("button", { name: "Volver al mapa" }).click();
    await expect(page.getByRole("navigation", { name: "Mundo" })).toBeVisible();
    await page.getByRole("button", { name: chapterName }).click();
    await canvasBox(page);
  }

  await completed(page, nodeId, 5_000);
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
  const node = worldNodes(world).find((candidate) => candidate.id === "letras")!;
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

  await winBySequenceOfDrags(
    page,
    "letras",
    round.tray.map((card, trayIndex) => ({
      from: at(
        letterColumnX(trayIndex, round.tray.length),
        LETTERS_LAYOUT.trayRowY
      ),
      to: at(
        letterColumnX(card.slotIndex, round.slots.length),
        LETTERS_LAYOUT.slotRowY
      )
    }))
  );
  expect(failures).toEqual([]);
});

/**
 * The syllables game, won by dragging.
 *
 * The same reason the letters drag is played for real, and the same shape: two
 * games that share `sequenceRound` still have their own wiring between the
 * pointer and the rules, and a chapter nobody can finish is invisible to every
 * rules test. This one earns its place twice over, because the syllables game
 * is where tap-then-tap was removed — if that removal took the drag with it,
 * only a test through the canvas would say so.
 */
test("the syllables game is won by dragging each syllable into its slot", async ({
  page
}) => {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));

  await withProgress(page, ["encuentro", "iniciales", "parejas"]);
  await page.goto("/");
  await page.getByRole("button", { name: "El puente de sílabas" }).click();

  const box = await canvasBox(page);
  const node = worldNodes(world).find((candidate) => candidate.id === "silabas")!;
  const resource = createResourceForNode(node);
  if (resource.template.id !== "syllables-game") {
    throw new Error("The syllables chapter no longer plays the syllables game");
  }
  const round = createSyllablesRound(resource);

  /* Logical canvas units to screen pixels: the canvas letterboxes to fit. */
  const scale = Math.min(
    box.width / SYLLABLES_LAYOUT.canvasWidth,
    box.height / SYLLABLES_LAYOUT.canvasHeight
  );
  const at = (x: number, y: number) => ({
    x: box.x + box.width / 2 + (x - SYLLABLES_LAYOUT.canvasWidth / 2) * scale,
    y: box.y + box.height / 2 + (y - SYLLABLES_LAYOUT.canvasHeight / 2) * scale
  });

  await winBySequenceOfDrags(
    page,
    "silabas",
    round.tray.map((card, trayIndex) => ({
      from: at(
        syllableColumnX(trayIndex, round.tray.length),
        SYLLABLES_LAYOUT.trayRowY
      ),
      to: at(
        syllableColumnX(card.slotIndex, round.slots.length),
        SYLLABLES_LAYOUT.slotRowY
      )
    }))
  );
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
  const node = worldNodes(world).find(
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

  const connectEveryPair = async () => {
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
  };

  await winByReplayingChapter(
    page,
    "primeras-letras",
    "Las primeras letras",
    connectEveryPair
  );
  expect(failures).toEqual([]);
});

/**
 * The initial-syllable game, won by dragging the matching picture to the top.
 *
 * The same reason the letters drag is played for real: the rules can be
 * perfectly right and the child still unable to finish if nothing is wired
 * between the pointer and `chooseInitialSyllable`. Where to press comes from the
 * seeded round and `INITIAL_SYLLABLE_LAYOUT`, never from numbers copied here.
 */
test("the initial-syllable game is won by dragging the match onto the target", async ({
  page
}) => {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));

  /* Everything up to it, so the chapter is open without being played. */
  await withProgress(
    page,
    worldNodes(world)
      .map((node) => node.id)
      .filter((id) => id !== "empieza-igual" && id !== "album")
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Empieza igual" }).click();

  const box = await canvasBox(page);
  const node = worldNodes(world).find((candidate) => candidate.id === "empieza-igual")!;
  const resource = createResourceForNode(node);
  if (resource.template.id !== "initial-syllable-game") {
    throw new Error("The Empieza igual chapter no longer plays this game");
  }
  const round = createInitialSyllableRound(resource);

  const scale = Math.min(
    box.width / INITIAL_SYLLABLE_LAYOUT.canvasWidth,
    box.height / INITIAL_SYLLABLE_LAYOUT.canvasHeight
  );
  const at = (x: number, y: number) => ({
    x:
      box.x +
      box.width / 2 +
      (x - INITIAL_SYLLABLE_LAYOUT.canvasWidth / 2) * scale,
    y:
      box.y +
      box.height / 2 +
      (y - INITIAL_SYLLABLE_LAYOUT.canvasHeight / 2) * scale
  });

  const matchIndex = round.choices.findIndex(
    (choice) => choice.vocabularyItemId === round.matchVocabularyItemId
  );
  expect(matchIndex).toBeGreaterThanOrEqual(0);

  await winByReplayingChapter(page, "empieza-igual", "Empieza igual", () =>
    dragAcrossCanvas(
      page,
      at(
        choiceColumnX(matchIndex, round.choices.length),
        INITIAL_SYLLABLE_LAYOUT.choiceRowY
      ),
      at(
        INITIAL_SYLLABLE_LAYOUT.canvasWidth / 2,
        INITIAL_SYLLABLE_LAYOUT.targetY
      )
    )
  );
  expect(failures).toEqual([]);
});

/**
 * The regalo, played through a real browser rather than jsdom.
 *
 * A goal at its own floor: any goal reachable by banking `goal -
 * STARS_PER_COMPLETION` letriestrellas and then playing one chapter for real
 * lands exactly on it, and the lowest legal goal proves that boundary rather
 * than picking a number arbitrarily far from it.
 */
const PRIZE_GOAL = MIN_PRIZE_GOAL;

/**
 * Plays the one chapter needed to reach a gift, and stops on the ceremony's
 * first screen: the unconfigured "Un regalo te está esperando".
 */
async function reachGiftScreen(page: Page): Promise<void> {
  await withBankedStars(page, PRIZE_GOAL - STARS_PER_COMPLETION);
  await withGoal(page, PRIZE_GOAL);
  await page.goto("/");
  await page.getByRole("button", { name: ENTRY }).click();
  await completed(page, "encuentro");
  await takeTheReward(page);
}

/**
 * Taps a year into the adult gate's pad.
 *
 * One gate guards every adult surface — the prize settings and the profile
 * drawer alike — so this is the only way past any of them.
 */
async function tapYear(page: Page, year: string): Promise<void> {
  for (const digit of year) {
    await page.getByRole("button", { name: digit, exact: true }).click();
  }
}

/** Answers it with a year old enough to be an adult's. */
async function passAdultGate(page: Page): Promise<void> {
  await tapYear(page, "1988");
}

/** Reaches the gift, then the adult area past its gate, form open. */
async function openGiftForm(page: Page): Promise<void> {
  await reachGiftScreen(page);
  await page.getByRole("button", { name: "Preparar el regalo" }).click();
  await passAdultGate(page);
}

/*
 * A fresh device shows neither half. The count is nothing to read and the ring
 * is a promise nobody has started earning, so the world's corners are the
 * avatar and the animals alone until the first chapter is finished.
 */
test("the readout is absent on a fresh session, and arrives with the first stars", async ({
  page
}) => {
  await page.goto("/");
  const meter = page.getByRole("meter", {
    name: "Letriestrellas hacia el próximo regalo"
  });
  await expect(page.getByRole("navigation", { name: "Mundo" })).toBeVisible();
  await expect(meter).toHaveCount(0);
  await expect(page.locator(".prize-count")).toHaveCount(0);

  await page.getByRole("button", { name: ENTRY }).click();
  await completed(page, "encuentro");
  await takeTheReward(page);

  await expect(page.locator(".prize-count")).toHaveText("3");
  /* The goal is only ever said here, which is where a screen reader reads it. */
  await expect(meter).toHaveAttribute(
    "aria-valuemax",
    String(DEFAULT_PRIZE_GOAL)
  );
  await expect(page.locator(".prize-meter__gift")).toBeVisible();
});

test("reaching the goal shows the gift screen after the letriestrellas", async ({
  page
}) => {
  await reachGiftScreen(page);
  await expect(
    page.getByText("Un regalo te está esperando")
  ).toBeVisible();
});

test("Seguir leaves the gift reachable on the map, and the meter restarts", async ({
  page
}) => {
  await reachGiftScreen(page);
  await page.getByRole("button", { name: "Seguir" }).click();

  await expect(page.getByRole("button", { name: "Tu regalo" })).toBeVisible();
  /* Spent on the gift, so both halves leave rather than stand at a full goal
     that has already been paid out. */
  await expect(page.locator(".prize-count")).toHaveCount(0);
  await expect(
    page.getByRole("meter", { name: "Letriestrellas hacia el próximo regalo" })
  ).toHaveCount(0);
});

test("Preparar el regalo reaches the gate, refuses an implausible year, and 1988 opens the settings", async ({
  page
}) => {
  await reachGiftScreen(page);
  await page.getByRole("button", { name: "Preparar el regalo" }).click();

  await tapYear(page, "2024");
  await expect(page.getByRole("alert")).toHaveText(
    "Ese año no puede ser. Inténtalo otra vez."
  );

  await passAdultGate(page);

  await expect(
    page.getByLabel("Letriestrellas para el próximo regalo")
  ).toBeVisible();
  await expect(
    page.getByRole("radio", { name: "Encuentra tu regalo en el patio" })
  ).toBeVisible();
});

test("choosing a place makes the gift openable, and opening it reveals the phrase", async ({
  page
}) => {
  await openGiftForm(page);
  const phrase = "Encuentra tu regalo en el patio";

  await page.getByRole("radio", { name: phrase }).click();
  await page.getByRole("button", { name: "Guardar el regalo" }).click();
  await page.getByRole("button", { name: "Cerrar los ajustes" }).click();
  await page.getByRole("button", { name: "Tu regalo" }).click();
  await page.getByRole("button", { name: "¡Ábrelo!" }).click();

  await expect(page.getByText(phrase)).toBeVisible();
});

/**
 * A minimal, synthetic 2x2 JPEG, generated for this suite rather than
 * committed as a binary fixture. It is real enough for the browser's own
 * image decoder to downscale — which is what a custom prize's photo actually
 * needs — and it is written only into Playwright's own output directory,
 * never into source control.
 */
const TINY_JPEG_BASE64 =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDOooor3DpP/9k=";

test("a custom gift with a photo reveals both the words and the picture", async ({
  page
}, testInfo) => {
  await openGiftForm(page);

  await page.getByRole("radio", { name: "Escribirlo yo" }).click();
  await page.getByLabel("¿Qué hay dentro?").fill("un abrazo");

  const photo = testInfo.outputPath("prize-photo.jpg");
  await writeFile(photo, Buffer.from(TINY_JPEG_BASE64, "base64"));
  await page.getByLabel("Añadir una foto").setInputFiles(photo);

  await page.getByRole("button", { name: "Guardar el regalo" }).click();
  await page.getByRole("button", { name: "Cerrar los ajustes" }).click();
  await page.getByRole("button", { name: "Tu regalo" }).click();
  await page.getByRole("button", { name: "¡Ábrelo!" }).click();

  await expect(page.getByText("un abrazo")).toBeVisible();
  await expect(page.locator(".gift__reveal img")).toBeVisible();
});

test("the goal field refuses 0 and accepts 12, and the meter then reads against 12", async ({
  page
}) => {
  /* Some already banked, because the meter the new goal is read off does not
     exist for a child who has not earned anything yet. */
  await withBankedStars(page, STARS_PER_COMPLETION);
  await page.goto("/");
  await page.getByRole("button", { name: /^Quién juega/ }).click();
  await page.getByRole("button", { name: "Zona de adultos" }).click();
  await passAdultGate(page);

  const goalField = page.getByLabel("Letriestrellas para el próximo regalo");
  await goalField.fill("0");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Elige un número entre 5 y 200"
  );

  await goalField.fill("12");
  await page.getByRole("button", { name: "Guardar" }).click();
  await page.getByRole("button", { name: "Cerrar los ajustes" }).click();

  await expect(
    page.getByRole("meter", { name: "Letriestrellas hacia el próximo regalo" })
  ).toHaveAttribute("aria-valuemax", "12");
});

/*
 * The drawer is the one thing in this app that floats over the world, so it is
 * the one thing that can push the page out of the viewport without any other
 * test noticing. On a phone it is most of the screen; on a 4K panel it must not
 * stretch to the width of the room.
 */
test("the profile drawer fits the viewport and covers the world", async ({
  page
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Quién juega/ }).click();

  const drawer = page.getByRole("dialog", { name: "Quién juega" });
  await expect(drawer).toBeVisible();

  const viewport = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight
  }));
  const box = (await drawer.boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(viewport.width);
  expect(box.height).toBeLessThanOrEqual(viewport.height + 1);

  const scroll = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight
  }));
  expect(scroll.scrollWidth).toBeLessThanOrEqual(viewport.width);
  expect(scroll.scrollHeight).toBeLessThanOrEqual(viewport.height);

  /* The scrim is what makes the world behind it untouchable. */
  const scrim = (await page.locator(".profile-menu__scrim").boundingBox())!;
  expect(scrim.width).toBeGreaterThanOrEqual(viewport.width - 1);
  expect(scrim.height).toBeGreaterThanOrEqual(viewport.height - 1);
});

/*
 * The gate is the only surface in this app that covers everything, so it is the
 * only one whose own fit nothing else would catch. On a phone the pad has to
 * reach the thumb; on an 86-inch panel it must not stretch across the room.
 */
test("the adult gate covers the screen and its pad fits", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Quién juega/ }).click();
  await page.getByRole("button", { name: /^Editar a/ }).click();

  const gate = page.getByRole("dialog", { name: "Sólo para adultos" });
  await expect(gate).toBeVisible();

  const viewport = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight
  }));
  const box = (await gate.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(viewport.width - 1);
  expect(box.height).toBeGreaterThanOrEqual(viewport.height - 1);

  /* Every key inside the viewport, and each one big enough for a thumb. */
  for (const digit of "0123456789") {
    const key = (await page.getByRole("button", { name: digit }).boundingBox())!;
    expect(key.width).toBeGreaterThanOrEqual(44);
    expect(key.height).toBeGreaterThanOrEqual(44);
    expect(key.y + key.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(key.x + key.width).toBeLessThanOrEqual(viewport.width + 1);
  }

  const scroll = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight
  }));
  expect(scroll.scrollWidth).toBeLessThanOrEqual(viewport.width);
  expect(scroll.scrollHeight).toBeLessThanOrEqual(viewport.height);
});
