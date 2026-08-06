import { describe, expect, it } from "vitest";
import type { ManifestFor, VocabularyItem } from "@lectoemocion/resource-schema";
import { ROUND_LIVES, type RoundStatus } from "./lives";
import { createPairsRound, selectPairsCard, type PairsRound } from "./pairsGame";
import {
  chooseWordPicture,
  createWordPictureRound,
  type WordPictureRound
} from "./wordPictureGame";
import {
  createSyllablesRound,
  placeSyllable,
  type SyllablesRound
} from "./syllablesGame";

/**
 * Properties every round must hold, checked across many seeds and shapes
 * rather than on one hand-picked example.
 *
 * The per-game files pin specific behaviour. These pin the rules that no game
 * may break however it is played: lives only fall, a finished round stays
 * finished, and no sequence of taps can drive a round somewhere illegal.
 */

const SEEDS = ["a", "b", "c", "lesson-1", "lesson-2", "seed-42", "ñ", "0"];

function vocabulary(count: number): VocabularyItem[] {
  const syllables = [
    ["ca", "sa"],
    ["sol"],
    ["lu", "na"],
    ["ma", "ri", "po", "sa"],
    ["pe", "lo", "ta"],
    ["ga", "to"],
    ["flor"],
    ["za", "pa", "to"]
  ];
  return Array.from({ length: count }, (_, index) => ({
    vocabularyItemId: `item-${index}`,
    syllables: [...(syllables[index % syllables.length] ?? ["xa"])],
    imageUrl: `/synthetic/item-${index}.svg`
  }));
}

const pairsManifest = (
  count: number,
  seed: string
): ManifestFor<"pairs-game"> => ({
  schemaVersion: 1,
  resourceId: `pairs-${seed}`,
  template: { id: "pairs-game", version: 1 },
  seed,
  vocabulary: vocabulary(count)
});

const wordPictureManifest = (
  count: number,
  seed: string
): ManifestFor<"word-picture-game"> => ({
  schemaVersion: 1,
  resourceId: `word-picture-${seed}`,
  template: {
    id: "word-picture-game",
    version: 1,
    targetVocabularyItemId: "item-0"
  },
  seed,
  vocabulary: vocabulary(count)
});

const syllablesManifest = (
  syllables: string[],
  seed: string
): ManifestFor<"syllables-game"> => ({
  schemaVersion: 1,
  resourceId: `syllables-${seed}`,
  template: { id: "syllables-game", version: 1 },
  seed,
  vocabulary: [
    { vocabularyItemId: "target", syllables, imageUrl: "/synthetic/t.svg" }
  ]
});

/** A round may only ever move from playing to a decided end, and stay there. */
function assertStatusProgression(
  previous: RoundStatus,
  next: RoundStatus
): void {
  if (previous !== "playing") expect(next).toBe(previous);
}

describe("pairs rounds, over many seeds and sizes", () => {
  const sizes = [2, 3, 4, 5, 8];

  it.each(sizes)("deals two cards per item for %i pairs", (size) => {
    for (const seed of SEEDS) {
      const round = createPairsRound(pairsManifest(size, seed));
      expect(round.cards).toHaveLength(size * 2);

      const perItem = new Map<string, number>();
      for (const card of round.cards) {
        perItem.set(
          card.vocabularyItemId,
          (perItem.get(card.vocabularyItemId) ?? 0) + 1
        );
      }
      expect([...perItem.values()]).toEqual(Array(size).fill(2));
      expect(new Set(round.cards.map((card) => card.cardId)).size).toBe(size * 2);
    }
  });

  it.each(sizes)("can always be won without losing a life at %i pairs", (size) => {
    for (const seed of SEEDS) {
      let round = createPairsRound(pairsManifest(size, seed));
      for (const item of vocabulary(size)) {
        round = selectPairsCard(round, `${item.vocabularyItemId}-picture`).round;
        round = selectPairsCard(round, `${item.vocabularyItemId}-word`).round;
      }
      expect(round.status).toBe("won");
      expect(round.livesRemaining).toBe(ROUND_LIVES);
      expect(round.matched).toHaveLength(size);
    }
  });

  it("never lets lives fall below zero or status regress", () => {
    for (const seed of SEEDS) {
      let round: PairsRound = createPairsRound(pairsManifest(4, seed));
      const ids = round.cards.map((card) => card.cardId);

      /* Deterministic pseudo-random tapping, including invalid orders. */
      for (let step = 0; step < 60; step += 1) {
        const previous = round;
        const cardId = ids[(step * 7 + 3) % ids.length]!;
        const result = selectPairsCard(round, cardId);
        round = result.round;

        expect(round.livesRemaining).toBeGreaterThanOrEqual(0);
        expect(round.livesRemaining).toBeLessThanOrEqual(previous.livesRemaining);
        expect(round.matched.length).toBeGreaterThanOrEqual(
          previous.matched.length
        );
        assertStatusProgression(previous.status, round.status);
        if (round.status === "lost") expect(round.livesRemaining).toBe(0);
      }
    }
  });

  it("loses after exactly three wrong pairings", () => {
    let round = createPairsRound(pairsManifest(4, "wrong"));
    for (let attempt = 1; attempt <= ROUND_LIVES; attempt += 1) {
      round = selectPairsCard(round, "item-0-picture").round;
      round = selectPairsCard(round, "item-1-word").round;
      expect(round.livesRemaining).toBe(ROUND_LIVES - attempt);
    }
    expect(round.status).toBe("lost");
  });

  it("does not mutate the round it is given", () => {
    const round = createPairsRound(pairsManifest(3, "immutable"));
    const snapshot = structuredClone(round);
    selectPairsCard(round, "item-0-picture");
    expect(round).toEqual(snapshot);
  });
});

