import { describe, expect, it } from "vitest";
import { createInitialsGameResource, createNameStoryResource } from ".";
import { syntheticClass } from "./fixtures/syntheticClass";

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
});
