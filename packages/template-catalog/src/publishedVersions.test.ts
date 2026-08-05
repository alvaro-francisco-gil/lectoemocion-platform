import { describe, expect, it } from "vitest";
import {
  createInitialsGameResource,
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
  imageUrl: "/synthetic/picture-casa.svg"
};

const flor = {
  vocabularyItemId: "flor",
  syllables: ["flor"],
  imageUrl: "/synthetic/picture-flor.svg"
};

const sol = {
  vocabularyItemId: "sol",
  syllables: ["sol"],
  imageUrl: "/synthetic/picture-sol.svg"
};

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
    expect(createNameStoryResource(syntheticClass, "seed").schemaVersion).toBe(1);
  });

  it("pins name-story version 1 output", () => {
    expect(createNameStoryResource(syntheticClass, "immutability-seed")).toEqual({
      schemaVersion: 1,
      resourceId: "name-story-immutability-seed",
      template: { id: "name-story", version: 1 },
      seed: "immutability-seed",
      participants: [
        {
          childRecordId: "ana",
          displayName: "Ana",
          verifiedInitial: "A",
          photoUrl: "/synthetic/avatar-ana.svg",
          pronunciationUrl: "/synthetic/silent-ana.mp3"
        },
        {
          childRecordId: "alex",
          displayName: "Álex",
          verifiedInitial: "A",
          photoUrl: "/synthetic/avatar-alex.svg",
          pronunciationUrl: "/synthetic/silent-alex.mp3"
        },
        {
          childRecordId: "bruno",
          displayName: "Bruno",
          verifiedInitial: "B",
          photoUrl: "/synthetic/avatar-bruno.svg",
          pronunciationUrl: "/synthetic/silent-bruno.mp3"
        },
        {
          childRecordId: "luna",
          displayName: "Luna",
          verifiedInitial: "L",
          photoUrl: "/synthetic/avatar-luna.svg",
          pronunciationUrl: "/synthetic/silent-luna.mp3"
        }
      ]
    });
  });

  it("pins initials-game version 1 template parameters", () => {
    expect(
      createInitialsGameResource(syntheticClass, "A", "immutability-seed").template
    ).toEqual({ id: "initials-game", version: 1, targetInitial: "A" });
  });

  it("pins pairs-game version 1 output", () => {
    expect(
      createPairsGameResource(defaultVocabulary, 3, "immutability-seed")
    ).toEqual({
      schemaVersion: 1,
      resourceId: "pairs-game-immutability-seed",
      template: { id: "pairs-game", version: 1 },
      seed: "immutability-seed",
      vocabulary: [
        {
          vocabularyItemId: "luna",
          syllables: ["lu", "na"],
          imageUrl: "/synthetic/picture-luna.svg"
        },
        {
          vocabularyItemId: "zapato",
          syllables: ["za", "pa", "to"],
          imageUrl: "/synthetic/picture-zapato.svg"
        },
        flor
      ]
    });
  });

  it("pins word-picture-game version 1 output", () => {
    expect(
      createWordPictureGameResource(
        defaultVocabulary,
        "casa",
        3,
        "immutability-seed"
      )
    ).toEqual({
      schemaVersion: 1,
      resourceId: "word-picture-game-immutability-seed",
      template: {
        id: "word-picture-game",
        version: 1,
        targetVocabularyItemId: "casa"
      },
      seed: "immutability-seed",
      vocabulary: [casa, flor, sol]
    });
  });

  it("pins syllables-game version 1 output", () => {
    expect(
      createSyllablesGameResource(defaultVocabulary, "mariposa", "immutability-seed")
    ).toEqual({
      schemaVersion: 1,
      resourceId: "syllables-game-immutability-seed",
      template: { id: "syllables-game", version: 1 },
      seed: "immutability-seed",
      vocabulary: [
        {
          vocabularyItemId: "mariposa",
          syllables: ["ma", "ri", "po", "sa"],
          imageUrl: "/synthetic/picture-mariposa.svg"
        }
      ]
    });
  });
});
