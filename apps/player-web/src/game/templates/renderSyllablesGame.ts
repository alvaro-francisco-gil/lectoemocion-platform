import * as Phaser from "phaser";
import { assertNever } from "@lectoemocion/domain";
import type { ManifestFor } from "@lectoemocion/resource-schema";
import {
  createSyllablesRound,
  placeSyllable,
  type SyllableCard
} from "@lectoemocion/template-sdk";
import { addPictureGlyph } from "./pictureGlyph";

const SLOT_ROW_Y = 420;
const TRAY_ROW_Y = 600;
const CARD_WIDTH = 150;
const CARD_HEIGHT = 110;

/**
 * Placement is tap-card-then-tap-slot rather than a drag.
 *
 * Touch, stylus, and mouse then map to one semantic action, which a drag
 * gesture does not on an aged panel digitiser. See
 * `docs/migration/minigame-specifications.md`.
 */
export function renderSyllablesGame(
  scene: Phaser.Scene,
  resource: ManifestFor<"syllables-game">,
  onComplete: () => void
): void {
  let round = createSyllablesRound(resource);
  let heldCardId: string | null = null;

  const banner = scene.add
    .text(640, 60, "Ordena las sílabas", {
      fontFamily: "system-ui",
      fontSize: "40px",
      color: "#402060"
    })
    .setOrigin(0.5);

  addPictureGlyph(scene, resource.vocabulary[0]?.vocabularyItemId ?? "", 640, 200, 80);

  const lives = scene.add
    .text(640, 310, "", {
      fontFamily: "system-ui",
      fontSize: "30px",
      color: "#7b2cbf"
    })
    .setOrigin(0.5);

  const columnX = (index: number, total: number) =>
    640 + (index - (total - 1) / 2) * Math.min(190, 1180 / total);

  const slotCount = round.slots.length;
  const slotFrames: Phaser.GameObjects.Rectangle[] = [];
  const slotLabels: Phaser.GameObjects.Text[] = [];

  for (let index = 0; index < slotCount; index += 1) {
    const x = columnX(index, slotCount);
    const frame = scene.add
      .rectangle(x, SLOT_ROW_Y, CARD_WIDTH, CARD_HEIGHT, 0xf1e6ff)
      .setStrokeStyle(6, 0x7b2cbf)
      .setInteractive({ useHandCursor: true });
    const label = scene.add
      .text(x, SLOT_ROW_Y, "", {
        fontFamily: "system-ui",
        fontSize: "40px",
        color: "#241133"
      })
      .setOrigin(0.5);
    frame.on("pointerdown", () => dropInto(index));
    slotFrames.push(frame);
    slotLabels.push(label);
  }

  interface TrayView {
    readonly frame: Phaser.GameObjects.Rectangle;
    readonly label: Phaser.GameObjects.Text;
    readonly home: number;
  }
  const trayViews = new Map<string, TrayView>();

  round.tray.forEach((card: SyllableCard, index) => {
    const x = columnX(index, round.tray.length);
    const frame = scene.add
      .rectangle(x, TRAY_ROW_Y, CARD_WIDTH, CARD_HEIGHT, 0xffffff)
      .setStrokeStyle(6, 0xf4845f)
      .setInteractive({ useHandCursor: true });
    const label = scene.add
      .text(x, TRAY_ROW_Y, card.syllable, {
        fontFamily: "system-ui",
        fontSize: "40px",
        color: "#241133"
      })
      .setOrigin(0.5);
    frame.on("pointerdown", () => {
      heldCardId = heldCardId === card.cardId ? null : card.cardId;
      paint();
    });
    trayViews.set(card.cardId, { frame, label, home: x });
  });

  function dropInto(slotIndex: number): void {
    if (!heldCardId) return;
    const cardId = heldCardId;
    const view = trayViews.get(cardId);
    const result = placeSyllable(round, cardId, slotIndex);
    round = result.round;
    const outcome = result.attempt;

    switch (outcome.kind) {
      case "placed":
        heldCardId = null;
        view?.frame.setVisible(false).disableInteractive();
        view?.label.setVisible(false);
        if (round.status === "won") {
          banner.setText("¡Muy bien!");
          onComplete();
        }
        paint();
        return;
      case "rejected":
        heldCardId = null;
        rejectSlot(slotIndex);
        if (round.status === "lost") {
          banner.setText("Vamos a intentarlo otra vez");
        }
        paint();
        return;
      case "ignored":
        return;
      default:
        assertNever(outcome, "syllable attempt");
    }
  }

  function rejectSlot(slotIndex: number): void {
    const frame = slotFrames[slotIndex];
    if (!frame) return;
    const home = frame.x;
    frame.setFillStyle(0xffadad);
    scene.tweens.add({
      targets: frame,
      x: { from: home - 12, to: home + 12 },
      yoyo: true,
      repeat: 2,
      duration: 70,
      onComplete: () => {
        frame.setX(home);
        paint();
      }
    });
  }

  function paint(): void {
    lives.setText(`Vidas: ${"♥".repeat(round.livesRemaining)}`);
    round.slots.forEach((slot, index) => {
      slotLabels[index]?.setText(slot ? slot.syllable : "");
      slotFrames[index]?.setFillStyle(slot ? 0x95d5b2 : 0xf1e6ff);
    });
    for (const [cardId, view] of trayViews) {
      view.frame.setStrokeStyle(cardId === heldCardId ? 10 : 6, 0xf4845f);
      view.frame.setFillStyle(cardId === heldCardId ? 0xffe8a3 : 0xffffff);
    }
  }

  paint();
}
