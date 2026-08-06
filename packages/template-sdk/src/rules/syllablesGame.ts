import type { ManifestFor } from "@lectoemocion/resource-schema";
import { vocabularyWord } from "@lectoemocion/resource-schema";
import { type RoundStatus } from "./lives";
import {
  dealSequence,
  placeSequenceCard,
  type SequenceAttempt,
  type SequenceCard
} from "./sequenceRound";

export interface SyllableCard extends SequenceCard {
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

export type SyllableAttempt = SequenceAttempt;

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
    ...dealSequence(cards, manifest.seed)
  };
}

export function placeSyllable(
  round: SyllablesRound,
  cardId: string,
  slotIndex: number
): SyllablePlacement {
  const placed = placeSequenceCard(round, cardId, slotIndex, "syllable");
  return { round: { ...round, ...placed.round }, attempt: placed.attempt };
}
