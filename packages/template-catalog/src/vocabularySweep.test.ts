import { describe, expect, it } from "vitest";
import {
  parseResourceManifest,
  vocabularyWord,
  type VocabularyItem
} from "@lectoemocion/resource-schema";
import {
  chooseWordPicture,
  createLettersRound,
  createPairsRound,
  createSyllablesRound,
  createWordPictureRound,
  placeLetter,
  placeSyllable,
  selectPairsCard,
  wordLetters,
  LETTERS_MAXIMUM,
  LETTERS_MINIMUM,
  ROUND_LIVES
} from "@lectoemocion/template-sdk";
import {
  createLettersGameResource,
  createPairsGameResource,
  createSyllablesGameResource,
  createWordPictureGameResource,
  defaultVocabulary
} from ".";

/**
 * The games played against the real imported content, not a fixture.
 *
 * The 109 vocabulary items came from the prototype's filenames, so their
 * syllables were parsed rather than authored. A sweep is the only honest check
 * that every one of them produces a valid, winnable round: a single bad
 * hyphenation is a lesson that cannot be finished, and it would sit unnoticed
 * behind a spot-check of three words.
 */

const multiSyllable = defaultVocabulary.filter(
  (item) => item.syllables.length > 1
);

const spellable = defaultVocabulary.filter((item) => {
  const letters = wordLetters(item).length;
  return letters >= LETTERS_MINIMUM && letters <= LETTERS_MAXIMUM;
});

const label = (item: VocabularyItem) => item.vocabularyItemId;

describe("the imported vocabulary", () => {
  it("is not empty and has unique identifiers", () => {
    expect(defaultVocabulary.length).toBeGreaterThan(100);
    const ids = defaultVocabulary.map(label);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every item its own picture", () => {
    const urls = defaultVocabulary.map((item) => item.imageUrl);
    expect(new Set(urls).size).toBe(urls.length);
    for (const url of urls) {
      expect(url.startsWith("/vocabulary/")).toBe(true);
      expect(url.endsWith(".webp")).toBe(true);
    }
  });

  /* The word is derived from the syllables, so this pins that the derivation
     agrees with the identifier the filename produced. */
  it("spells each identifier with its own syllables", () => {
    for (const item of defaultVocabulary) {
      expect(vocabularyWord(item), label(item)).toBe(item.vocabularyItemId);
    }
  });

  it("has no empty or whitespace-only syllable", () => {
    for (const item of defaultVocabulary) {
      for (const syllable of item.syllables) {
        expect(syllable.trim(), label(item)).toBe(syllable);
        expect(syllable.length, label(item)).toBeGreaterThan(0);
      }
    }
  });

  it("has enough multi-syllable words to teach segmentation", () => {
    expect(multiSyllable.length).toBeGreaterThan(80);
  });
});

describe("every multi-syllable word makes a winnable syllables round", () => {
  it.each(multiSyllable.map((item) => [label(item), item] as const))(
    "%s",
    (_id, item) => {
      const resource = createSyllablesGameResource(
        defaultVocabulary,
        item.vocabularyItemId,
        `sweep-${item.vocabularyItemId}`
      );
      expect(parseResourceManifest(resource)).toEqual(resource);

      const opening = createSyllablesRound(resource);
      expect(opening.tray).toHaveLength(item.syllables.length);
      opening.tray.forEach((card, index) => {
        expect(card.slotIndex).not.toBe(index);
      });

      let round = opening;
      for (let slot = 0; slot < item.syllables.length; slot += 1) {
        const card = opening.tray.find((each) => each.slotIndex === slot)!;
        round = placeSyllable(round, card.cardId, slot).round;
      }

      expect(round.status).toBe("won");
      expect(round.livesRemaining).toBe(ROUND_LIVES);
      expect(round.slots.map((each) => each?.syllable).join("")).toBe(
        item.vocabularyItemId
      );
    }
  );
});

describe("every spellable word makes a winnable letters round", () => {
  it("has enough short words to teach spelling", () => {
    expect(spellable.length).toBeGreaterThan(60);
  });

  it.each(spellable.map((item) => [label(item), item] as const))(
    "%s",
    (_id, item) => {
      const resource = createLettersGameResource(
        defaultVocabulary,
        item.vocabularyItemId,
        `sweep-${item.vocabularyItemId}`
      );
      expect(parseResourceManifest(resource)).toEqual(resource);

      const letters = wordLetters(item);
      const opening = createLettersRound(resource);
      expect(opening.tray).toHaveLength(letters.length);
      opening.tray.forEach((card, index) => {
        expect(card.slotIndex).not.toBe(index);
      });

      let round = opening;
      for (let slot = 0; slot < letters.length; slot += 1) {
        const card = opening.tray.find((each) => each.slotIndex === slot)!;
        round = placeLetter(round, card.cardId, slot).round;
      }

      expect(round.status).toBe("won");
      expect(round.livesRemaining).toBe(ROUND_LIVES);
      expect(round.slots.map((each) => each?.letter).join("")).toBe(
        item.vocabularyItemId
      );
    }
  );
});

