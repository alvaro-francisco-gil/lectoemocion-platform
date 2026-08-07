import type { ManifestFor, VocabularyItem } from "@lectoemocion/resource-schema";
import { vocabularyWord } from "@lectoemocion/resource-schema";
import { seededShuffle } from "../seededRandom";
import { type RoundStatus } from "./roundStatus";

export interface WordPictureRound {
  readonly targetVocabularyItemId: string;
  readonly word: string;
  readonly choices: readonly VocabularyItem[];
  readonly status: RoundStatus;
}

export type WordPictureAttempt =
  | { kind: "correct" }
  | { kind: "incorrect" }
  | { kind: "ignored" };

export interface WordPictureChoice {
  readonly round: WordPictureRound;
  readonly attempt: WordPictureAttempt;
}

export function createWordPictureRound(
  manifest: ManifestFor<"word-picture-game">
): WordPictureRound {
  const targetVocabularyItemId = manifest.template.targetVocabularyItemId;
  const target = manifest.vocabulary.find(
    (item) => item.vocabularyItemId === targetVocabularyItemId
  );
  if (!target) {
    throw new Error(
      `Word-picture target is not in the vocabulary: ${targetVocabularyItemId}`
    );
  }

  return {
    targetVocabularyItemId,
    word: vocabularyWord(target),
    choices: seededShuffle(manifest.vocabulary, manifest.seed),
    status: "playing"
  };
}

export function chooseWordPicture(
  round: WordPictureRound,
  vocabularyItemId: string
): WordPictureChoice {
  const chosen = round.choices.some(
    (choice) => choice.vocabularyItemId === vocabularyItemId
  );
  if (!chosen) {
    throw new Error(`Unknown word-picture choice: ${vocabularyItemId}`);
  }

  if (round.status !== "playing") {
    return { round, attempt: { kind: "ignored" } };
  }

  if (vocabularyItemId === round.targetVocabularyItemId) {
    return { round: { ...round, status: "won" }, attempt: { kind: "correct" } };
  }

  /* The wrong picture leaves every picture, including the right one, offered. */
  return { round, attempt: { kind: "incorrect" } };
}
