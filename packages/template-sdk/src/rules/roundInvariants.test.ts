import { describe, expect, it } from "vitest";
import type { ManifestFor, VocabularyItem } from "@lectoemocion/resource-schema";
import { type RoundStatus } from "./roundStatus";
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
import {
  createInitialLetterRound,
  selectInitialLetterCard,
  wordInitial,
  type InitialLetterRound
} from "./initialLetterGame";

/**
 * Properties every round must hold, checked across many seeds and shapes
 * rather than on one hand-picked example.
 *
 * The per-game files pin specific behaviour. These pin the rules that no game
 * may break however it is played: a wrong answer costs nothing but the
 * attempt, a won round stays won, and no sequence of taps can drive a round
 * somewhere illegal.
 *
 * "Costs nothing" is the property that replaced a lives budget, and it is
 * stronger than the arithmetic it replaced: a rejected attempt must leave the
 * round *equal to what it was*, so there is nowhere for a hidden penalty to
 * accumulate. A game that grew one would fail here rather than in play.
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

/* The fixture's first eight words start with eight different letters. */
const initialLetterManifest = (
  count: number,
  seed: string
): ManifestFor<"initial-letter-game"> => ({
  schemaVersion: 1,
  resourceId: `initial-letter-${seed}`,
  template: { id: "initial-letter-game", version: 1 },
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

/** A round may only ever move from playing to won, and stay there. */
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

  it.each(sizes)("can always be won at %i pairs", (size) => {
    for (const seed of SEEDS) {
      let round = createPairsRound(pairsManifest(size, seed));
      for (const item of vocabulary(size)) {
        round = selectPairsCard(round, `${item.vocabularyItemId}-picture`).round;
        round = selectPairsCard(round, `${item.vocabularyItemId}-word`).round;
      }
      expect(round.status).toBe("won");
      expect(round.matched).toHaveLength(size);
    }
  });

  it("never regresses however it is tapped", () => {
    for (const seed of SEEDS) {
      let round: PairsRound = createPairsRound(pairsManifest(4, seed));
      const ids = round.cards.map((card) => card.cardId);

      /* Deterministic pseudo-random tapping, including invalid orders. */
      for (let step = 0; step < 60; step += 1) {
        const previous = round;
        const cardId = ids[(step * 7 + 3) % ids.length]!;
        const result = selectPairsCard(round, cardId);
        round = result.round;

        expect(round.matched.length).toBeGreaterThanOrEqual(
          previous.matched.length
        );
        assertStatusProgression(previous.status, round.status);
      }
    }
  });

  /*
   * The mismatch is where a life used to be spent. Nothing is spent now, so a
   * wrong pairing may clear the selection and nothing else — the board a child
   * comes back to is the board they left.
   */
  it("costs nothing but the selection when two cards do not pair", () => {
    let round = createPairsRound(pairsManifest(4, "wrong"));
    const opening = structuredClone(round);

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      round = selectPairsCard(round, "item-0-picture").round;
      const result = selectPairsCard(round, "item-1-word");
      expect(result.attempt).toEqual({
        kind: "mismatched",
        cardIds: ["item-0-picture", "item-1-word"]
      });
      round = result.round;
      expect(round).toEqual(opening);
    }
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
    }
  });

  /* The target stays reachable however many wrong pictures came before it. */
  it("costs nothing when a wrong picture is chosen", () => {
    for (const seed of SEEDS) {
      const opening = createWordPictureRound(wordPictureManifest(4, seed));
      let round: WordPictureRound = opening;
      const wrong = opening.choices.filter(
        (choice) => choice.vocabularyItemId !== opening.targetVocabularyItemId
      );

      for (let step = 0; step < 20; step += 1) {
        const result = chooseWordPicture(
          round,
          wrong[step % wrong.length]!.vocabularyItemId
        );
        expect(result.attempt).toEqual({ kind: "incorrect" });
        round = result.round;
        expect(round).toEqual(opening);
      }

      expect(
        chooseWordPicture(round, round.targetVocabularyItemId).round.status
      ).toBe("won");
    }
  });

  it("does not mutate the round it is given", () => {
    const round = createWordPictureRound(wordPictureManifest(3, "immutable"));
    const snapshot = structuredClone(round);
    chooseWordPicture(round, round.choices[0]!.vocabularyItemId);
    expect(round).toEqual(snapshot);
  });
});

describe("initial-letter rounds, over many seeds and sizes", () => {
  const sizes = [3, 4];

  it.each(sizes)("deals a picture and a letter per word at %i", (size) => {
    for (const seed of SEEDS) {
      const round = createInitialLetterRound(initialLetterManifest(size, seed));
      expect(round.cards).toHaveLength(size * 2);
      expect(new Set(round.cards.map((card) => card.cardId)).size).toBe(size * 2);

      const perGroup = round.cards.filter((card) => card.group === "letter");
      expect(perGroup).toHaveLength(size);
      /* One letter card per initial: no letter answers two pictures. */
      expect(new Set(perGroup.map((card) => card.initial)).size).toBe(size);
    }
  });

  it.each(sizes)("can always be won at %i", (size) => {
    for (const seed of SEEDS) {
      let round = createInitialLetterRound(initialLetterManifest(size, seed));
      for (const item of vocabulary(size)) {
        round = selectInitialLetterCard(
          round,
          `${item.vocabularyItemId}-picture`
        ).round;
        round = selectInitialLetterCard(
          round,
          `${wordInitial(item)}-letter`
        ).round;
      }
      expect(round.status).toBe("won");
      expect(round.matched).toHaveLength(size);
    }
  });

  it("never regresses however it is tapped", () => {
    for (const seed of SEEDS) {
      let round: InitialLetterRound = createInitialLetterRound(
        initialLetterManifest(4, seed)
      );
      const ids = round.cards.map((card) => card.cardId);

      /* Deterministic pseudo-random tapping, including invalid orders. */
      for (let step = 0; step < 60; step += 1) {
        const previous = round;
        const cardId = ids[(step * 7 + 3) % ids.length]!;
        round = selectInitialLetterCard(round, cardId).round;

        expect(round.matched.length).toBeGreaterThanOrEqual(
          previous.matched.length
        );
        assertStatusProgression(previous.status, round.status);
      }
    }
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
    }
  });

  /*
   * The card that went to the wrong slot does not stick, and the round it came
   * from is the round it goes back to. A child may miss the same slot twenty
   * times and still be able to finish the word.
   */
  it("leaves the round untouched by a wrong or occupied slot", () => {
    for (const seed of SEEDS) {
      const opening = createSyllablesRound(
        syllablesManifest(["ma", "ri", "po", "sa"], seed)
      );
      let round: SyllablesRound = opening;

      for (let step = 0; step < 20; step += 1) {
        const card = opening.tray[step % opening.tray.length]!;
        const slot = (card.slotIndex + 1) % opening.slots.length;
        const result = placeSyllable(round, card.cardId, slot);
        expect(result.attempt).toEqual({ kind: "rejected" });
        round = result.round;
        expect(round).toEqual(opening);
      }

      for (let slotIndex = 0; slotIndex < 4; slotIndex += 1) {
        const card = opening.tray.find((each) => each.slotIndex === slotIndex)!;
        round = placeSyllable(round, card.cardId, slotIndex).round;
      }
      expect(round.status).toBe("won");
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
