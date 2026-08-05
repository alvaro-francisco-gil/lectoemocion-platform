import { describe, expect, it } from "vitest";
import { parseResourceManifest, vocabularyWord } from "./resourceManifest";

const validManifest = {
  schemaVersion: 1,
  resourceId: "resource-1",
  template: { id: "name-story", version: 2 },
  seed: "class-a-lesson-1",
  slots: [
    {
      slotId: "character-1",
      default: {
        displayName: "Nube",
        verifiedInitial: "N",
        photoUrl: "/synthetic/character-nube.svg",
        pronunciationUrl: "/synthetic/silent-nube.mp3"
      },
      personalised: {
        childRecordId: "child-1",
        displayName: "Luna",
        verifiedInitial: "L",
        photoUrl: "/synthetic/luna.svg",
        pronunciationUrl: "/synthetic/silence.mp3"
      }
    }
  ]
};

const casa = {
  vocabularyItemId: "casa",
  syllables: ["ca", "sa"],
  imageUrl: "/synthetic/shape-casa.svg"
};

const sol = {
  vocabularyItemId: "sol",
  syllables: ["sol"],
  imageUrl: "/synthetic/shape-sol.svg"
};

const validPairsManifest = {
  schemaVersion: 1,
  resourceId: "pairs-1",
  template: { id: "pairs-game", version: 1 },
  seed: "lesson-1",
  vocabulary: [casa, sol]
};

const validWordPictureManifest = {
  schemaVersion: 1,
  resourceId: "word-picture-1",
  template: { id: "word-picture-game", version: 1, targetVocabularyItemId: "casa" },
  seed: "lesson-1",
  vocabulary: [casa, sol]
};

const validSyllablesManifest = {
  schemaVersion: 1,
  resourceId: "syllables-1",
  template: { id: "syllables-game", version: 1 },
  seed: "lesson-1",
  vocabulary: [casa]
};

describe("parseResourceManifest", () => {
  it("accepts a valid version-one manifest", () => {
    expect(parseResourceManifest(validManifest)).toEqual(validManifest);
  });

  it("rejects executable template data", () => {
    expect(() =>
      parseResourceManifest({
        ...validManifest,
        script: "alert('unsafe')"
      })
    ).toThrow("Invalid resource manifest");
  });

  it("rejects an unknown schema version", () => {
    expect(() =>
      parseResourceManifest({ ...validManifest, schemaVersion: 2 })
    ).toThrow("Invalid resource manifest");
  });

  it.each([
    ["pairs-game", validPairsManifest],
    ["word-picture-game", validWordPictureManifest],
    ["syllables-game", validSyllablesManifest]
  ])("accepts a valid %s manifest", (_id, manifest) => {
    expect(parseResourceManifest(manifest)).toEqual(manifest);
  });

  it("rejects a vocabulary resource that also carries slots", () => {
    expect(() =>
      parseResourceManifest({
        ...validPairsManifest,
        slots: validManifest.slots
      })
    ).toThrow("Invalid resource manifest");
  });

  it("rejects a slot with no default content", () => {
    expect(() =>
      parseResourceManifest({
        ...validManifest,
        slots: [{ slotId: "character-1" }]
      })
    ).toThrow("Invalid resource manifest");
  });

  it("rejects a retired template version", () => {
    expect(() =>
      parseResourceManifest({
        ...validManifest,
        template: { id: "name-story", version: 1 }
      })
    ).toThrow("Invalid resource manifest");
  });

  it("rejects a roster resource that also carries vocabulary", () => {
    expect(() =>
      parseResourceManifest({ ...validManifest, vocabulary: [casa] })
    ).toThrow("Invalid resource manifest");
  });

  it("rejects a vocabulary item carrying a word alongside its syllables", () => {
    expect(() =>
      parseResourceManifest({
        ...validPairsManifest,
        vocabulary: [{ ...casa, word: "casa" }]
      })
    ).toThrow("Invalid resource manifest");
  });

  it("rejects a pairs round with fewer than two items", () => {
    expect(() =>
      parseResourceManifest({ ...validPairsManifest, vocabulary: [casa] })
    ).toThrow("Invalid resource manifest");
  });

  it("rejects a word-picture round with no distractor", () => {
    expect(() =>
      parseResourceManifest({ ...validWordPictureManifest, vocabulary: [casa] })
    ).toThrow("Invalid resource manifest");
  });

  it("rejects a single-syllable syllables target", () => {
    expect(() =>
      parseResourceManifest({ ...validSyllablesManifest, vocabulary: [sol] })
    ).toThrow("Invalid resource manifest");
  });

  it("rejects more than one syllables target", () => {
    expect(() =>
      parseResourceManifest({
        ...validSyllablesManifest,
        vocabulary: [casa, { ...casa, vocabularyItemId: "mesa" }]
      })
    ).toThrow("Invalid resource manifest");
  });
});

describe("vocabularyWord", () => {
  it("derives the word from its syllables", () => {
    expect(vocabularyWord(casa)).toBe("casa");
  });
});
