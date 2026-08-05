import { describe, expect, it } from "vitest";
import { parseResourceManifest } from "@lectoemocion/resource-schema";
import {
  createPairsGameResource,
  createSyllablesGameResource,
  createWordPictureGameResource,
  defaultVocabulary
} from ".";

describe("createPairsGameResource", () => {
  it("creates a valid manifest with the requested number of pairs", () => {
    const resource = createPairsGameResource(defaultVocabulary, 3, "pairs-seed");
    expect(parseResourceManifest(resource)).toEqual(resource);
    expect(resource.vocabulary).toHaveLength(3);
  });

  it("selects the same items for the same seed", () => {
    expect(createPairsGameResource(defaultVocabulary, 3, "pairs-seed")).toEqual(
      createPairsGameResource(defaultVocabulary, 3, "pairs-seed")
    );
  });

  it("rejects more pairs than the vocabulary holds", () => {
    expect(() => createPairsGameResource(defaultVocabulary, 99, "seed")).toThrow(
      "Template requires 99 vocabulary items but only 8 are available"
    );
  });
});

describe("createWordPictureGameResource", () => {
  it("creates a valid manifest containing the target and its distractors", () => {
    const resource = createWordPictureGameResource(
      defaultVocabulary,
      "casa",
      3,
      "word-seed"
    );
    expect(parseResourceManifest(resource)).toEqual(resource);
    expect(resource.template.targetVocabularyItemId).toBe("casa");
    expect(resource.vocabulary).toHaveLength(3);
    expect(
      resource.vocabulary.map((item) => item.vocabularyItemId)
    ).toContain("casa");
  });

  it("never repeats the target among the distractors", () => {
    const resource = createWordPictureGameResource(
      defaultVocabulary,
      "casa",
      4,
      "word-seed"
    );
    const ids = resource.vocabulary.map((item) => item.vocabularyItemId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("rejects a target that is not in the vocabulary", () => {
    expect(() =>
      createWordPictureGameResource(defaultVocabulary, "dinosaurio", 3, "seed")
    ).toThrow("No vocabulary item named dinosaurio");
  });
});

describe("createSyllablesGameResource", () => {
  it("creates a valid manifest holding only the target", () => {
    const resource = createSyllablesGameResource(
      defaultVocabulary,
      "mariposa",
      "syllables-seed"
    );
    expect(parseResourceManifest(resource)).toEqual(resource);
    expect(resource.vocabulary).toHaveLength(1);
    expect(resource.vocabulary[0]?.syllables).toEqual(["ma", "ri", "po", "sa"]);
  });

  it("rejects a single-syllable target", () => {
    expect(() =>
      createSyllablesGameResource(defaultVocabulary, "sol", "seed")
    ).toThrow("sol has one syllable and cannot be segmented");
  });

  it("rejects a target that is not in the vocabulary", () => {
    expect(() =>
      createSyllablesGameResource(defaultVocabulary, "dinosaurio", "seed")
    ).toThrow("No vocabulary item named dinosaurio");
  });
});

describe("default vocabulary", () => {
  it("has unique identifiers", () => {
    const ids = defaultVocabulary.map((item) => item.vocabularyItemId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("carries no child data", () => {
    for (const item of defaultVocabulary) {
      expect(item.imageUrl.startsWith("/synthetic/")).toBe(true);
    }
  });
});
