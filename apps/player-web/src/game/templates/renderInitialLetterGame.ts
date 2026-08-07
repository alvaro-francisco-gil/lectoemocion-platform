import * as Phaser from "phaser";
import { assertNever } from "@lectoemocion/domain";
import type { ManifestFor } from "@lectoemocion/resource-schema";
import {
  createInitialLetterRound,
  selectInitialLetterCard,
  type InitialLetterCard,
  type InitialLetterRound
} from "@lectoemocion/template-sdk";
import {
  INITIAL_LETTER_LAYOUT as LAYOUT,
  initialLetterColumnX
} from "./initialLetterLayout";
import { addLabel, addPicture, CARD, VocabularyCard } from "./vocabularyCard";

interface CardView {
  readonly card: InitialLetterCard;
  readonly view: VocabularyCard;
  readonly contents: readonly Phaser.GameObjects.GameObject[];
}

export function renderInitialLetterGame(
  scene: Phaser.Scene,
  resource: ManifestFor<"initial-letter-game">,
  onComplete: () => void
): void {
  let round = createInitialLetterRound(resource);

  const centreX = LAYOUT.canvasWidth / 2;

  const banner = scene.add
    .text(centreX, LAYOUT.bannerY, "Une cada dibujo con su primera letra", {
      fontFamily: "system-ui",
      fontSize: "42px",
      color: "#402060"
    })
    .setOrigin(0.5);

  const views = new Map<string, CardView>();

  const rowOf = (group: InitialLetterCard["group"]) =>
    round.cards.filter((card) => card.group === group);

  const place = (card: InitialLetterCard, index: number, total: number) => {
    const x = initialLetterColumnX(index, total);

    const [y, size] =
      card.group === "picture"
        ? ([LAYOUT.pictureRowY, CARD.size] as const)
        : ([LAYOUT.letterRowY, LAYOUT.letterCardSize] as const);
    const view = new VocabularyCard(scene, x, y, size, size);

    const contents =
      card.group === "picture"
        ? [addPicture(scene, card, x, y, size)]
        : [addLabel(scene, card.initial, x, y, LAYOUT.letterFontSize)];

    view.onTap(() => attempt(card.cardId));
    views.set(card.cardId, { card, view, contents });
  };

  const pictures = rowOf("picture");
  pictures.forEach((card, index) => place(card, index, pictures.length));
  const letters = rowOf("letter");
  letters.forEach((card, index) => place(card, index, letters.length));

  const paint = () => {
    for (const entry of views.values()) {
      if (round.matched.includes(entry.card.initial)) {
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
    const selection = selectInitialLetterCard(round, cardId);
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
      /* The connection does not stick; nothing else about the board changes. */
      case "mismatched":
        paint();
        shake(outcome.cardIds);
        return;
      default:
        assertNever(outcome, "initial-letter attempt");
    }
  }

  const finish = (current: InitialLetterRound) => {
    if (current.status === "won") {
      banner.setText("¡Muy bien!");
      onComplete();
    }
  };

  paint();
}
