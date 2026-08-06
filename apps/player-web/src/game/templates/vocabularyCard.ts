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
  label: "#000000",
  /**
   * The part of a word the lesson is about.
   *
   * Used by the initial-syllable reveal to colour the syllable two words share.
   * It has to read against white at a distance without competing with the green
   * of a correct answer, so it is a deep magenta rather than another green or
   * the card's own purple.
   */
  emphasis: "#b3005e"
} as const;

/** Godot `Color(0.2, 0.95, 0.85)` — the syllables game's turquoise. */
export const SYLLABLE_BACKGROUND = 0x33f2d9;

/**
 * The initial-syllable game's field.
 *
 * A third field colour, cool where the letters game is warm and pale where the
 * syllables game is saturated, so the three vocabulary games are told apart
 * from across a classroom rather than by reading their banners.
 */
export const INITIAL_SYLLABLE_BACKGROUND = 0xa8d8ff;

/**
 * The letters game's field.
 *
 * A warm counterpart to the syllables turquoise, so the two ordering games are
 * told apart at a glance from across a classroom rather than by reading their
 * banners. Chosen to keep the white card and its purple border high-contrast.
 */
export const LETTER_BACKGROUND = 0xffd98a;

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

/**
 * What a card can carry: something drawn at a position, on a depth.
 *
 * Named structurally rather than as `Text | Image`, so a card that grows a
 * third kind of content does not need this union widened.
 */
type CardRider = Phaser.GameObjects.GameObject &
  Phaser.GameObjects.Components.Transform &
  Phaser.GameObjects.Components.Depth &
  Phaser.GameObjects.Components.Visible;

/** A rounded card. Phaser's Rectangle cannot round corners, so this draws. */
export class VocabularyCard {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly hit: Phaser.GameObjects.Zone;
  private fill: number = CARD.fill;
  private border: number = CARD.border;
  private borderWidth: number = CARD.borderWidth;
  /** What is drawn on the card and must travel with it when it moves. */
  private readonly riders: CardRider[] = [];

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
    this.draw(x, y);
  }

  private draw(centreX: number, centreY: number): void {
    this.graphics.clear();
    const left = centreX - this.width / 2;
    const top = centreY - this.height / 2;
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
    this.draw(this.hit.x, this.hit.y);
  }

  onTap(handler: () => void): void {
    this.hit.on("pointerdown", handler);
  }

  disable(): void {
    this.hit.disableInteractive();
  }

  /**
   * The interactive rectangle.
   *
   * Exposed so a scene can wire Phaser's own drag and drop events, which are
   * emitted by the input plugin against the game object rather than by the
   * card. Nothing outside `src/game/` sees this type.
   */
  get target(): Phaser.GameObjects.Zone {
    return this.hit;
  }

  /** Labels and pictures drawn on the card, so a drag carries them along. */
  carry(...riders: readonly CardRider[]): void {
    this.riders.push(...riders);
  }

  /** Lets a pointer drag this card around. */
  draggable(): void {
    this.hit.setInteractive({ useHandCursor: true, draggable: true });
    this.scene.input.setDraggable(this.hit);
  }

  /** Lets a dragged card be dropped onto this one. */
  acceptsDrop(): void {
    const input = this.hit.input;
    if (!input) throw new Error("A drop target must be interactive first");
    input.dropZone = true;
  }

  /** Moves the card, and everything on it, so its centre lands on (x, y). */
  moveTo(x: number, y: number): void {
    const shiftX = x - this.hit.x;
    const shiftY = y - this.hit.y;
    this.hit.setPosition(x, y);
    for (const rider of this.riders) {
      rider.setPosition(rider.x + shiftX, rider.y + shiftY);
    }
    this.draw(x, y);
  }

  /** Puts the card back where it was dealt. */
  returnHome(): void {
    this.moveTo(this.x, this.y);
  }

  /**
   * Takes the card off the screen — its drawing, its contents, and its pointer
   * target.
   *
   * A card that has been dragged somewhere and then consumed cannot be
   * *repainted* out of sight: it is no longer over the field it came from, so
   * filling it with the background colour leaves a blank card sitting wherever
   * the child let go — on top of the slot it just filled, covering the answer.
   * Clearing it is the only way that holds wherever it ended up.
   */
  hide(): void {
    this.graphics.clear();
    this.hit.disableInteractive();
    for (const rider of this.riders) {
      rider.setVisible(false);
    }
  }

  /**
   * Raises the card above the others.
   *
   * A dragged card that slides *under* the row it came from reads as having
   * been dropped already, so it is lifted for the length of the gesture.
   */
  lift(depth: number): void {
    this.graphics.setDepth(depth);
    for (const rider of this.riders) {
      rider.setDepth(depth);
    }
  }

  /** The prototype shook a wrong card; the shake moves card and contents. */
  shake(contents: readonly Phaser.GameObjects.GameObject[]): void {
    const home = this.x;
    const movers = [this.hit, ...this.riders, ...contents];
    this.scene.tweens.add({
      targets: movers,
      x: { from: home - 12, to: home + 12 },
      yoyo: true,
      repeat: 2,
      duration: 70,
      onUpdate: () => this.draw(this.hit.x, this.hit.y),
      onComplete: () => {
        for (const mover of movers) {
          if ("x" in mover) Reflect.set(mover, "x", home);
        }
        this.draw(home, this.hit.y);
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

/**
 * A word with its opening syllable picked out in colour.
 *
 * Two `Text` objects rather than one, because Phaser's `Text` carries a single
 * fill: `MA` in magenta and `NZANA` in black is two objects laid side by side
 * and centred as a pair. Returned as a pair so the caller can hide or move
 * them together.
 *
 * This is the lesson the initial-syllable game exists to deliver — the win is
 * only its occasion — so it lives beside the card rather than inside one
 * renderer.
 */
export function addEmphasisedWord(
  scene: Phaser.Scene,
  syllables: readonly string[],
  x: number,
  y: number,
  fontSize: number
): readonly [Phaser.GameObjects.Text, Phaser.GameObjects.Text] {
  const [opening, ...remainder] = syllables;
  if (opening === undefined) {
    throw new Error("A word with no syllables cannot be emphasised");
  }

  const style = {
    fontFamily: "system-ui",
    fontSize: `${fontSize}px`,
    fontStyle: "bold"
  } as const;
  const upper = (text: string) => text.toLocaleUpperCase("es-ES");

  const head = scene.add
    .text(0, y, upper(opening), { ...style, color: CARD.emphasis })
    .setOrigin(0, 0.5);
  const tail = scene.add
    .text(0, y, upper(remainder.join("")), { ...style, color: CARD.label })
    .setOrigin(0, 0.5);

  const left = x - (head.width + tail.width) / 2;
  head.setX(left);
  tail.setX(left + head.width);
  return [head, tail];
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
