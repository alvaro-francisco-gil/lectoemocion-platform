import type { ManifestFor, VocabularyItem } from "@lectoemocion/resource-schema";
import { seededShuffle } from "../seededRandom";
import { ROUND_LIVES, type RoundStatus } from "./lives";

/**
 * Match a picture to the one above it by the syllable both words open with.
 *
 * The step between the `initials-game`, which is about a letter, and the
 * `syllables-game`, which segments a whole word: hearing that `MAriposa` and
 * `MAnzana` begin the same way is what Spanish blending is built on.
 */
export interface InitialSyllableRound {
  readonly target: VocabularyItem;
  /** The syllable both the target and its match open with, folded. */
  readonly initialSyllable: string;
  readonly matchVocabularyItemId: string;
  readonly choices: readonly VocabularyItem[];
  readonly livesRemaining: number;
  readonly status: RoundStatus;
}

export type InitialSyllableAttempt =
  | { kind: "correct" }
  | { kind: "incorrect" }
  | { kind: "ignored" };

export interface InitialSyllableChoice {
  readonly round: InitialSyllableRound;
  readonly attempt: InitialSyllableAttempt;
}

/**
 * The syllable a word opens with, folded for `es-ES`.
 *
 * The one place the first syllable is read, so the catalogue drawing a family
 * and the round validating one cannot disagree about what "opens with" means.
 *
 * The schema guarantees at least one syllable; `noUncheckedIndexedAccess`
 * cannot see that, and an explicit failure is the right answer anyway for a
 * caller holding a hand-built item.
 */
export function initialSyllable(item: VocabularyItem): string {
  const first = item.syllables[0];
  if (first === undefined) {
    throw new Error(`${item.vocabularyItemId} has no syllables`);
  }
  return first.toLocaleLowerCase("es-ES");
}

/**
 * Whether two words open with the same syllable.
 *
 * Case-folded and otherwise literal. Accents are *not* folded away: whether
 * `ni` and `ní` are one sound is a phonetic claim this repository has no basis
 * to make, and a child reading Spanish sees the difference.
 */
export function sharesInitialSyllable(
  a: VocabularyItem,
  b: VocabularyItem
): boolean {
  return initialSyllable(a) === initialSyllable(b);
}

function requireChoice(
  manifest: ManifestFor<"initial-syllable-game">,
  vocabularyItemId: string,
  role: string
): VocabularyItem {
  const found = manifest.vocabulary.find(
    (item) => item.vocabularyItemId === vocabularyItemId
  );
  if (!found) {
    throw new Error(
      `Initial-syllable ${role} is not in the vocabulary: ${vocabularyItemId}`
    );
  }
  return found;
}

/**
 * Builds the round, and refuses one that cannot be played fairly.
 *
 * The schema pins four pictures and names which is right; it cannot state that
 * the named match actually opens with the target's syllable, nor that no
 * distractor does. Both are checked here, so a round with two right answers —
 * one a child would be marked wrong for — is impossible rather than unlikely.
 */
export function createInitialSyllableRound(
  manifest: ManifestFor<"initial-syllable-game">
): InitialSyllableRound {
  const { targetVocabularyItemId, matchVocabularyItemId } = manifest.template;
  const target = requireChoice(manifest, targetVocabularyItemId, "target");
  const match = requireChoice(manifest, matchVocabularyItemId, "match");

  if (matchVocabularyItemId === targetVocabularyItemId) {
    throw new Error(
      `Initial-syllable match cannot be the target: ${targetVocabularyItemId}`
    );
  }

  const opening = initialSyllable(target);
  if (!sharesInitialSyllable(target, match)) {
    throw new Error(`${matchVocabularyItemId} does not open with "${opening}"`);
  }

  const choices = manifest.vocabulary.filter(
    (item) => item.vocabularyItemId !== targetVocabularyItemId
  );
  for (const choice of choices) {
    if (
      choice.vocabularyItemId !== matchVocabularyItemId &&
      sharesInitialSyllable(target, choice)
    ) {
      throw new Error(
        `${choice.vocabularyItemId} also opens with "${opening}"`
      );
    }
  }

  return {
    target,
    initialSyllable: opening,
    matchVocabularyItemId,
    choices: seededShuffle(choices, manifest.seed),
    livesRemaining: ROUND_LIVES,
    status: "playing"
  };
}

export function chooseInitialSyllable(
  round: InitialSyllableRound,
  vocabularyItemId: string
): InitialSyllableChoice {
  const offered = round.choices.some(
    (choice) => choice.vocabularyItemId === vocabularyItemId
  );
  if (!offered) {
    throw new Error(`Unknown initial-syllable choice: ${vocabularyItemId}`);
  }

  if (round.status !== "playing") {
    return { round, attempt: { kind: "ignored" } };
  }

  if (vocabularyItemId === round.matchVocabularyItemId) {
    return { round: { ...round, status: "won" }, attempt: { kind: "correct" } };
  }

  const livesRemaining = round.livesRemaining - 1;
  return {
    round: {
      ...round,
      livesRemaining,
      status: livesRemaining === 0 ? "lost" : "playing"
    },
    attempt: { kind: "incorrect" }
  };
}
