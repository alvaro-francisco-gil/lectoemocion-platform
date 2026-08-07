import * as Phaser from "phaser";
import { assertNever } from "@lectoemocion/domain";
import type { ManifestFor, VocabularyItem } from "@lectoemocion/resource-schema";
import {
  chooseInitialSyllable,
  createInitialSyllableRound
} from "@lectoemocion/template-sdk";
import {
  choiceColumnX,
  INITIAL_SYLLABLE_LAYOUT
} from "./initialSyllableLayout";
import {
  addEmphasisedWord,
  addPicture,
  CARD,
  INITIAL_SYLLABLE_BACKGROUND,
  VocabularyCard
} from "./vocabularyCard";

const {
  canvasWidth,
  canvasHeight,
  bannerY,
  targetY,
  targetSize,
  targetWordY,
  choiceRowY,
  choiceSize,
  choiceWordY
} = INITIAL_SYLLABLE_LAYOUT;

/** Above the row, for the length of a gesture only. */
const DRAG_DEPTH = 10;

/**
 * Find the picture whose word opens with the same syllable as the one above.
 *
 * Answering is a **drag**, and only a drag: carry the picture up to the target.
 *
 * A tap does nothing here on purpose. It is held for the word recordings
 * (`docs/plans/ideas/audio.md`), where tapping a card will play its word —
 * the thing this game is teaching a child to hear. A gesture cannot both
 * answer and read aloud, so answering is the one that moved. See
 * [ADR 0011](../../../../../docs/decisions/0011-no-lives-and-drag-only-answers.md).
 *
 * The reveal is the lesson. Winning shows both words with the syllable they
 * share picked out in colour; the choice was only the occasion for seeing it.
 */
export function renderInitialSyllableGame(
  scene: Phaser.Scene,
  resource: ManifestFor<"initial-syllable-game">,
  onComplete: () => void
): void {
  let round = createInitialSyllableRound(resource);
  let answeredByDrag = false;

  scene.add
    .rectangle(
      canvasWidth / 2,
      canvasHeight / 2,
      canvasWidth,
      canvasHeight,
      INITIAL_SYLLABLE_BACKGROUND
    )
    .setDepth(-1);

  const banner = scene.add
    .text(canvasWidth / 2, bannerY, "¿Quién empieza igual?", {
      fontFamily: "system-ui",
      fontSize: "40px",
      color: "#123a5c"
    })
    .setOrigin(0.5);

  /* Shown, never chosen: the target is above the child reach band. */
  const targetCard = new VocabularyCard(
    scene,
    canvasWidth / 2,
    targetY,
    targetSize,
    targetSize
  );
  addPicture(scene, round.target, canvasWidth / 2, targetY, targetSize);
  targetCard.acceptsDrop();

  interface ChoiceView {
    readonly card: VocabularyCard;
    readonly picture: Phaser.GameObjects.Image;
    readonly x: number;
  }
  const choices = new Map<string, ChoiceView>();
  const itemOf = new Map<Phaser.GameObjects.GameObject, string>();

  round.choices.forEach((choice: VocabularyItem, index) => {
    const x = choiceColumnX(index, round.choices.length);
    const card = new VocabularyCard(scene, x, choiceRowY, choiceSize, choiceSize);
    const picture = addPicture(scene, choice, x, choiceRowY, choiceSize);
    card.carry(picture);
    card.draggable();
    choices.set(choice.vocabularyItemId, { card, picture, x });
    itemOf.set(card.target, choice.vocabularyItemId);
  });

  scene.input.on(
    Phaser.Input.Events.DRAG_START,
    (_pointer: Phaser.Input.Pointer, object: Phaser.GameObjects.GameObject) => {
      const itemId = itemOf.get(object);
      if (itemId === undefined) return;
      answeredByDrag = false;
      choices.get(itemId)?.card.lift(DRAG_DEPTH);
    }
  );

  scene.input.on(
    Phaser.Input.Events.DRAG,
    (
      _pointer: Phaser.Input.Pointer,
      object: Phaser.GameObjects.GameObject,
      dragX: number,
      dragY: number
    ) => {
      const itemId = itemOf.get(object);
      if (itemId === undefined) return;
      choices.get(itemId)?.card.moveTo(dragX, dragY);
    }
  );

  scene.input.on(
    Phaser.Input.Events.DROP,
    (
      _pointer: Phaser.Input.Pointer,
      object: Phaser.GameObjects.GameObject,
      dropped: Phaser.GameObjects.GameObject
    ) => {
      const itemId = itemOf.get(object);
      if (itemId === undefined || dropped !== targetCard.target) return;
      answeredByDrag = answer(itemId) === "correct";
    }
  );

  scene.input.on(
    Phaser.Input.Events.DRAG_END,
    (_pointer: Phaser.Input.Pointer, object: Phaser.GameObjects.GameObject) => {
      const itemId = itemOf.get(object);
      if (itemId === undefined) return;
      const view = choices.get(itemId);
      view?.card.lift(0);
      /* A picture let go anywhere but the target goes back to its place. */
      if (!answeredByDrag) view?.card.returnHome();
    }
  );

  function answer(vocabularyItemId: string): "correct" | "incorrect" | "ignored" {
    const view = choices.get(vocabularyItemId);
    const result = chooseInitialSyllable(round, vocabularyItemId);
    round = result.round;
    const outcome = result.attempt;

    switch (outcome.kind) {
      case "correct":
        view?.card.returnHome();
        view?.card.paint(CARD.matched);
        banner.setText("¡Muy bien!");
        for (const each of choices.values()) each.card.disable();
        targetCard.disable();
        reveal(vocabularyItemId);
        onComplete();
        return "correct";
      /* The picture goes back to the row and every choice stays draggable. */
      case "incorrect":
        view?.card.returnHome();
        view?.card.paint(CARD.wrong);
        view?.card.shake([]);
        scene.time.delayedCall(500, () => {
          if (round.status === "playing") view?.card.paint(CARD.fill);
        });
        return "incorrect";
      case "ignored":
        return "ignored";
      default:
        return assertNever(outcome, "initial-syllable attempt");
    }
  }

  /**
   * The lesson: both words, with the syllable they share picked out.
   *
   * The wrong answers are cleared rather than dimmed, so what is left on screen
   * is the pair being taught and nothing else.
   */
  function reveal(chosenItemId: string): void {
    for (const [itemId, view] of choices) {
      if (itemId !== chosenItemId) view.card.hide();
    }

    addEmphasisedWord(
      scene,
      round.target.syllables,
      canvasWidth / 2,
      targetWordY,
      52
    );

    const chosen = round.choices.find(
      (choice) => choice.vocabularyItemId === chosenItemId
    );
    const view = choices.get(chosenItemId);
    if (chosen && view) {
      addEmphasisedWord(scene, chosen.syllables, view.x, choiceWordY, 44);
    }
  }
}
