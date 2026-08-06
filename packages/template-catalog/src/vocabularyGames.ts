import type { ManifestFor, VocabularyItem } from "@lectoemocion/resource-schema";
import {
  assertSpellable,
  seededShuffle,
  wordInitial,
  wordLetters
} from "@lectoemocion/template-sdk";

function requireItem(
  vocabulary: readonly VocabularyItem[],
  targetVocabularyItemId: string
): VocabularyItem {
  const target = vocabulary.find(
    (item) => item.vocabularyItemId === targetVocabularyItemId
  );
  if (!target) {
    throw new Error(`No vocabulary item named ${targetVocabularyItemId}`);
  }
  return target;
}

/**
 * Resolves named vocabulary ids to their items, in the order named.
 *
 * A typo in an authored world is a content defect: it fails closed here
 * (invariant 6) rather than silently shipping a game one picture short.
 */
export function requireItems(
  vocabulary: readonly VocabularyItem[],
  ids: readonly string[]
): VocabularyItem[] {
  const seen = new Set<string>();
  return ids.map((id) => {
    if (seen.has(id)) {
      throw new Error(`Vocabulary item named twice: ${id}`);
    }
    seen.add(id);
    return requireItem(vocabulary, id);
  });
}

function requireCount(
  vocabulary: readonly VocabularyItem[],
  count: number,
  noun: string
): void {
  if (count > vocabulary.length) {
    throw new Error(
      `Template requires ${count} ${noun} but only ${vocabulary.length} are available`
    );
  }
}

export function createPairsGameResource(
  vocabulary: readonly VocabularyItem[],
  pairCount: number,
  seed: string
): ManifestFor<"pairs-game"> {
  requireCount(vocabulary, pairCount, "vocabulary items");
  return {
    schemaVersion: 1,
    resourceId: `pairs-game-${seed}`,
    template: { id: "pairs-game", version: 1 },
    seed,
    vocabulary: seededShuffle(vocabulary, `${seed}-selection`).slice(0, pairCount)
  };
}

export function createWordPictureGameResource(
  vocabulary: readonly VocabularyItem[],
  targetVocabularyItemId: string,
  choiceCount: number,
  seed: string
): ManifestFor<"word-picture-game"> {
  const target = requireItem(vocabulary, targetVocabularyItemId);
  requireCount(vocabulary, choiceCount, "vocabulary items");

  const distractors = seededShuffle(
    vocabulary.filter((item) => item.vocabularyItemId !== targetVocabularyItemId),
    `${seed}-distractors`
  ).slice(0, choiceCount - 1);

  return {
    schemaVersion: 1,
    resourceId: `word-picture-game-${seed}`,
    template: {
      id: "word-picture-game",
      version: 1,
      targetVocabularyItemId
    },
    seed,
    vocabulary: [target, ...distractors]
  };
}

/**
 * Connect each picture to the letter its word begins with.
 *
 * The draw is filtered rather than merely sampled: a set with two words under
 * the same letter is not playable (`assertDistinctInitials`), so items whose
 * initial is already taken are skipped as the shuffled vocabulary is walked.
 * Taking the first `n` and then complaining would make the game fail on a seed
 * for reasons no author could see.
 */
export function createInitialLetterGameResource(
  vocabulary: readonly VocabularyItem[],
  pictureCount: number,
  seed: string
): ManifestFor<"initial-letter-game"> {
  requireCount(vocabulary, pictureCount, "vocabulary items");

  const chosen: VocabularyItem[] = [];
  const taken = new Set<string>();
  for (const item of seededShuffle(vocabulary, `${seed}-selection`)) {
    if (chosen.length === pictureCount) break;
    const initial = wordInitial(item);
    if (taken.has(initial)) continue;
    taken.add(initial);
    chosen.push(item);
  }

  if (chosen.length < pictureCount) {
    throw new Error(
      `Only ${chosen.length} of the ${pictureCount} pictures this game needs have distinct initial letters`
    );
  }

  return {
    schemaVersion: 1,
    resourceId: `initial-letter-game-${seed}`,
    template: { id: "initial-letter-game", version: 1 },
    seed,
    vocabulary: chosen
  };
}

export function createSyllablesGameResource(
  vocabulary: readonly VocabularyItem[],
  targetVocabularyItemId: string,
  seed: string
): ManifestFor<"syllables-game"> {
  const target = requireItem(vocabulary, targetVocabularyItemId);
  if (target.syllables.length < 2) {
    throw new Error(
      `${targetVocabularyItemId} has one syllable and cannot be segmented`
    );
  }

  return {
    schemaVersion: 1,
    resourceId: `syllables-game-${seed}`,
    template: { id: "syllables-game", version: 1 },
    seed,
    vocabulary: [target]
  };
}

/**
 * Spell one word from its letters.
 *
 * The word is refused here as well as in the round, so an unplayable word is
 * caught while the world is being authored rather than when a child opens the
 * chapter. Both sides call `assertSpellable`, so there is still one rule.
 */
export function createLettersGameResource(
  vocabulary: readonly VocabularyItem[],
  targetVocabularyItemId: string,
  seed: string
): ManifestFor<"letters-game"> {
  const target = requireItem(vocabulary, targetVocabularyItemId);
  assertSpellable(targetVocabularyItemId, wordLetters(target).length);

  return {
    schemaVersion: 1,
    resourceId: `letters-game-${seed}`,
    template: { id: "letters-game", version: 1 },
    seed,
    vocabulary: [target]
  };
}
