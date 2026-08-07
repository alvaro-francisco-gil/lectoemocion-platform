import type { ManifestFor, VocabularyItem } from "@lectoemocion/resource-schema";
import { vocabularyWord } from "@lectoemocion/resource-schema";
import { type RoundStatus } from "./roundStatus";
import {
  dealSequence,
  placeSequenceCard,
  type SequenceAttempt,
  type SequenceCard
} from "./sequenceRound";

/**
 * How long a word this game will accept.
 *
 * Two is the rules' floor: one letter is already the whole word, so there is
 * nothing to order. Eight is the child's — a row of nine cards on a classroom
 * panel is a search task rather than a spelling one, and it is the point at
 * which cards stop being big enough for a three-year-old to hit.
 *
 * The bound lives here rather than in the schema because the letters are
 * derived from the syllables (`vocabularyWord`), and a schema cannot constrain
 * a value it does not store. Deriving it is what keeps a word from disagreeing
 * with its own spelling, so the check moves rather than the derivation.
 */
export const LETTERS_MINIMUM = 2;
export const LETTERS_MAXIMUM = 8;

export interface LetterCard extends SequenceCard {
  readonly cardId: string;
  readonly letter: string;
  readonly slotIndex: number;
}

export interface LettersRound {
  readonly word: string;
  readonly imageUrl: string;
  readonly slots: readonly (LetterCard | null)[];
  readonly tray: readonly LetterCard[];
  readonly status: RoundStatus;
}

export type LetterAttempt = SequenceAttempt;

export interface LetterPlacement {
  readonly round: LettersRound;
  readonly attempt: LetterAttempt;
}

/**
 * The letters of a word, as a child reads them.
 *
 * `Array.from` iterates code points rather than UTF-16 units, so `ñ` is one
 * card and not two halves of a broken one.
 */
export function wordLetters(item: VocabularyItem): string[] {
  return Array.from(vocabularyWord(item));
}

export function createLettersRound(
  manifest: ManifestFor<"letters-game">
): LettersRound {
  const [target] = manifest.vocabulary;
  if (!target) {
    throw new Error("A letters round needs a target vocabulary item");
  }

  const letters = wordLetters(target);
  assertSpellable(target.vocabularyItemId, letters.length);

  const cards = letters.map((letter, slotIndex) => ({
    cardId: `${target.vocabularyItemId}-${slotIndex}`,
    letter,
    slotIndex
  }));

  return {
    word: vocabularyWord(target),
    imageUrl: target.imageUrl,
    ...dealSequence(cards, manifest.seed)
  };
}

/**
 * Fails closed on a word this game cannot teach (invariant 6).
 *
 * Exported so the catalogue can refuse an unplayable word while it is being
 * authored, rather than only when a child opens the chapter — the same rule,
 * checked at both boundaries instead of written down twice.
 */
export function assertSpellable(
  vocabularyItemId: string,
  letterCount: number
): void {
  if (letterCount < LETTERS_MINIMUM) {
    throw new Error(
      `${vocabularyItemId} has one letter and cannot be spelled out`
    );
  }
  if (letterCount > LETTERS_MAXIMUM) {
    throw new Error(
      `${vocabularyItemId} has ${letterCount} letters, more than the ${LETTERS_MAXIMUM} this game shows`
    );
  }
}

export function placeLetter(
  round: LettersRound,
  cardId: string,
  slotIndex: number
): LetterPlacement {
  const placed = placeSequenceCard(round, cardId, slotIndex, "letter");
  return { round: { ...round, ...placed.round }, attempt: placed.attempt };
}
