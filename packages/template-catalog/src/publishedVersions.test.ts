import { describe, expect, it } from "vitest";
import {
  createIllustratedStoryResource,
  createInitialLetterGameResource,
  createInitialsGameResource,
  createLettersGameResource,
  createNameStoryResource,
  createPairsGameResource,
  createSyllablesGameResource,
  createWordPictureGameResource
} from ".";
import { defaultVocabulary } from "./fixtures/defaultVocabulary";
import { syntheticClass } from "./fixtures/syntheticClass";

const casa = {
  vocabularyItemId: "casa",
  syllables: ["ca", "sa"],
  imageUrl: "/vocabulary/casa.webp"
};

const flor = {
  vocabularyItemId: "flor",
  syllables: ["flor"],
  imageUrl: "/vocabulary/flor.webp"
};

const sol = {
  vocabularyItemId: "sol",
  syllables: ["sol"],
  imageUrl: "/vocabulary/sol.webp"
};

const luna = {
  vocabularyItemId: "luna",
  syllables: ["lu", "na"],
  imageUrl: "/vocabulary/luna.webp"
};

const mariposa = {
  vocabularyItemId: "mariposa",
  syllables: ["ma", "ri", "po", "sa"],
  imageUrl: "/vocabulary/mariposa.webp"
};

/**
 * A frozen vocabulary, deliberately *not* `defaultVocabulary`.
 *
 * Invariant 5 pins what a published version produces from a given input. Which
 * words the catalogue currently ships is content, not version — if these pins
 * read the live catalogue, adding one picture would present as a breaking
 * version change and no word could ever be added. So the version pins feed a
 * fixture that never moves, and `defaultVocabulary` is checked separately for
 * being well-formed.
 */
const PINNED = [casa, flor, sol, luna, mariposa];

/**
 * Invariant 5 (AGENTS.md): published template and manifest versions are
 * immutable. Behaviour changes create a new version.
 *
 * These snapshots are the enforcement. If a change alters the shape or content
 * a published version produces, this test fails — and the correct response is
 * to publish a new version, not to update the expectation.
 */
