import { describe, expect, it } from "vitest";
import type { ManifestFor } from "@lectoemocion/resource-schema";
import { ROUND_LIVES } from "./lives";
import {
  assertSpellable,
  createLettersRound,
  LETTERS_MAXIMUM,
  LETTERS_MINIMUM,
  placeLetter,
  wordLetters
} from "./lettersGame";

const manifestFor = (
  vocabularyItemId: string,
  syllables: string[],
  seed = "lesson-1"
): ManifestFor<"letters-game"> => ({
  schemaVersion: 1,
  resourceId: `letters-${vocabularyItemId}`,
  template: { id: "letters-game", version: 1 },
  seed,
  vocabulary: [
    {
      vocabularyItemId,
      syllables,
      imageUrl: `/vocabulary/${vocabularyItemId}.webp`
    }
  ]
});

const pato = manifestFor("pato", ["pa", "to"]);

const cardFor = (round: ReturnType<typeof createLettersRound>, slot: number) =>
  round.tray.find((card) => card.slotIndex === slot)!;

describe("wordLetters", () => {
  it("splits a word into one card per letter", () => {
    expect(
      wordLetters({
        vocabularyItemId: "pato",
        syllables: ["pa", "to"],
        imageUrl: "/x.webp"
      })
    ).toEqual(["p", "a", "t", "o"]);
  });

  /* `ñ` is two UTF-16 units in some encodings; a child sees one letter. */
  it("keeps a multi-byte letter whole", () => {
    expect(
      wordLetters({
        vocabularyItemId: "niño",
        syllables: ["ni", "ño"],
        imageUrl: "/x.webp"
      })
    ).toEqual(["n", "i", "ñ", "o"]);
  });
});

describe("assertSpellable", () => {
  it("accepts the whole supported range", () => {
    for (let count = LETTERS_MINIMUM; count <= LETTERS_MAXIMUM; count += 1) {
      expect(() => assertSpellable("word", count)).not.toThrow();
    }
  });

  it("refuses a single letter, which is already the whole word", () => {
    expect(() => assertSpellable("a", 1)).toThrow(
      "a has one letter and cannot be spelled out"
    );
  });

  it("refuses a word too long to show as cards", () => {
    expect(() => assertSpellable("astronauta", LETTERS_MAXIMUM + 1)).toThrow(
      `astronauta has ${LETTERS_MAXIMUM + 1} letters, more than the ${LETTERS_MAXIMUM} this game shows`
    );
  });
});

describe("createLettersRound", () => {
  it("opens one empty slot per letter", () => {
    const round = createLettersRound(pato);
    expect(round.word).toBe("pato");
    expect(round.imageUrl).toBe("/vocabulary/pato.webp");
    expect(round.slots).toEqual([null, null, null, null]);
    expect(round.tray).toHaveLength(4);
    expect(round.livesRemaining).toBe(ROUND_LIVES);
    expect(round.status).toBe("playing");
  });

  it("starts no letter in the slot it belongs to", () => {
    for (const seed of ["a", "b", "c", "d", "e", "f"]) {
      const round = createLettersRound(manifestFor("pato", ["pa", "to"], seed));
      round.tray.forEach((card, index) => {
        expect(card.slotIndex).not.toBe(index);
      });
    }
  });

  /* A word whose letters repeat has no value-derangement; positions still work. */
  it("deals a word with repeated letters without hanging", () => {
    const round = createLettersRound(manifestFor("oso", ["o", "so"]));
    expect(round.tray).toHaveLength(3);
    round.tray.forEach((card, index) => {
      expect(card.slotIndex).not.toBe(index);
    });
  });

  it("is deterministic for a given seed", () => {
    expect(createLettersRound(pato)).toEqual(createLettersRound(pato));
  });

  it("refuses a word it cannot teach", () => {
    expect(() => createLettersRound(manifestFor("a", ["a"]))).toThrow(
      "cannot be spelled out"
    );
  });
});

describe("placeLetter", () => {
  it("keeps a letter placed in its own slot", () => {
    const round = createLettersRound(pato);
    const card = cardFor(round, 0);
    const placed = placeLetter(round, card.cardId, 0);

    expect(placed.attempt).toEqual({ kind: "placed" });
    expect(placed.round.slots[0]).toEqual(card);
    expect(placed.round.tray.map((each) => each.cardId)).not.toContain(card.cardId);
    expect(placed.round.livesRemaining).toBe(ROUND_LIVES);
    /* The round keeps its own fields, not just the shared sequence ones. */
    expect(placed.round.word).toBe("pato");
    expect(placed.round.imageUrl).toBe("/vocabulary/pato.webp");
  });

  it("returns a letter placed in the wrong slot and spends a life", () => {
    const round = createLettersRound(pato);
    const placed = placeLetter(round, cardFor(round, 0).cardId, 1);

    expect(placed.attempt).toEqual({ kind: "rejected" });
    expect(placed.round.slots).toEqual([null, null, null, null]);
    expect(placed.round.livesRemaining).toBe(ROUND_LIVES - 1);
  });

  it("rejects a correct letter aimed at an occupied slot", () => {
    const opening = createLettersRound(pato);
    const filled = placeLetter(opening, cardFor(opening, 0).cardId, 0).round;
    const second = placeLetter(filled, cardFor(opening, 1).cardId, 0);

    expect(second.attempt).toEqual({ kind: "rejected" });
    expect(second.round.livesRemaining).toBe(ROUND_LIVES - 1);
  });

  it("spells the word when every letter is placed", () => {
    const opening = createLettersRound(pato);
    let round = opening;
    for (let slot = 0; slot < 4; slot += 1) {
      round = placeLetter(round, cardFor(opening, slot).cardId, slot).round;
    }

    expect(round.status).toBe("won");
    expect(round.tray).toEqual([]);
    expect(round.slots.map((slot) => slot?.letter).join("")).toBe("pato");
    expect(round.livesRemaining).toBe(ROUND_LIVES);
  });

  it("loses once lives run out", () => {
    const opening = createLettersRound(pato);
    let round = opening;
    const card = cardFor(opening, 0);
    for (let attempt = 0; attempt < ROUND_LIVES; attempt += 1) {
      round = placeLetter(round, card.cardId, 1).round;
    }

    expect(round.livesRemaining).toBe(0);
    expect(round.status).toBe("lost");
  });

  it("ignores placements once the round has ended", () => {
    const opening = createLettersRound(pato);
    let round = opening;
    const card = cardFor(opening, 0);
    for (let attempt = 0; attempt < ROUND_LIVES; attempt += 1) {
      round = placeLetter(round, card.cardId, 1).round;
    }

    const after = placeLetter(round, card.cardId, 0);
    expect(after.attempt).toEqual({ kind: "ignored" });
    expect(after.round).toEqual(round);
  });

  it("names this game in its failures", () => {
    const round = createLettersRound(pato);
    expect(() => placeLetter(round, "no-such-card", 0)).toThrow(
      "Unknown letter card: no-such-card"
    );
    expect(() => placeLetter(round, cardFor(round, 0).cardId, 4)).toThrow(
      "Unknown letter slot: 4"
    );
  });

  it("does not mutate the round it is given", () => {
    const round = createLettersRound(pato);
    const snapshot = structuredClone(round);
    placeLetter(round, round.tray[0]!.cardId, 0);
    expect(round).toEqual(snapshot);
  });
});
