import * as Phaser from "phaser";
import { PAGE } from "./storyPageFrame";

/**
 * The furniture every book in this player shares.
 *
 * Two templates turn pages now — `illustrated-story` and `name-book` — and a
 * child who has learnt that `◀` and `▶` sit in the bottom band, and that the
 * list of pages is behind a button in the top-right, should not have to learn
 * it again for the second book. That is the reason this is one module rather
 * than a copied block: the controls are a convention, and a convention with two
 * declarations drifts.
 *
 * The curtain deliberately stayed with the illustrated story. It exists to hold
 * a page back until its narration has arrived, and the book of names has no
 * narration to wait for — a shared one would be a control with no meaning on
 * half its callers.
 */

export interface Pill {
  readonly setText: (value: string) => void;
  readonly setEnabled: (on: boolean) => void;
}

/**
 * One of the controls in the bottom band.
 *
 * Everything a child touches lives there (`PAGE.controlsY`), within reach of
 * the thumbs of a tablet held in two hands, and far from the top corners where
 * an adult's controls sit.
 */
export function createPill(
  scene: Phaser.Scene,
  options: {
    readonly x: number;
    readonly width: number;
    readonly text: string;
    readonly fill: number;
    readonly colour: string;
    readonly onTap: () => void;
  }
): Pill {
  const { x, width, text, fill, colour, onTap } = options;
  const shape = scene.add.graphics();
  const caption = scene.add
    .text(x, PAGE.controlsY, text, {
      fontFamily: "system-ui",
      fontSize: "26px",
      color: colour,
      fontStyle: "bold"
    })
    .setOrigin(0.5);
  const hit = scene.add
    .zone(x, PAGE.controlsY, width, 64)
    .setInteractive({ useHandCursor: true });
  hit.on("pointerdown", onTap);

  const draw = (enabled: boolean) => {
    shape.clear();
    shape.fillStyle(fill, enabled ? 1 : 0.35);
    shape.fillRoundedRect(x - width / 2, PAGE.controlsY - 30, width, 60, 30);
    shape.lineStyle(2, PAGE.controlEdge, enabled ? 1 : 0.35);
    shape.strokeRoundedRect(x - width / 2, PAGE.controlsY - 30, width, 60, 30);
  };
  draw(true);

  return {
    setText: (value: string) => caption.setText(value),
    setEnabled: (on: boolean) => {
      draw(on);
      caption.setAlpha(on ? 1 : 0.35);
      if (on) hit.setInteractive({ useHandCursor: true });
      else hit.disableInteractive();
    }
  };
}

/**
 * How far through the book, as a bar along the very bottom.
 *
 * Worth drawing for the same reason in both books: they are long enough that an
 * adult deciding whether to start one before break wants to see where the end
 * is.
 */
export function createProgressBar(scene: Phaser.Scene): {
  readonly draw: (index: number, total: number) => void;
} {
  const bar = scene.add.graphics();
  return {
    draw: (index: number, total: number) => {
      bar.clear();
      bar.fillStyle(PAGE.sheetEdge, 1);
      bar.fillRect(0, 714, 1280, 6);
      bar.fillStyle(PAGE.accent, 1);
      bar.fillRect(0, 714, (1280 * (index + 1)) / total, 6);
    }
  };
}

const OVERLAY_DEPTH = 100;
const PICKER_COLUMNS = 8;

/**
 * Every page, reachable in one press.
 *
 * This is what makes a long book usable in a twenty minute lesson: a teacher
 * working on `Ñ` opens `Ñ` instead of sitting through twenty-six letters first.
 * It sits at the top of the display, out of the band a child reaches during
 * play, and it is opened by a word rather than a picture because it is an
 * adult's control.
 */
export function createPicker(
  scene: Phaser.Scene,
  options: {
    /** What the button in the corner says: `Páginas`, `Letras`. */
    readonly buttonLabel: string;
    readonly title: string;
    readonly labels: readonly string[];
    readonly onPick: (index: number) => void;
  }
): { readonly highlight: (index: number) => void } {
  const { buttonLabel, title, labels, onPick } = options;

  const picker = scene.add
    .container(0, 0)
    .setDepth(OVERLAY_DEPTH)
    .setVisible(false);
  const cells: Phaser.GameObjects.Graphics[] = [];

  const cellCentre = (position: number) => ({
    x: 190 + (position % PICKER_COLUMNS) * 137,
    y: 160 + Math.floor(position / PICKER_COLUMNS) * 104
  });

  const button = scene.add
    .text(1216, 44, buttonLabel, {
      fontFamily: "system-ui",
      fontSize: "24px",
      color: PAGE.ink,
      backgroundColor: "#ffffff",
      padding: { x: 16, y: 10 }
    })
    .setOrigin(1, 0.5)
    .setInteractive({ useHandCursor: true });
  button.on("pointerdown", () => picker.setVisible(!picker.visible));

  const veil = scene.add
    .rectangle(640, 360, 1280, 720, 0x1b2a3a, 0.85)
    .setInteractive();
  veil.on("pointerdown", () => picker.setVisible(false));
  picker.add(veil);
  picker.add(
    scene.add
      .text(640, 62, title, {
        fontFamily: "system-ui",
        fontSize: "34px",
        color: "#ffffff",
        fontStyle: "bold"
      })
      .setOrigin(0.5)
  );

  labels.forEach((label, index) => {
    const { x, y } = cellCentre(index);
    const cell = scene.add.graphics();
    cells.push(cell);

    /* A one- or two-character label is a letter; anything longer is a word. */
    const caption = scene.add
      .text(x, y, label, {
        fontFamily: "system-ui",
        fontSize: label.length > 2 ? "20px" : "30px",
        color: "#ffffff",
        fontStyle: "bold"
      })
      .setOrigin(0.5);

    const hit = scene.add.zone(x, y, 124, 88).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => {
      picker.setVisible(false);
      onPick(index);
    });

    picker.add([cell, caption, hit]);
  });

  return {
    highlight: (index: number) => {
      cells.forEach((cell, position) => {
        const { x, y } = cellCentre(position);
        cell.clear();
        cell.fillStyle(position === index ? PAGE.accent : 0x3d5163, 1);
        cell.fillRoundedRect(x - 62, y - 44, 124, 88, 14);
      });
    }
  };
}
