import * as Phaser from "phaser";
import { assertNever } from "@lectoemocion/domain";
import type { ManifestFor } from "@lectoemocion/resource-schema";
import {
  createSyllablesRound,
  placeSyllable,
  type SyllableCard
} from "@lectoemocion/template-sdk";
import {
  addLabel,
  addPicture,
  CARD,
  SYLLABLE_BACKGROUND,
  VocabularyCard
} from "./vocabularyCard";

const SLOT_ROW_Y = 430;
const TRAY_ROW_Y = 610;
const SLOT_WIDTH = 150;
const SLOT_HEIGHT = 110;

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

  /* The prototype's turquoise field. */
  scene.add
    .rectangle(640, 360, 1280, 720, SYLLABLE_BACKGROUND)
    .setDepth(-1);

  const banner = scene.add
    .text(640, 45, "Ordena las sílabas", {
      fontFamily: "system-ui",
      fontSize: "40px",
      color: "#0f4f47"
    })
    .setOrigin(0.5);

  const target = resource.vocabulary[0];
  if (target) {
    new VocabularyCard(scene, 640, 210, 240, 240);
    addPicture(scene, target, 640, 210, 240);
  }

  const lives = scene.add
    .text(640, 350, "", {
      fontFamily: "system-ui",
      fontSize: "30px",
      color: "#0f4f47"
    })
    .setOrigin(0.5);

  const columnX = (index: number, total: number) =>
    640 + (index - (total - 1) / 2) * Math.min(190, 1180 / total);

  const slotCount = round.slots.length;
  const slots: VocabularyCard[] = [];
  const slotLabels: Phaser.GameObjects.Text[] = [];

  for (let index = 0; index < slotCount; index += 1) {
    const x = columnX(index, slotCount);
    const slot = new VocabularyCard(scene, x, SLOT_ROW_Y, SLOT_WIDTH, SLOT_HEIGHT);
    slot.onTap(() => dropInto(index));
    slots.push(slot);
    slotLabels.push(addLabel(scene, "", x, SLOT_ROW_Y, 40));
  }

  interface TrayView {
    readonly card: VocabularyCard;
    readonly label: Phaser.GameObjects.Text;
  }
  const tray = new Map<string, TrayView>();

  round.tray.forEach((syllable: SyllableCard, index) => {
    const x = columnX(index, round.tray.length);
    const card = new VocabularyCard(scene, x, TRAY_ROW_Y, SLOT_WIDTH, SLOT_HEIGHT);
    const label = addLabel(scene, syllable.syllable, x, TRAY_ROW_Y, 40);
    card.onTap(() => {
      heldCardId = heldCardId === syllable.cardId ? null : syllable.cardId;
      paint();
    });
    tray.set(syllable.cardId, { card, label });
  });

  function dropInto(slotIndex: number): void {
    if (!heldCardId) return;
    const cardId = heldCardId;
    const held = tray.get(cardId);
    const result = placeSyllable(round, cardId, slotIndex);
    round = result.round;
    const outcome = result.attempt;

    switch (outcome.kind) {
      case "placed":
        heldCardId = null;
        held?.card.disable();
        held?.card.paint(CARD.fill, SYLLABLE_BACKGROUND, 0);
        held?.label.setVisible(false);
        if (round.status === "won") {
          banner.setText("¡Muy bien!");
          onComplete();
        }
        paint();
        return;
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
        return;
      }
      case "ignored":
        return;
      default:
        assertNever(outcome, "syllable attempt");
    }
  }

  function paint(): void {
    lives.setText(`Vidas: ${"♥".repeat(round.livesRemaining)}`);
    round.slots.forEach((filled, index) => {
      slotLabels[index]?.setText(
        filled ? filled.syllable.toLocaleUpperCase("es-ES") : ""
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
