import {
  vocabularyWord,
  type ManifestFor,
  type VocabularyItem
} from "@lectoemocion/resource-schema";
import {
  assertSpellable,
  seededShuffle,
  sharesInitialSyllable,
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

/** One match and two distractors — the three pictures below the target. */
const INITIAL_SYLLABLE_DISTRACTORS = 2;

/**
 * Whether one word is written inside the other from its first letter.
 *
 * `CARAMELO` against `CARAMELOS` is a round no child can lose fairly: the
 * reveal emphasises `CA` in both, and the pair reads as one word twice. The
 * catalogue would never author that on purpose, so the draw does not either.
 */
function oneIsWrittenInsideTheOther(
  a: VocabularyItem,
  b: VocabularyItem
): boolean {
  const first = vocabularyWord(a);
  const second = vocabularyWord(b);
  return first.startsWith(second) || second.startsWith(first);
}

/**
 * Match a picture to the target by the syllable both words open with.
 *
 * The match and the distractors are *drawn*, not authored: a world names the
 * target and nothing else, so a node cannot claim a match that does not
 * actually share the syllable. The draw is seeded, so a given node produces the
 * same round every time it is opened.
 *
 * A target whose syllable family is empty fails here, while the world is being
 * built, rather than when a child opens the chapter (invariant 6).
 */
export function createInitialSyllableGameResource(
  vocabulary: readonly VocabularyItem[],
  targetVocabularyItemId: string,
  seed: string
): ManifestFor<"initial-syllable-game"> {
  const target = requireItem(vocabulary, targetVocabularyItemId);

  const others = vocabulary.filter(
    (item) => item.vocabularyItemId !== targetVocabularyItemId
  );
  const family = others.filter(
    (item) =>
      sharesInitialSyllable(target, item) &&
      !oneIsWrittenInsideTheOther(target, item)
  );
  const match = seededShuffle(family, `${seed}-match`)[0];
  if (!match) {
    throw new Error(
      `No word shares an opening syllable with ${targetVocabularyItemId}`
    );
  }

  const distractors = seededShuffle(
    others.filter((item) => !sharesInitialSyllable(target, item)),
    `${seed}-distractors`
  ).slice(0, INITIAL_SYLLABLE_DISTRACTORS);
  if (distractors.length < INITIAL_SYLLABLE_DISTRACTORS) {
    throw new Error(
      `Fewer than ${INITIAL_SYLLABLE_DISTRACTORS} words differ from ${targetVocabularyItemId} in their opening syllable`
    );
  }

  return {
    schemaVersion: 1,
    resourceId: `initial-syllable-game-${seed}`,
    template: {
      id: "initial-syllable-game",
      version: 1,
      targetVocabularyItemId,
      matchVocabularyItemId: match.vocabularyItemId
    },
    seed,
    vocabulary: [target, match, ...distractors]
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
