import { describe, expect, it } from "vitest";
import { parseResourceManifest } from "@lectoemocion/resource-schema";
import { createInitialSyllableRound } from "@lectoemocion/template-sdk";
import {
  createInitialSyllableGameResource,
  createPairsGameResource,
  createSyllablesGameResource,
  createWordPictureGameResource,
  defaultVocabulary
} from ".";

/**
 * A local fixture, so these test the builders rather than whichever words the
 * catalogue happens to ship today. `defaultVocabulary` is covered separately in
 * `publishedVersions.test.ts`.
 */
const vocabulary = [
  { vocabularyItemId: "casa", syllables: ["ca", "sa"], imageUrl: "/vocabulary/casa.webp" },
  { vocabularyItemId: "luna", syllables: ["lu", "na"], imageUrl: "/vocabulary/luna.webp" },
  { vocabularyItemId: "sol", syllables: ["sol"], imageUrl: "/vocabulary/sol.webp" },
  {
    vocabularyItemId: "mariposa",
    syllables: ["ma", "ri", "po", "sa"],
    imageUrl: "/vocabulary/mariposa.webp"
  }
];

describe("createPairsGameResource", () => {
  it("creates a valid manifest with the requested number of pairs", () => {
    const resource = createPairsGameResource(vocabulary, 3, "pairs-seed");
    expect(parseResourceManifest(resource)).toEqual(resource);
    expect(resource.vocabulary).toHaveLength(3);
  });

  it("selects the same items for the same seed", () => {
    expect(createPairsGameResource(vocabulary, 3, "pairs-seed")).toEqual(
      createPairsGameResource(vocabulary, 3, "pairs-seed")
    );
  });

  it("rejects more pairs than the vocabulary holds", () => {
    expect(() => createPairsGameResource(vocabulary, 99, "seed")).toThrow(
      "Template requires 99 vocabulary items but only 4 are available"
    );
  });
});

describe("createWordPictureGameResource", () => {
  it("creates a valid manifest containing the target and its distractors", () => {
    const resource = createWordPictureGameResource(
      vocabulary,
      "casa",
      3,
      "word-seed"
    );
    expect(parseResourceManifest(resource)).toEqual(resource);
    expect(resource.template.targetVocabularyItemId).toBe("casa");
    expect(resource.vocabulary).toHaveLength(3);
    expect(resource.vocabulary.map((item) => item.vocabularyItemId)).toContain(
      "casa"
    );
  });

  it("never repeats the target among the distractors", () => {
    const resource = createWordPictureGameResource(
      vocabulary,
      "casa",
      4,
      "word-seed"
    );
    const ids = resource.vocabulary.map((item) => item.vocabularyItemId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("rejects a target that is not in the vocabulary", () => {
    expect(() =>
      createWordPictureGameResource(vocabulary, "dinosaurio", 3, "seed")
    ).toThrow("No vocabulary item named dinosaurio");
  });
});

describe("createSyllablesGameResource", () => {
  it("creates a valid manifest holding only the target", () => {
    const resource = createSyllablesGameResource(
      vocabulary,
      "mariposa",
      "syllables-seed"
    );
    expect(parseResourceManifest(resource)).toEqual(resource);
    expect(resource.vocabulary).toHaveLength(1);
    expect(resource.vocabulary[0]?.syllables).toEqual(["ma", "ri", "po", "sa"]);
  });

  it("rejects a single-syllable target", () => {
    expect(() => createSyllablesGameResource(vocabulary, "sol", "seed")).toThrow(
      "sol has one syllable and cannot be segmented"
    );
  });

  it("rejects a target that is not in the vocabulary", () => {
    expect(() =>
      createSyllablesGameResource(vocabulary, "dinosaurio", "seed")
    ).toThrow("No vocabulary item named dinosaurio");
  });
});

describe("createInitialSyllableGameResource", () => {
  /* `casa` and `caramelo` share `ca`; `luna` and `sol` and `mariposa` do not. */
  const family = [
    ...vocabulary,
    {
      vocabularyItemId: "caramelo",
      syllables: ["ca", "ra", "me", "lo"],
      imageUrl: "/vocabulary/caramelo.webp"
    }
  ];

  it("creates a valid manifest of the target and three choices", () => {
    const resource = createInitialSyllableGameResource(
      family,
      "casa",
      "initial-seed"
    );
    expect(parseResourceManifest(resource)).toEqual(resource);
    expect(resource.template.targetVocabularyItemId).toBe("casa");
    expect(resource.template.matchVocabularyItemId).toBe("caramelo");
    expect(resource.vocabulary).toHaveLength(4);
  });

  it("draws the same match and distractors for the same seed", () => {
    expect(
      createInitialSyllableGameResource(family, "casa", "initial-seed")
    ).toEqual(createInitialSyllableGameResource(family, "casa", "initial-seed"));
  });

  it("draws no distractor that also opens with the target's syllable", () => {
    const crowded = [
      ...family,
      {
        vocabularyItemId: "cama",
        syllables: ["ca", "ma"],
        imageUrl: "/vocabulary/cama.webp"
      }
    ];
    const resource = createInitialSyllableGameResource(
      crowded,
      "casa",
      "initial-seed"
    );
    /* The round refuses two right answers, so building one must not produce it. */
    expect(() => createInitialSyllableRound(resource)).not.toThrow();
  });

  /*
   * `CARAMELO` and `CARAMELOS` emphasise the same `CA` and read as one word
   * twice. The draw skips a candidate written inside the target, or vice versa.
   */
  it("never matches a word that is written inside the target", () => {
    const plural = [
      {
        vocabularyItemId: "caramelo",
        syllables: ["ca", "ra", "me", "lo"],
        imageUrl: "/vocabulary/caramelo.webp"
      },
      {
        vocabularyItemId: "caramelos",
        syllables: ["ca", "ra", "me", "los"],
        imageUrl: "/vocabulary/caramelos.webp"
      },
      ...vocabulary
    ];
    expect(
      createInitialSyllableGameResource(plural, "caramelo", "seed")
        .template.matchVocabularyItemId
    ).toBe("casa");
  });

  it("rejects a target whose opening syllable nothing shares", () => {
    expect(() =>
      createInitialSyllableGameResource(vocabulary, "luna", "seed")
    ).toThrow("No word shares an opening syllable with luna");
  });

  it("rejects a target that is not in the vocabulary", () => {
    expect(() =>
      createInitialSyllableGameResource(family, "dinosaurio", "seed")
    ).toThrow("No vocabulary item named dinosaurio");
  });
});

describe("the shipped catalogue is playable", () => {
  it("builds every vocabulary game the world asks for", () => {
    expect(() => {
      createPairsGameResource(defaultVocabulary, 3, "smoke");
      createWordPictureGameResource(defaultVocabulary, "manzana", 3, "smoke");
      createSyllablesGameResource(defaultVocabulary, "mariposa", "smoke");
      createInitialSyllableGameResource(defaultVocabulary, "gato", "smoke");
    }).not.toThrow();
  });
});
