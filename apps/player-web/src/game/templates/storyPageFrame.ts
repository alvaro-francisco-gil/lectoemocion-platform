import * as Phaser from "phaser";
import type { StoryPage } from "@lectoemocion/resource-schema";

/**
 * The page as it sat in the source application: a white card on pale blue,
 * with the drawing filling it and the letter out in its own margin.
 *
 * `#E9F3FA` is that application's own page background, carried over so the
 * book still looks like itself. The card's white, purple border and corner
 * radius are the player's existing card — reused rather than restated, so
 * there is one answer to what a card looks like here.
 */
export const PAGE_BACKGROUND = "#e9f3fa";

/**
 * The picture box, in the player's 1280×720 logical space.
 *
 * Sized so a 4:3 page — every page in the book is 4:3 — leaves the lower band
 * clear for the controls a child actually touches.
 */
export const PAGE_BOX = { x: 640, y: 320, width: 760, height: 570 } as const;

export function pageKey(page: StoryPage): string {
  return `story-page:${page.pageId}`;
}

export function pageAudioKey(page: StoryPage): string {
  return `story-audio:${page.pageId}`;
}

/**
 * Queues every page picture a story needs.
 *
 * Pictures are preloaded together — about a megabyte for the whole book — so a
 * page turn never waits on the network. The recordings are not: see
 * `renderIllustratedStory`.
 */
export function queueStoryPictures(
  scene: Phaser.Scene,
  pages: readonly StoryPage[]
): void {
  for (const page of pages) {
    scene.load.image(pageKey(page), page.imageUrl);
  }
}

/** Fits a page inside the picture box, preserving its aspect. */
export function fitPage(image: Phaser.GameObjects.Image): void {
  const scale = Math.min(
    PAGE_BOX.width / image.width,
    PAGE_BOX.height / image.height
  );
  image.setScale(scale);
}
