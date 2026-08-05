import * as Phaser from "phaser";
import { assertNever } from "@lectoemocion/domain";
import type { ManifestFor } from "@lectoemocion/resource-schema";
import {
  createPairsRound,
  selectPairsCard,
  type PairsCard,
  type PairsRound
} from "@lectoemocion/template-sdk";
import { addPictureGlyph } from "./pictureGlyph";

const CARD_WIDTH = 200;
const CARD_HEIGHT = 150;
const PICTURE_ROW_Y = 390;
const WORD_ROW_Y = 570;

interface CardView {
  readonly card: PairsCard;
  readonly frame: Phaser.GameObjects.Rectangle;
  readonly home: number;
}

export function renderPairsGame(
  scene: Phaser.Scene,
  resource: ManifestFor<"pairs-game">,
  onComplete: () => void
): void {
  let round = createPairsRound(resource);

  const banner = scene.add
    .text(640, 70, "Une cada dibujo con su palabra", {
      fontFamily: "system-ui",
      fontSize: "42px",
      color: "#402060"
    })
    .setOrigin(0.5);

  const lives = scene.add
    .text(640, 140, "", { fontFamily: "system-ui", fontSize: "30px", color: "#7b2cbf" })
    .setOrigin(0.5);

  const views = new Map<string, CardView>();

  const rowOf = (group: PairsCard["group"]) =>
    round.cards.filter((card) => card.group === group);

  const place = (card: PairsCard, index: number, total: number, y: number) => {
    const spacing = Math.min(240, 1180 / total);
    const x = 640 + (index - (total - 1) / 2) * spacing;
    const frame = scene.add
      .rectangle(x, y, CARD_WIDTH, CARD_HEIGHT, 0xffffff)
      .setStrokeStyle(6, 0x7b2cbf)
      .setInteractive({ useHandCursor: true });

    if (card.group === "picture") {
      addPictureGlyph(scene, card.vocabularyItemId, x, y, 48);
    } else {
      scene.add
        .text(x, y, card.word, {
          fontFamily: "system-ui",
          fontSize: "36px",
          color: "#241133"
        })
        .setOrigin(0.5);
    }

    frame.on("pointerdown", () => attempt(card.cardId));
    views.set(card.cardId, { card, frame, home: x });
  };

  const pictures = rowOf("picture");
  pictures.forEach((card, index) =>
    place(card, index, pictures.length, PICTURE_ROW_Y)
  );
  const words = rowOf("word");
  words.forEach((card, index) => place(card, index, words.length, WORD_ROW_Y));

  const paint = () => {
    lives.setText(`Vidas: ${"♥".repeat(round.livesRemaining)}`);
    for (const view of views.values()) {
      if (round.matched.includes(view.card.vocabularyItemId)) {
        view.frame.setFillStyle(0x95d5b2).disableInteractive();
      } else if (view.card.cardId === round.selectedCardId) {
        view.frame.setFillStyle(0xffe8a3).setStrokeStyle(8, 0xf4845f);
      } else {
        view.frame.setFillStyle(0xffffff).setStrokeStyle(6, 0x7b2cbf);
      }
    }
  };

  const shake = (cardIds: readonly string[]) => {
    for (const cardId of cardIds) {
      const view = views.get(cardId);
      if (!view) continue;
      view.frame.setFillStyle(0xffadad);
      scene.tweens.add({
        targets: view.frame,
        x: { from: view.home - 12, to: view.home + 12 },
        yoyo: true,
        repeat: 2,
        duration: 70,
        onComplete: () => {
          view.frame.setX(view.home);
          paint();
        }
      });
    }
  };

  function attempt(cardId: string): void {
    const selection = selectPairsCard(round, cardId);
    round = selection.round;
    const outcome = selection.attempt;

    switch (outcome.kind) {
      case "selected":
      case "cleared":
      case "ignored":
        paint();
        return;
      case "matched":
        paint();
        finish(round);
        return;
      case "mismatched":
        paint();
        shake(outcome.cardIds);
        finish(round);
        return;
      default:
        assertNever(outcome, "pairs attempt");
    }
  }

  const finish = (current: PairsRound) => {
    if (current.status === "won") {
      banner.setText("¡Muy bien!");
      onComplete();
    }
    if (current.status === "lost") banner.setText("Vamos a intentarlo otra vez");
  };

  paint();
}
