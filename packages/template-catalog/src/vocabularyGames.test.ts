import { describe, expect, it } from "vitest";
import { parseResourceManifest } from "@lectoemocion/resource-schema";
import {
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

describe("the shipped catalogue is playable", () => {
  it("builds every vocabulary game the world asks for", () => {
    expect(() => {
      createPairsGameResource(defaultVocabulary, 3, "smoke");
      createWordPictureGameResource(defaultVocabulary, "manzana", 3, "smoke");
      createSyllablesGameResource(defaultVocabulary, "mariposa", "smoke");
    }).not.toThrow();
  });
});