describe("published versions are immutable", () => {
  it("pins the manifest schema version", () => {
    expect(createNameStoryResource("seed").schemaVersion).toBe(1);
  });

  /**
   * Version 2 replaced participants with slots. Version 1 is not pinned here
   * because it was deleted rather than carried: it was never reachable by a
   * user, so it was never published. See ADR 0006.
   */
  it("pins name-story version 2 default output", () => {
    expect(createNameStoryResource("immutability-seed")).toEqual({
      schemaVersion: 1,
      resourceId: "name-story-immutability-seed",
      template: { id: "name-story", version: 2 },
      seed: "immutability-seed",
      slots: [
        {
          slotId: "character-1",
          default: {
            displayName: "Ada",
            verifiedInitial: "A",
            photoUrl: "/synthetic/character-ada.svg",
            pronunciationUrl: "/synthetic/silent-ada.mp3"
          }
        },
        {
          slotId: "character-2",
          default: {
            displayName: "Aro",
            verifiedInitial: "A",
            photoUrl: "/synthetic/character-aro.svg",
            pronunciationUrl: "/synthetic/silent-aro.mp3"
          }
        },
        {
          slotId: "character-3",
          default: {
            displayName: "Bibi",
            verifiedInitial: "B",
            photoUrl: "/synthetic/character-bibi.svg",
            pronunciationUrl: "/synthetic/silent-bibi.mp3"
          }
        },
        {
          slotId: "character-4",
          default: {
            displayName: "Bruma",
            verifiedInitial: "B",
            photoUrl: "/synthetic/character-bruma.svg",
            pronunciationUrl: "/synthetic/silent-bruma.mp3"
          }
        },
        {
          slotId: "character-5",
          default: {
            displayName: "Luli",
            verifiedInitial: "L",
            photoUrl: "/synthetic/character-luli.svg",
            pronunciationUrl: "/synthetic/silent-luli.mp3"
          }
        },
        {
          slotId: "character-6",
          default: {
            displayName: "Mimo",
            verifiedInitial: "M",
            photoUrl: "/synthetic/character-mimo.svg",
            pronunciationUrl: "/synthetic/silent-mimo.mp3"
          }
        },
        {
          slotId: "character-7",
          default: {
            displayName: "Nube",
            verifiedInitial: "N",
            photoUrl: "/synthetic/character-nube.svg",
            pronunciationUrl: "/synthetic/silent-nube.mp3"
          }
        },
        {
          slotId: "character-8",
          default: {
            displayName: "Sena",
            verifiedInitial: "S",
            photoUrl: "/synthetic/character-sena.svg",
            pronunciationUrl: "/synthetic/silent-sena.mp3"
          }
        }
      ]
    });
  });

  it("pins a personalised slot's shape", () => {
    const [first] = createNameStoryResource(
      "immutability-seed",
      syntheticClass
    ).slots;

    expect(first).toEqual({
      slotId: "character-1",
      default: {
        displayName: "Ada",
        verifiedInitial: "A",
        photoUrl: "/synthetic/character-ada.svg",
        pronunciationUrl: "/synthetic/silent-ada.mp3"
      },
      personalised: {
        childRecordId: "ana",
        displayName: "Ana",
        verifiedInitial: "A",
        photoUrl: "/synthetic/avatar-ana.svg",
        pronunciationUrl: "/synthetic/silent-ana.mp3"
      }
    });
  });

  /**
   * The pages are the book, and the book is content — pinning all thirty-one
   * here would make this test a second copy of the fixture, so that a
   * transcription fix would read as a breaking version change. Same reasoning
   * as `PINNED` above. What version 1 owes is the shape: an envelope, and pages
   * that each carry a picture, a recording, and what they teach.
   */
  it("pins illustrated-story version 1 output shape", () => {
    const resource = createIllustratedStoryResource("gallo-rayo", "immutability-seed");

    expect(resource.schemaVersion).toBe(1);
    expect(resource.resourceId).toBe("illustrated-story-gallo-rayo-immutability-seed");
    expect(resource.template).toEqual({ id: "illustrated-story", version: 1 });
    expect(resource.pages[0]).toEqual({
      kind: "cover",
      pageId: "portada",
      imageUrl: "/story/gallo-rayo/00.webp",
      audioUrl: "/story/gallo-rayo/00.m4a"
    });
    expect(resource.pages[1]).toEqual({
      kind: "letter",
      pageId: "c-k",
      grapheme: "C",
      sound: "K",
      imageUrl: "/story/gallo-rayo/01.webp",
      audioUrl: "/story/gallo-rayo/01.m4a"
    });
  });

  /**
   * The pages themselves are not pinned here — thirty-one of them would drown
   * this file, and `illustratedStory.test.ts` pins the book's order where that
   * order can be read. What version fixes is the envelope: the identifier a
   * stored resource resolves through, and the shape of a page.
   */
  it("pins illustrated-story version 1 output", () => {
    const story = createIllustratedStoryResource("gallo-rayo", "immutability-seed");

    expect(story.schemaVersion).toBe(1);
    expect(story.resourceId).toBe("illustrated-story-gallo-rayo-immutability-seed");
    expect(story.template).toEqual({ id: "illustrated-story", version: 1 });
    expect(story.pages[0]).toEqual({
      kind: "cover",
      pageId: "portada",
      imageUrl: "/story/gallo-rayo/00.webp",
      audioUrl: "/story/gallo-rayo/00.m4a"
    });
    expect(story.pages[1]).toEqual({
      kind: "letter",
      pageId: "c-k",
      grapheme: "C",
      sound: "K",
      imageUrl: "/story/gallo-rayo/01.webp",
      audioUrl: "/story/gallo-rayo/01.m4a"
    });
  });

  it("pins initials-game version 2 template parameters", () => {
    expect(createInitialsGameResource("A", "immutability-seed").template).toEqual(
      { id: "initials-game", version: 2, targetInitial: "A" }
    );
  });

  it("pins pairs-game version 1 output", () => {
    expect(createPairsGameResource(PINNED, 3, "immutability-seed")).toEqual({
      schemaVersion: 1,
      resourceId: "pairs-game-immutability-seed",
      template: { id: "pairs-game", version: 1 },
      seed: "immutability-seed",
      vocabulary: [casa, sol, flor]
    });
  });

  it("pins word-picture-game version 1 output", () => {
    expect(
      createWordPictureGameResource(PINNED, "casa", 3, "immutability-seed")
    ).toEqual({
      schemaVersion: 1,
      resourceId: "word-picture-game-immutability-seed",
      template: {
        id: "word-picture-game",
        version: 1,
        targetVocabularyItemId: "casa"
      },
      seed: "immutability-seed",
      vocabulary: [casa, mariposa, sol]
    });
  });

  it("pins initial-letter-game version 1 output", () => {
    expect(
      createInitialLetterGameResource(PINNED, 3, "immutability-seed")
    ).toEqual({
      schemaVersion: 1,
      resourceId: "initial-letter-game-immutability-seed",
      template: { id: "initial-letter-game", version: 1 },
      seed: "immutability-seed",
      vocabulary: [casa, sol, flor]
    });
  });

  it("pins syllables-game version 1 output", () => {
    expect(
      createSyllablesGameResource(PINNED, "mariposa", "immutability-seed")
    ).toEqual({
      schemaVersion: 1,
      resourceId: "syllables-game-immutability-seed",
      template: { id: "syllables-game", version: 1 },
      seed: "immutability-seed",
      vocabulary: [mariposa]
    });
  });

  it("pins letters-game version 1 output", () => {
    expect(
      createLettersGameResource(PINNED, "casa", "immutability-seed")
    ).toEqual({
      schemaVersion: 1,
      resourceId: "letters-game-immutability-seed",
      template: { id: "letters-game", version: 1 },
      seed: "immutability-seed",
      vocabulary: [casa]
    });
  });
});

/**
 * Content checks, not version checks. These may change freely as pictures are
 * added; what they guarantee is that the shipped catalogue is playable.
 */
describe("the default vocabulary is well formed", () => {
  it("gives every item a picture under /vocabulary/", () => {
    expect(defaultVocabulary.length).toBeGreaterThan(0);
    for (const item of defaultVocabulary) {
      expect(item.imageUrl.startsWith("/vocabulary/")).toBe(true);
      expect(item.syllables.length).toBeGreaterThan(0);
    }
  });

  it("has unique identifiers", () => {
    const ids = defaultVocabulary.map((item) => item.vocabularyItemId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("holds enough multi-syllable words for a syllables round", () => {
    const segmentable = defaultVocabulary.filter(
      (item) => item.syllables.length >= 2
    );
    expect(segmentable.length).toBeGreaterThan(10);
  });
});
