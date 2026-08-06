import { describe, expect, it } from "vitest";
import type { ManifestFor, VocabularyItem } from "@lectoemocion/resource-schema";
import {
  assertDistinctInitials,
  createInitialLetterRound,
  selectInitialLetterCard,
  wordInitial
} from "./initialLetterGame";
import { ROUND_LIVES } from "./lives";

const luna: VocabularyItem = {
  vocabularyItemId: "luna",
  syllables: ["lu", "na"],
  imageUrl: "/synthetic/luna.svg"
};

const sol: VocabularyItem = {
  vocabularyItemId: "sol",
  syllables: ["sol"],
  imageUrl: "/synthetic/sol.svg"
};

const pato: VocabularyItem = {
  vocabularyItemId: "pato",
  syllables: ["pa", "to"],
  imageUrl: "/synthetic/pato.svg"
};

const manifest = (
  vocabulary: readonly VocabularyItem[],
  seed = "seed"
): ManifestFor<"initial-letter-game"> => ({
  schemaVersion: 1,
  resourceId: `initial-letter-game-${seed}`,
  template: { id: "initial-letter-game", version: 1 },
  seed,
  vocabulary: [...vocabulary]
});

describe("the initial of a word", () => {
  it("is the first letter, uppercased", () => {
    expect(wordInitial(luna)).toBe("L");
  });

  /* One card, not two halves: `Array.from` iterates code points. */
  it("keeps a multi-byte letter whole", () => {
    expect(
      wordInitial({
        vocabularyItemId: "ñu",
        syllables: ["ñu"],
        imageUrl: "/synthetic/nu.svg"
      })
    ).toBe("Ñ");
  });
});

describe("a board with two words under one letter", () => {
  const luz: VocabularyItem = {
    vocabularyItemId: "luz",
    syllables: ["luz"],
    imageUrl: "/synthetic/luz.svg"
  };

  it("is refused by name, so an author can see which two clash", () => {
    expect(() => assertDistinctInitials([luna, sol, luz])).toThrow(
      "luna and luz both start with L"
    );
  });

  it("cannot be dealt as a round", () => {
    expect(() => createInitialLetterRound(manifest([luna, sol, luz]))).toThrow(
      "both start with L"
    );
  });
});

describe("an initial-letter round", () => {
  it("deals one picture card and one letter card per word", () => {
    const round = createInitialLetterRound(manifest([luna, sol, pato]));

    expect(round.cards.filter((card) => card.group === "picture")).toHaveLength(3);
    expect(round.cards.filter((card) => card.group === "letter")).toHaveLength(3);
    expect(new Set(round.cards.map((card) => card.cardId)).size).toBe(6);
    expect(round.status).toBe("playing");
  });

  it("is won by connecting every picture to its letter", () => {
    let round = createInitialLetterRound(manifest([luna, sol, pato]));

    for (const item of [luna, sol, pato]) {
      const picture = selectInitialLetterCard(
        round,
        `${item.vocabularyItemId}-picture`
      );
      expect(picture.attempt).toEqual({ kind: "selected" });
      const letter = selectInitialLetterCard(
        picture.round,
        `${wordInitial(item)}-letter`
      );
      expect(letter.attempt).toEqual({
        kind: "matched",
        initial: wordInitial(item)
      });
      round = letter.round;
    }

    expect(round.status).toBe("won");
    expect(round.livesRemaining).toBe(ROUND_LIVES);
  });

  it("charges a life for a wrong letter and loses after three", () => {
    let round = createInitialLetterRound(manifest([luna, sol, pato]));

    for (let attempt = 1; attempt <= ROUND_LIVES; attempt += 1) {
      round = selectInitialLetterCard(round, "luna-picture").round;
      const wrong = selectInitialLetterCard(round, "S-letter");
      expect(wrong.attempt).toEqual({
        kind: "mismatched",
        cardIds: ["luna-picture", "S-letter"]
      });
      round = wrong.round;
      expect(round.livesRemaining).toBe(ROUND_LIVES - attempt);
    }

    expect(round.status).toBe("lost");
    expect(selectInitialLetterCard(round, "luna-picture").attempt).toEqual({
      kind: "ignored"
    });
  });

  /* Changing your mind about which picture you meant is not a wrong answer. */
  it("clears the selection instead of charging a life within one column", () => {
    const round = createInitialLetterRound(manifest([luna, sol, pato]));
    const first = selectInitialLetterCard(round, "luna-picture");
    const second = selectInitialLetterCard(first.round, "sol-picture");

    expect(second.attempt).toEqual({ kind: "cleared" });
    expect(second.round.selectedCardId).toBeNull();
    expect(second.round.livesRemaining).toBe(ROUND_LIVES);
  });

  it("ignores a card whose letter is already connected", () => {
    let round = createInitialLetterRound(manifest([luna, sol, pato]));
    round = selectInitialLetterCard(round, "luna-picture").round;
    round = selectInitialLetterCard(round, "L-letter").round;

    expect(selectInitialLetterCard(round, "luna-picture").attempt).toEqual({
      kind: "ignored"
    });
    expect(selectInitialLetterCard(round, "L-letter").attempt).toEqual({
      kind: "ignored"
    });
  });

  it("refuses a card it never dealt", () => {
    const round = createInitialLetterRound(manifest([luna, sol, pato]));
    expect(() => selectInitialLetterCard(round, "Z-letter")).toThrow(
      "Unknown initial-letter card"
    );
  });

  it("does not mutate the round it is given", () => {
    const round = createInitialLetterRound(manifest([luna, sol, pato]));
    const snapshot = structuredClone(round);
    selectInitialLetterCard(round, "luna-picture");
    expect(round).toEqual(snapshot);
  });

  it("deals the same board for one seed and shuffles differently for another", () => {
    const order = (seed: string) =>
      createInitialLetterRound(manifest([luna, sol, pato], seed)).cards.map(
        (card) => card.cardId
      );

    expect(order("seed-one")).toEqual(order("seed-one"));
    /* The two columns are shuffled separately, so neither mirrors the other. */
    const round = createInitialLetterRound(manifest([luna, sol, pato], "mirror"));
    const pictures = round.cards
      .filter((card) => card.group === "picture")
      .map((card) => card.initial);
    const letters = round.cards
      .filter((card) => card.group === "letter")
      .map((card) => card.initial);
    expect(new Set(pictures)).toEqual(new Set(letters));
  });
});
