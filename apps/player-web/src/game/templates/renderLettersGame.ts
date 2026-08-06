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
  livesY,
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
 * Placement is a **drag**, with tap-the-card then tap-the-slot kept alongside
 * it. The two gestures call the same `placeLetter`, so they cannot diverge.
 * The tap path is not a legacy leftover: `docs/migration/minigame-specifications.md`
 * records that a drag does not survive an aged classroom panel's digitiser
 * equally across touch, stylus, and mouse, so a child who cannot complete a
 * drag on that hardware still has a way to play.
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
  /** The card a tap selected, waiting for a slot. */
  let heldCardId: string | null = null;
  /** The card a pointer is carrying, if the input plugin has reported a drag. */
  let dragging: string | null = null;
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

  const lives = scene.add
    .text(canvasWidth / 2, livesY, "", {
      fontFamily: "system-ui",
      fontSize: "30px",
      color: "#5a3b00"
    })
    .setOrigin(0.5);

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
    slot.onTap(() => dropInto(index));
    slots.push(slot);
    slotLabels.push(label);
    slotOf.set(slot.target, index);
  });

  interface TrayView {
    readonly card: VocabularyCard;
    readonly label: Phaser.GameObjects.Text;
  }
  const tray = new Map<string, TrayView>();
  const cardOf = new Map<Phaser.GameObjects.GameObject, string>();

  round.tray.forEach((letter: LetterCard, index) => {
    const x = letterColumnX(index, round.tray.length);
    const card = new VocabularyCard(scene, x, trayRowY, cardWidth, cardHeight);
    const label = addLabel(scene, letter.letter, x, trayRowY, 48);
    card.carry(label);
    card.draggable();
    tray.set(letter.cardId, { card, label });
    cardOf.set(card.target, letter.cardId);

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
      heldCardId = heldCardId === letter.cardId ? null : letter.cardId;
      paint();
    });
  });

  scene.input.on(
    Phaser.Input.Events.DRAG_START,
    (_pointer: Phaser.Input.Pointer, object: Phaser.GameObjects.GameObject) => {
      const cardId = cardOf.get(object);
      if (cardId === undefined) return;
      dragging = cardId;
      placedByDrag = false;
      /* A drag is its own selection; a stale held card would place the wrong one. */
      heldCardId = null;
      tray.get(cardId)?.card.lift(DRAG_DEPTH);
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
      const cardId = cardOf.get(object);
      if (cardId === undefined) return;
      tray.get(cardId)?.card.moveTo(dragX, dragY);
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
      const view = tray.get(cardId);
      view?.card.lift(0);
      /* A letter let go anywhere but its slot goes back where it was dealt. */
      if (!placedByDrag) view?.card.returnHome();
      dragging = null;
      paint();
    }
  );

  /** The tap path: a held card, released onto a slot. */
  function dropInto(slotIndex: number): void {
    if (!heldCardId) return;
    place(heldCardId, slotIndex);
  }

  function place(cardId: string, slotIndex: number): LetterAttempt["kind"] {
    const held = tray.get(cardId);
    const result = placeLetter(round, cardId, slotIndex);
    round = result.round;
    const outcome = result.attempt;

    switch (outcome.kind) {
      case "placed":
        heldCardId = null;
        held?.card.disable();
        held?.card.paint(CARD.fill, LETTER_BACKGROUND, 0);
        held?.label.setVisible(false);
        if (round.status === "won") {
          banner.setText("¡Muy bien!");
          onComplete();
        }
        paint();
        return "placed";
      case "rejected": {
        heldCardId = null;
        const slot = slots[slotIndex];
        slot?.paint(CARD.wrong);
        slot?.shake([]);
        if (round.status === "lost") {
          banner.setText("Vamos a intentarlo otra vez");
        }
        scene.time.delayedCall(500, paint);
        paint();
        return "rejected";
      }
      case "ignored":
        return "ignored";
      default:
        return assertNever(outcome, "letter attempt");
    }
  }

  function paint(): void {
    lives.setText(`Vidas: ${"♥".repeat(round.livesRemaining)}`);
    round.slots.forEach((filled, index) => {
      slotLabels[index]?.setText(
        filled ? filled.letter.toLocaleUpperCase("es-ES") : ""
      );
      slots[index]?.paint(filled ? CARD.matched : CARD.fill);
    });
    for (const [cardId, view] of tray) {
      if (!round.tray.some((each) => each.cardId === cardId)) continue;
      view.card.paint(
        cardId === heldCardId ? CARD.selected : CARD.fill,
        CARD.border,
        cardId === heldCardId ? CARD.borderWidth + 4 : CARD.borderWidth
      );
    }
  }

  paint();
}
