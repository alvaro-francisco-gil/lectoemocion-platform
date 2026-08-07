import * as Phaser from "phaser";
import { assertNever } from "@lectoemocion/domain";
import type { ManifestFor } from "@lectoemocion/resource-schema";
import {
  createPairsRound,
  selectPairsCard,
  type PairsCard,
  type PairsRound
} from "@lectoemocion/template-sdk";
import { addLabel, addPicture, CARD, VocabularyCard } from "./vocabularyCard";

const PICTURE_ROW_Y = 360;
const WORD_ROW_Y = 590;

interface CardView {
  readonly card: PairsCard;
  readonly view: VocabularyCard;
  readonly contents: readonly Phaser.GameObjects.GameObject[];
}

export function renderPairsGame(
  scene: Phaser.Scene,
  resource: ManifestFor<"pairs-game">,
  onComplete: () => void
): void {
  let round = createPairsRound(resource);

  const banner = scene.add
    .text(640, 60, "Une cada dibujo con su palabra", {
      fontFamily: "system-ui",
      fontSize: "42px",
      color: "#402060"
    })
    .setOrigin(0.5);

  const views = new Map<string, CardView>();

  const rowOf = (group: PairsCard["group"]) =>
    round.cards.filter((card) => card.group === group);

  const place = (card: PairsCard, index: number, total: number, y: number) => {
    const spacing = Math.min(CARD.size + 40, 1200 / total);
    const x = 640 + (index - (total - 1) / 2) * spacing;
    const view = new VocabularyCard(scene, x, y);

    const contents =
      card.group === "picture"
        ? [addPicture(scene, card, x, y, CARD.size)]
        : [addLabel(scene, card.word, x, y, 40)];

    view.onTap(() => attempt(card.cardId));
    views.set(card.cardId, { card, view, contents });
  };

  const pictures = rowOf("picture");
  pictures.forEach((card, index) =>
    place(card, index, pictures.length, PICTURE_ROW_Y)
  );
  const words = rowOf("word");
  words.forEach((card, index) => place(card, index, words.length, WORD_ROW_Y));

  const paint = () => {
    for (const entry of views.values()) {
      if (round.matched.includes(entry.card.vocabularyItemId)) {
        entry.view.paint(CARD.matched);
        entry.view.disable();
      } else if (entry.card.cardId === round.selectedCardId) {
        entry.view.paint(CARD.selected, CARD.border, CARD.borderWidth + 2);
      } else {
        entry.view.paint(CARD.fill);
      }
    }
  };

  const shake = (cardIds: readonly string[]) => {
    for (const cardId of cardIds) {
      const entry = views.get(cardId);
      if (!entry) continue;
      entry.view.paint(CARD.wrong);
      entry.view.shake(entry.contents);
      scene.time.delayedCall(500, paint);
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
      /* The pair does not stick; nothing else about the board changes. */
      case "mismatched":
        paint();
        shake(outcome.cardIds);
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
  };

  paint();
}
