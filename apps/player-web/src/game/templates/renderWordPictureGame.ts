import * as Phaser from "phaser";
import { assertNever } from "@lectoemocion/domain";
import type { ManifestFor } from "@lectoemocion/resource-schema";
import {
  chooseWordPicture,
  createWordPictureRound
} from "@lectoemocion/template-sdk";
import { addLabel, addPicture, CARD, VocabularyCard } from "./vocabularyCard";

const CHOICE_ROW_Y = 500;

export function renderWordPictureGame(
  scene: Phaser.Scene,
  resource: ManifestFor<"word-picture-game">,
  onComplete: () => void
): void {
  let round = createWordPictureRound(resource);

  const banner = scene.add
    .text(640, 55, "¿Cuál es?", {
      fontFamily: "system-ui",
      fontSize: "40px",
      color: "#402060"
    })
    .setOrigin(0.5);

  /* The word card is display only — the prototype disabled it too. */
  new VocabularyCard(scene, 640, 190, 520, 150);
  addLabel(scene, round.word, 640, 190, 72);

  const cards = new Map<string, VocabularyCard>();
  const total = round.choices.length;
  const spacing = Math.min(CARD.size + 60, 1200 / total);

  round.choices.forEach((choice, index) => {
    const x = 640 + (index - (total - 1) / 2) * spacing;
    const card = new VocabularyCard(scene, x, CHOICE_ROW_Y);
    const picture = addPicture(scene, choice, x, CHOICE_ROW_Y, CARD.size);
    cards.set(choice.vocabularyItemId, card);

    card.onTap(() => {
      const result = chooseWordPicture(round, choice.vocabularyItemId);
      round = result.round;
      const outcome = result.attempt;

      switch (outcome.kind) {
        case "correct":
          card.paint(CARD.matched);
          banner.setText("¡Muy bien!");
          for (const other of cards.values()) other.disable();
          onComplete();
          return;
        /* The card goes back to white and every picture stays choosable. */
        case "incorrect":
          card.paint(CARD.wrong);
          card.shake([picture]);
          scene.time.delayedCall(500, () => card.paint(CARD.fill));
          return;
        case "ignored":
          return;
        default:
          assertNever(outcome, "word-picture attempt");
      }
    });
  });
}
