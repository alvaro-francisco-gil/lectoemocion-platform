import type { ManifestFor } from "@lectoemocion/resource-schema";
import { vocabularyWord } from "@lectoemocion/resource-schema";
import { seededDerangement } from "../seededRandom";
import { ROUND_LIVES, type RoundStatus } from "./lives";

export interface SyllableCard {
  readonly cardId: string;
  readonly syllable: string;
  readonly slotIndex: number;
}

export interface SyllablesRound {
  readonly word: string;
  readonly imageUrl: string;
  readonly slots: readonly (SyllableCard | null)[];
  readonly tray: readonly SyllableCard[];
  readonly livesRemaining: number;
  readonly status: RoundStatus;
}

export type SyllableAttempt =
  | { kind: "placed" }
  | { kind: "rejected" }
  | { kind: "ignored" };

export interface SyllablePlacement {
  readonly round: SyllablesRound;
  readonly attempt: SyllableAttempt;
}

export function createSyllablesRound(
  manifest: ManifestFor<"syllables-game">
): SyllablesRound {
  const [target] = manifest.vocabulary;
  if (!target) {
    throw new Error("A syllables round needs a target vocabulary item");
  }

  const cards = target.syllables.map((syllable, slotIndex) => ({
    cardId: `${target.vocabularyItemId}-${slotIndex}`,
    syllable,
    slotIndex
  }));

  return {
    word: vocabularyWord(target),
    imageUrl: target.imageUrl,
    slots: cards.map(() => null),
    tray: seededDerangement(cards, manifest.seed),
    livesRemaining: ROUND_LIVES,
    status: "playing"
  };
}

export function placeSyllable(
  round: SyllablesRound,
  cardId: string,
  slotIndex: number
): SyllablePlacement {
  const card = round.tray.find((candidate) => candidate.cardId === cardId);
  if (!card) {
    throw new Error(`Unknown syllable card: ${cardId}`);
  }
  if (slotIndex < 0 || slotIndex >= round.slots.length) {
    throw new Error(`Unknown syllable slot: ${slotIndex}`);
  }

  if (round.status !== "playing") {
    return { round, attempt: { kind: "ignored" } };
  }

  const occupied = round.slots[slotIndex] !== null;
  if (occupied || card.slotIndex !== slotIndex) {
    const livesRemaining = round.livesRemaining - 1;
    return {
      round: {
        ...round,
        livesRemaining,
        status: livesRemaining === 0 ? "lost" : "playing"
      },
      attempt: { kind: "rejected" }
    };
  }

  const slots = round.slots.map((slot, index) =>
    index === slotIndex ? card : slot
  );
  const tray = round.tray.filter((candidate) => candidate.cardId !== cardId);
  return {
    round: {
      ...round,
      slots,
      tray,
      status: tray.length === 0 ? "won" : "playing"
    },
    attempt: { kind: "placed" }
  };
}
