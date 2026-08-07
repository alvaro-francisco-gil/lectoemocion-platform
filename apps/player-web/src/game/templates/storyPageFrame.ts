import * as Phaser from "phaser";
import type { StoryPage } from "@lectoemocion/resource-schema";

/**
 * The reading surface, reproduced from the application the book shipped with.
 *
 * These values are that application's, converted from its stylesheet: a white
 * page with a soft grey edge, and a green play control in the bottom corner.
 * Matching it is the point — this is the screen the author and her readers
 * already know.
 *
 * Its pale blue field is the one value not reproduced. A book is a chapter like
 * any other, and every chapter now stands on the colour of the card that opened
 * it, so the field comes from the shell (`app/cardTints.ts`) and the page sits
 * on whatever colour this book is.
 *
 * This is to a story what `CARD` is to a vocabulary game: the look lives in one
 * place so a second title cannot quietly acquire a different one.
 */
export const PAGE = {
  sheet: 0xffffff,
  sheetEdge: 0xd8e3ee,
  ink: "#2b3a4a",
  quiet: "#6a7c8d",
  accent: 0x2f9e44,
  control: 0xffffff,
  controlEdge: 0xc3d2e0,
  radius: 18,
  /** The white margin around the drawing, on every side. */
  margin: 14,
  /* The page box. Scans are 4:3, so height is what binds; the width is slack. */
  boxWidth: 940,
  boxHeight: 560,
  centreX: 640,
  centreY: 336,
  /** Everything a child touches sits in the bottom band of the display. */
  controlsY: 654
} as const;

export function storyPictureKey(page: StoryPage): string {
  return `story-image:${page.pageId}`;
}

export function storyAudioKey(page: StoryPage): string {
  return `story-audio:${page.pageId}`;
}

/**
 * Queues every picture a story needs.
 *
 * Call from a scene's `preload`. The pictures are the cheap half of a book —
 * about a megabyte for thirty-one pages against five for the recordings — and
 * a page that turns to a picture still arriving reads as broken, so these come
 * up front and fail closed together (invariant 6). The recordings do not:
 * they are fetched a page at a time as the book plays.
 */
export function queueStoryPictures(
  scene: Phaser.Scene,
  pages: readonly StoryPage[]
): void {
  for (const page of pages) {
    scene.load.image(storyPictureKey(page), page.imageUrl);
  }
}

/**
 * Lays a page on the sheet: the drawing fitted to the box, the white page drawn
 * to whatever size that turned out to be.
 *
 * The sheet is sized from the picture rather than fixed, so a story whose pages
 * are not 4:3 gets a page that fits its drawings instead of a letterbox.
 */
export function layOutPage(
  sheet: Phaser.GameObjects.Graphics,
  picture: Phaser.GameObjects.Image
): void {
  const scale = Math.min(
    PAGE.boxWidth / picture.width,
    PAGE.boxHeight / picture.height,
    1
  );
  picture.setScale(scale).setPosition(PAGE.centreX, PAGE.centreY);

  const width = picture.width * scale + PAGE.margin * 2;
  const height = picture.height * scale + PAGE.margin * 2;
  const left = PAGE.centreX - width / 2;
  const top = PAGE.centreY - height / 2;

  sheet.clear();
  sheet.fillStyle(PAGE.sheet, 1);
  sheet.fillRoundedRect(left, top, width, height, PAGE.radius);
  sheet.lineStyle(2, PAGE.sheetEdge, 1);
  sheet.strokeRoundedRect(left, top, width, height, PAGE.radius);
}