describe("word-picture rounds, over many seeds and sizes", () => {
  const sizes = [2, 3, 4, 6];

  it.each(sizes)("offers every choice exactly once at %i choices", (size) => {
    for (const seed of SEEDS) {
      const round = createWordPictureRound(wordPictureManifest(size, seed));
      const ids = round.choices.map((choice) => choice.vocabularyItemId);
      expect(ids).toHaveLength(size);
      expect(new Set(ids).size).toBe(size);
      expect(ids).toContain(round.targetVocabularyItemId);
      expect(round.word).toBe("casa");
    }
  });

  it.each(sizes)("is won by the target on the first try at %i choices", (size) => {
    for (const seed of SEEDS) {
      const round = createWordPictureRound(wordPictureManifest(size, seed));
      const result = chooseWordPicture(round, round.targetVocabularyItemId);
      expect(result.attempt).toEqual({ kind: "correct" });
      expect(result.round.status).toBe("won");
      expect(result.round.livesRemaining).toBe(ROUND_LIVES);
    }
  });

  it("never lets lives fall below zero or status regress", () => {
    for (const seed of SEEDS) {
      let round: WordPictureRound = createWordPictureRound(
        wordPictureManifest(4, seed)
      );
      const ids = round.choices.map((choice) => choice.vocabularyItemId);

      for (let step = 0; step < 20; step += 1) {
        const previous = round;
        round = chooseWordPicture(round, ids[(step * 3) % ids.length]!).round;

        expect(round.livesRemaining).toBeGreaterThanOrEqual(0);
        expect(round.livesRemaining).toBeLessThanOrEqual(previous.livesRemaining);
        assertStatusProgression(previous.status, round.status);
      }
    }
  });

  it("does not mutate the round it is given", () => {
    const round = createWordPictureRound(wordPictureManifest(3, "immutable"));
    const snapshot = structuredClone(round);
    chooseWordPicture(round, round.choices[0]!.vocabularyItemId);
    expect(round).toEqual(snapshot);
  });
});

describe("syllables rounds, over many seeds and word shapes", () => {
  const words = [
    ["ca", "sa"],
    ["lu", "na"],
    ["pe", "lo", "ta"],
    ["ma", "ri", "po", "sa"],
    ["ar", "co", "i", "ris"],
    ["ca", "ca"],
    ["a", "a", "a"]
  ];

  it.each(words)("starts no card in its own slot: %s", (...syllables) => {
    for (const seed of SEEDS) {
      const round = createSyllablesRound(syllablesManifest(syllables, seed));
      expect(round.tray).toHaveLength(syllables.length);
      round.tray.forEach((card, index) => {
        expect(card.slotIndex).not.toBe(index);
      });
      expect(new Set(round.tray.map((card) => card.cardId)).size).toBe(
        syllables.length
      );
    }
  });

  it.each(words)("rebuilds the word when played correctly: %s", (...syllables) => {
    for (const seed of SEEDS) {
      const opening = createSyllablesRound(syllablesManifest(syllables, seed));
      let round: SyllablesRound = opening;

      for (let slotIndex = 0; slotIndex < syllables.length; slotIndex += 1) {
        const card = opening.tray.find((each) => each.slotIndex === slotIndex)!;
        const result = placeSyllable(round, card.cardId, slotIndex);
        expect(result.attempt).toEqual({ kind: "placed" });
        round = result.round;
      }

      expect(round.status).toBe("won");
      expect(round.tray).toEqual([]);
      expect(round.slots.map((slot) => slot?.syllable).join("")).toBe(
        syllables.join("")
      );
      expect(round.livesRemaining).toBe(ROUND_LIVES);
    }
  });

  it("charges a life for every wrong or occupied slot, never below zero", () => {
    for (const seed of SEEDS) {
      const opening = createSyllablesRound(
        syllablesManifest(["ma", "ri", "po", "sa"], seed)
      );
      let round: SyllablesRound = opening;

      for (let step = 0; step < 20; step += 1) {
        const previous = round;
        const card = opening.tray[step % opening.tray.length]!;
        const slot = (card.slotIndex + 1) % opening.slots.length;
        const result = placeSyllable(round, card.cardId, slot);
        round = result.round;

        expect(round.livesRemaining).toBeGreaterThanOrEqual(0);
        expect(round.livesRemaining).toBeLessThanOrEqual(previous.livesRemaining);
        assertStatusProgression(previous.status, round.status);
      }
      expect(round.status).toBe("lost");
    }
  });

  it("does not mutate the round it is given", () => {
    const round = createSyllablesRound(
      syllablesManifest(["ca", "sa"], "immutable")
    );
    const snapshot = structuredClone(round);
    placeSyllable(round, round.tray[0]!.cardId, 0);
    expect(round).toEqual(snapshot);
  });
});
