import * as Phaser from "phaser";
import { assertNever } from "@lectoemocion/domain";
import type { ManifestFor } from "@lectoemocion/resource-schema";
import {
  createLettersRound,
  placeLetter,
  type LetterAttempt,
  type LetterCard
} from "@lectoemocion/template-sdk";
import { LETTERS_LAYOUT, letterColumnX } from "./lettersLayout";
import {
  addLabel,
  addPicture,
  CARD,
  LETTER_BACKGROUND,
  VocabularyCard
} from "./vocabularyCard";

const {
  canvasWidth,
  canvasHeight,
  pictureY,
  trayRowY,
  slotRowY,
  cardWidth,
  cardHeight
} = LETTERS_LAYOUT;

/** Above the rows, for the length of a gesture only. */
const DRAG_DEPTH = 10;

/**
 * Spell the pictured word by dragging its letters into place.
 *
 * Placement is a **drag**, and only a drag. A letter let go anywhere but its
 * own slot goes back to the row it came from and nothing else happens: there is
 * no budget to spend, so a child can miss as often as they like and still
 * finish the word.
 *
 * A tap does nothing here on purpose. It is held for the word recordings
 * (`docs/plans/ideas/audio.md`), where tapping a card will sound out its
 * letter. A gesture cannot both place a card and read it aloud, so placing is
 * the one that moved. See
 * [ADR 0011](../../../../../docs/decisions/0011-no-lives-and-drag-only-answers.md).
 *
 * Both rows sit in the lower reach band. A three-year-old cannot touch the top
 * of an 86-inch panel, so the picture is the only thing up there.
 */
export function renderLettersGame(
  scene: Phaser.Scene,
  resource: ManifestFor<"letters-game">,
  onComplete: () => void
): void {
  let round = createLettersRound(resource);
  let placedByDrag = false;

  scene.add
    .rectangle(
      canvasWidth / 2,
      canvasHeight / 2,
      canvasWidth,
      canvasHeight,
      LETTER_BACKGROUND
    )
    .setDepth(-1);

  const banner = scene.add
    .text(canvasWidth / 2, 45, "Ordena las letras", {
      fontFamily: "system-ui",
      fontSize: "40px",
      color: "#5a3b00"
    })
    .setOrigin(0.5);

  const target = resource.vocabulary[0];
  if (target) {
    new VocabularyCard(scene, canvasWidth / 2, pictureY, 200, 200);
    addPicture(scene, target, canvasWidth / 2, pictureY, 200);
  }

  const slots: VocabularyCard[] = [];
  const slotLabels: Phaser.GameObjects.Text[] = [];
  /* Phaser reports drops against the game object, so each row is indexed by it. */
  const slotOf = new Map<Phaser.GameObjects.GameObject, number>();

  round.slots.forEach((_empty, index) => {
    const x = letterColumnX(index, round.slots.length);
    const slot = new VocabularyCard(scene, x, slotRowY, cardWidth, cardHeight);
    const label = addLabel(scene, "", x, slotRowY, 48);
    slot.carry(label);
    slot.acceptsDrop();
    slots.push(slot);
    slotLabels.push(label);
    slotOf.set(slot.target, index);
  });

  /* The card carries its own letter, so the card alone is the whole view. */
  const tray = new Map<string, VocabularyCard>();
  const cardOf = new Map<Phaser.GameObjects.GameObject, string>();

  round.tray.forEach((letter: LetterCard, index) => {
    const x = letterColumnX(index, round.tray.length);
    const card = new VocabularyCard(scene, x, trayRowY, cardWidth, cardHeight);
    card.carry(addLabel(scene, letter.letter, x, trayRowY, 48));
    card.draggable();
    tray.set(letter.cardId, card);
    cardOf.set(card.target, letter.cardId);
  });

  scene.input.on(
    Phaser.Input.Events.DRAG_START,
    (_pointer: Phaser.Input.Pointer, object: Phaser.GameObjects.GameObject) => {
      const cardId = cardOf.get(object);
      if (cardId === undefined) return;
      placedByDrag = false;
      tray.get(cardId)?.lift(DRAG_DEPTH);
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
      const cardId = cardOf.get(object);
      if (cardId === undefined) return;
      tray.get(cardId)?.moveTo(dragX, dragY);
    }
  );

  scene.input.on(
    Phaser.Input.Events.DROP,
    (
      _pointer: Phaser.Input.Pointer,
      object: Phaser.GameObjects.GameObject,
      dropped: Phaser.GameObjects.GameObject
    ) => {
      const cardId = cardOf.get(object);
      const slotIndex = slotOf.get(dropped);
      if (cardId === undefined || slotIndex === undefined) return;
      placedByDrag = place(cardId, slotIndex) === "placed";
    }
  );

  scene.input.on(
    Phaser.Input.Events.DRAG_END,
    (_pointer: Phaser.Input.Pointer, object: Phaser.GameObjects.GameObject) => {
      const cardId = cardOf.get(object);
      if (cardId === undefined) return;
      const card = tray.get(cardId);
      card?.lift(0);
      /* A letter let go anywhere but its slot goes back where it was dealt. */
      if (!placedByDrag) card?.returnHome();
    }
  );

  function place(cardId: string, slotIndex: number): LetterAttempt["kind"] {
    const held = tray.get(cardId);
    const result = placeLetter(round, cardId, slotIndex);
    round = result.round;
    const outcome = result.attempt;

    switch (outcome.kind) {
      case "placed":
        /* The letter is in the slot now; the card that carried it is spent. */
        held?.hide();
        paint();
        if (round.status === "won") {
          banner.setText("¡Muy bien!");
          onComplete();
        }
        return "placed";
      case "rejected": {
        const slot = slots[slotIndex];
        slot?.paint(CARD.wrong);
        slot?.shake([]);
        scene.time.delayedCall(500, paint);
        return "rejected";
      }
      default:
        return assertNever(outcome, "letter attempt");
    }
  }

  function paint(): void {
    round.slots.forEach((filled, index) => {
      slotLabels[index]?.setText(
        filled ? filled.letter.toLocaleUpperCase("es-ES") : ""
      );
      slots[index]?.paint(filled ? CARD.matched : CARD.fill);
    });
  }

  paint();
}
