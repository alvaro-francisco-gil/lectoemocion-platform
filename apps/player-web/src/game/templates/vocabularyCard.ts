import * as Phaser from "phaser";
import type { VocabularyItem } from "@lectoemocion/resource-schema";

/**
 * The prototype's card, reproduced.
 *
 * These values are the prototype's, converted from Godot's 0–1 colour floats:
 * a white card with a 6px purple border and a 20px corner radius, a picture
 * inset by 10px, and an uppercase black label. Matching it exactly is the point
 * — teachers already recognise this look.
 */
export const CARD = {
  size: 200,
  radius: 20,
  borderWidth: 6,
  border: 0xb359e6,
  fill: 0xffffff,
  matched: 0x80ff80,
  wrong: 0xff4d4d,
  selected: 0xffe8a3,
  inset: 10,
  label: "#000000"
} as const;

/** Godot `Color(0.2, 0.95, 0.85)` — the syllables game's turquoise. */
export const SYLLABLE_BACKGROUND = 0x33f2d9;

export function pictureKey(item: Pick<VocabularyItem, "vocabularyItemId">): string {
  return `vocabulary:${item.vocabularyItemId}`;
}

/**
 * Queues every picture a resource needs.
 *
 * Call from a scene's `preload`. A picture that fails to arrive is a missing
 * *default*, which fails closed (invariant 6) — `ResourceScene` reports it
 * rather than drawing a card with a hole in it.
 */
export function queueVocabularyPictures(
  scene: Phaser.Scene,
  items: readonly VocabularyItem[]
): void {
  for (const item of items) {
    scene.load.image(pictureKey(item), item.imageUrl);
  }
}

/** A rounded card. Phaser's Rectangle cannot round corners, so this draws. */
export class VocabularyCard {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly hit: Phaser.GameObjects.Zone;
  private fill: number = CARD.fill;
  private border: number = CARD.border;
  private borderWidth: number = CARD.borderWidth;

  constructor(
    private readonly scene: Phaser.Scene,
    public readonly x: number,
    public readonly y: number,
    private readonly width: number = CARD.size,
    private readonly height: number = CARD.size
  ) {
    this.graphics = scene.add.graphics();
    this.hit = scene.add
      .zone(x, y, width, height)
      .setInteractive({ useHandCursor: true });
    this.draw(x);
  }

  private draw(centreX: number): void {
    this.graphics.clear();
    const left = centreX - this.width / 2;
    const top = this.y - this.height / 2;
    this.graphics.fillStyle(this.fill, 1);
    this.graphics.fillRoundedRect(left, top, this.width, this.height, CARD.radius);
    this.graphics.lineStyle(this.borderWidth, this.border, 1);
    this.graphics.strokeRoundedRect(
      left,
      top,
      this.width,
      this.height,
      CARD.radius
    );
  }

  paint(
    fill: number,
    border: number = CARD.border,
    borderWidth: number = CARD.borderWidth
  ): void {
    this.fill = fill;
    this.border = border;
    this.borderWidth = borderWidth;
    this.draw(this.hit.x);
  }

  onTap(handler: () => void): void {
    this.hit.on("pointerdown", handler);
  }

  disable(): void {
    this.hit.disableInteractive();
  }

  /** The prototype shook a wrong card; the shake moves card and contents. */
  shake(contents: readonly Phaser.GameObjects.GameObject[]): void {
    const home = this.x;
    const movers = [this.hit, ...contents];
    this.scene.tweens.add({
      targets: movers,
      x: { from: home - 12, to: home + 12 },
      yoyo: true,
      repeat: 2,
      duration: 70,
      onUpdate: () => this.draw(this.hit.x),
      onComplete: () => {
        for (const mover of movers) {
          if ("x" in mover) Reflect.set(mover, "x", home);
        }
        this.draw(home);
      }
    });
  }
}

/** Fits a picture inside a card, preserving aspect, as the prototype did. */
export function addPicture(
  scene: Phaser.Scene,
  item: Pick<VocabularyItem, "vocabularyItemId">,
  x: number,
  y: number,
  boxSize: number
): Phaser.GameObjects.Image {
  const image = scene.add.image(x, y, pictureKey(item));
  const inner = boxSize - CARD.inset * 2;
  const scale = Math.min(inner / image.width, inner / image.height, 1);
  return image.setScale(scale);
}

/** The prototype uppercased every word and syllable label. */
export function addLabel(
  scene: Phaser.Scene,
  text: string,
  x: number,
  y: number,
  fontSize: number
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text.toLocaleUpperCase("es-ES"), {
      fontFamily: "system-ui",
      fontSize: `${fontSize}px`,
      color: CARD.label,
      fontStyle: "bold"
    })
    .setOrigin(0.5);
}