describe("every word makes a winnable word-picture round", () => {
  it.each(defaultVocabulary.map((item) => [label(item), item] as const))(
    "%s",
    (_id, item) => {
      const resource = createWordPictureGameResource(
        defaultVocabulary,
        item.vocabularyItemId,
        3,
        `sweep-${item.vocabularyItemId}`
      );
      expect(parseResourceManifest(resource)).toEqual(resource);
      expect(resource.vocabulary).toHaveLength(3);

      const ids = resource.vocabulary.map(label);
      expect(new Set(ids).size).toBe(3);
      expect(ids).toContain(item.vocabularyItemId);

      const round = createWordPictureRound(resource);
      expect(round.word).toBe(item.vocabularyItemId);

      const won = chooseWordPicture(round, item.vocabularyItemId);
      expect(won.attempt).toEqual({ kind: "correct" });
      expect(won.round.status).toBe("won");

      /* Every distractor must be a real loss, never a second right answer. */
      for (const other of ids.filter((id) => id !== item.vocabularyItemId)) {
        const wrong = chooseWordPicture(round, other);
        expect(wrong.attempt, other).toEqual({ kind: "incorrect" });
      }
    }
  );
});

describe("pairs rounds over the real vocabulary", () => {
  it.each([2, 3, 4, 5, 6, 7, 8])("is winnable with %i pairs", (pairCount) => {
    const resource = createPairsGameResource(
      defaultVocabulary,
      pairCount,
      `sweep-pairs-${pairCount}`
    );
    expect(parseResourceManifest(resource)).toEqual(resource);
    expect(resource.vocabulary).toHaveLength(pairCount);
    expect(new Set(resource.vocabulary.map(label)).size).toBe(pairCount);

    let round = createPairsRound(resource);
    for (const item of resource.vocabulary) {
      round = selectPairsCard(round, `${item.vocabularyItemId}-picture`).round;
      round = selectPairsCard(round, `${item.vocabularyItemId}-word`).round;
    }
    expect(round.status).toBe("won");
    expect(round.livesRemaining).toBe(ROUND_LIVES);
  });

  it("draws the same set for the same seed and a different one otherwise", () => {
    const first = createPairsGameResource(defaultVocabulary, 4, "seed-one");
    expect(createPairsGameResource(defaultVocabulary, 4, "seed-one")).toEqual(
      first
    );

    const second = createPairsGameResource(defaultVocabulary, 4, "seed-two");
    expect(second.vocabulary.map(label)).not.toEqual(first.vocabulary.map(label));
  });
});

describe("builders refuse content they cannot play", () => {
  it("refuses a single-syllable word for segmentation", () => {
    const single = defaultVocabulary.find((item) => item.syllables.length === 1);
    expect(single, "the vocabulary has a one-syllable word").toBeDefined();
    expect(() =>
      createSyllablesGameResource(
        defaultVocabulary,
        single!.vocabularyItemId,
        "seed"
      )
    ).toThrow("cannot be segmented");
  });

  /* No shipped word is one letter long, so this one is made for the purpose. */
  it("refuses a single-letter word for spelling", () => {
    expect(
      defaultVocabulary.every((item) => wordLetters(item).length >= LETTERS_MINIMUM)
    ).toBe(true);
    expect(() =>
      createLettersGameResource(
        [{ vocabularyItemId: "a", syllables: ["a"], imageUrl: "/vocabulary/a.webp" }],
        "a",
        "seed"
      )
    ).toThrow("cannot be spelled out");
  });

  it("refuses a word too long to show as letter cards", () => {
    const long = defaultVocabulary.find(
      (item) => wordLetters(item).length > LETTERS_MAXIMUM
    );
    expect(long, "the vocabulary has a long word").toBeDefined();
    expect(() =>
      createLettersGameResource(
        defaultVocabulary,
        long!.vocabularyItemId,
        "seed"
      )
    ).toThrow("this game shows");
  });

  it("refuses more pairs than the vocabulary holds", () => {
    expect(() =>
      createPairsGameResource(defaultVocabulary, defaultVocabulary.length + 1, "s")
    ).toThrow("but only");
  });

  it("refuses a target it does not have", () => {
    expect(() =>
      createWordPictureGameResource(defaultVocabulary, "no-such-word", 3, "s")
    ).toThrow("No vocabulary item named no-such-word");
  });
});
