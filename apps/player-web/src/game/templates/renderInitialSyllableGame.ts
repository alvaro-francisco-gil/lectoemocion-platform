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
  livesY,
  choiceRowY,
  choiceSize,
  choiceWordY
} = INITIAL_SYLLABLE_LAYOUT;

/** Above the row, for the length of a gesture only. */
const DRAG_DEPTH = 10;

/**
 * Find the picture whose word opens with the same syllable as the one above.
 *
 * Answering is a **drag** — carry the picture up to the target — with
 * tap-the-choice then tap-the-target kept alongside it, both calling the same
 * `chooseInitialSyllable`, so the two gestures cannot disagree about the
 * answer. That is the letters game's arrangement, and
 * `docs/migration/minigame-specifications.md` records why the tap path is not a
 * leftover: a drag does not survive an aged classroom panel's digitiser equally
 * across touch, stylus, and mouse.
 *
 * Keeping a plain tap *out* of the answer is also what leaves it free: when
 * word recordings exist (`docs/plans/ideas/audio.md`), tapping a card plays its
 * word and the way a child answers does not change.
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
  /** The card a tap selected, waiting for the target. */
  let heldItemId: string | null = null;
  /** The card a pointer is carrying, if the input plugin has reported a drag. */
  let dragging: string | null = null;
  let answeredByDrag = false;
  /**
   * Cards showing the red of a wrong answer.
   *
   * `paint` repaints every choice from held-or-not, which would wipe that red
   * off in the same frame it appeared. A card is excused from repainting for as
   * long as it is flashing.
   */
  const flashing = new Set<string>();

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
  targetCard.onTap(() => answerWithHeldCard());

  const lives = scene.add
    .text(canvasWidth / 2, livesY, "", {
      fontFamily: "system-ui",
      fontSize: "30px",
      color: "#123a5c"
    })
    .setOrigin(0.5);

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

    /*
     * Tapping selects; dragging does not. A drag begins with a pointer down on
     * the same card, so selection is decided on release and suppressed once the
     * input plugin has reported a drag.
     */
    card.target.on("pointerdown", () => {
      dragging = null;
    });
    card.target.on("pointerup", () => {
      if (dragging !== null) return;
      heldItemId =
        heldItemId === choice.vocabularyItemId ? null : choice.vocabularyItemId;
      paint();
    });
  });

  scene.input.on(
    Phaser.Input.Events.DRAG_START,
    (_pointer: Phaser.Input.Pointer, object: Phaser.GameObjects.GameObject) => {
      const itemId = itemOf.get(object);
      if (itemId === undefined) return;
      dragging = itemId;
      answeredByDrag = false;
      /* A drag is its own selection; a stale held card would answer with it. */
      heldItemId = null;
      choices.get(itemId)?.card.lift(DRAG_DEPTH);
      paint();
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
      dragging = null;
      paint();
    }
  );

  /** The tap path: a held card, released onto the target. */
  function answerWithHeldCard(): void {
    if (!heldItemId) return;
    answer(heldItemId);
  }

  function answer(vocabularyItemId: string): "correct" | "incorrect" | "ignored" {
    const view = choices.get(vocabularyItemId);
    const result = chooseInitialSyllable(round, vocabularyItemId);
    round = result.round;
    const outcome = result.attempt;

    switch (outcome.kind) {
      case "correct":
        heldItemId = null;
        view?.card.returnHome();
        view?.card.paint(CARD.matched);
        banner.setText("¡Muy bien!");
        for (const each of choices.values()) each.card.disable();
        targetCard.disable();
        reveal(vocabularyItemId);
        paint();
        onComplete();
        return "correct";
      case "incorrect":
        heldItemId = null;
        /* A picture dropped on the target is back in the row before it shakes. */
        view?.card.returnHome();
        view?.card.paint(CARD.wrong);
        view?.card.shake([]);
        flashing.add(vocabularyItemId);
        scene.time.delayedCall(500, () => {
          flashing.delete(vocabularyItemId);
          if (round.status === "playing") view?.card.paint(CARD.fill);
        });
        if (round.status === "lost") {
          banner.setText("Vamos a intentarlo otra vez");
          for (const each of choices.values()) each.card.disable();
          targetCard.disable();
        }
        paint();
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
    lives.setVisible(false);

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

  function paint(): void {
    lives.setText(`Vidas: ${"♥".repeat(round.livesRemaining)}`);
    for (const [itemId, view] of choices) {
      if (round.status !== "playing" || flashing.has(itemId)) continue;
      view.card.paint(
        itemId === heldItemId ? CARD.selected : CARD.fill,
        CARD.border,
        itemId === heldItemId ? CARD.borderWidth + 4 : CARD.borderWidth
      );
    }
  }

  paint();
}
