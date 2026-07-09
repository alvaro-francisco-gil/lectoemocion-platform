import { describe, expect, it } from "vitest";
import { parseResourceManifest } from "@lectoemocion/resource-schema";
import {
  createInitialsGameResource,
  createNameStoryResource,
  syntheticClass
} from ".";

describe("synthetic template catalogue", () => {
  it("creates a valid whole-class name story", () => {
    const resource = createNameStoryResource(syntheticClass, "story-seed");
    expect(parseResourceManifest(resource)).toEqual(resource);
    expect(resource.participants).toHaveLength(syntheticClass.length);
  });

  it("creates a valid initials game", () => {
    const resource = createInitialsGameResource(
      syntheticClass,
      "A",
      "game-seed"
    );
    expect(parseResourceManifest(resource)).toEqual(resource);
    expect(resource.participants.some((child) => child.verifiedInitial === "A"))
      .toBe(true);
  });
});
