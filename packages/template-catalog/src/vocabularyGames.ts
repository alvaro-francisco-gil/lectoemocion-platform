import type { ManifestFor, VocabularyItem } from "@lectoemocion/resource-schema";
import { seededShuffle } from "@lectoemocion/template-sdk";

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
