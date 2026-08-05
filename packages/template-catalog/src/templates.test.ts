import { describe, expect, it } from "vitest";
import {
  parseResourceManifest,
  resolveSlot
} from "@lectoemocion/resource-schema";
import {
  createInitialsGameResource,
  createNameStoryResource,
  defaultCharacters,
  syntheticClass
} from ".";

describe("roster templates play without a roster", () => {
  it("builds a name story from default content alone", () => {
    const resource = createNameStoryResource("story-seed");
    expect(parseResourceManifest(resource)).toEqual(resource);
    expect(resource.slots).toHaveLength(defaultCharacters.length);
    expect(
      resource.slots.every((slot) => slot.personalised === undefined)
    ).toBe(true);
  });

  it("builds an initials game from default content alone", () => {
    const resource = createInitialsGameResource("A", "game-seed");
    expect(parseResourceManifest(resource)).toEqual(resource);
    expect(
      resource.slots.some((slot) => resolveSlot(slot).verifiedInitial === "A")
    ).toBe(true);
  });

  it("fails closed when no character carries the target initial", () => {
    expect(() => createInitialsGameResource("Z", "game-seed")).toThrow(
      "initial Z"
    );
  });
});

describe("personalisation overrides defaults slot by slot", () => {
  it("replaces as many slots as there are children, and no more", () => {
    const resource = createNameStoryResource("story-seed", syntheticClass);
    const personalised = resource.slots.filter(
      (slot) => slot.personalised !== undefined
    );

    expect(personalised).toHaveLength(
      Math.min(syntheticClass.length, defaultCharacters.length)
    );
    expect(resource.slots).toHaveLength(defaultCharacters.length);
  });

  it("keeps the default underneath, so removing a child restores it", () => {
    const personalised = createNameStoryResource("story-seed", syntheticClass);
    const bare = createNameStoryResource("story-seed");

    expect(personalised.slots.map((slot) => slot.default)).toEqual(
      bare.slots.map((slot) => slot.default)
    );
  });

  it("resolves a personalised slot to the child, not the default", () => {
    const resource = createNameStoryResource("story-seed", syntheticClass);
    const first = resource.slots[0];
    expect(first).toBeDefined();
    expect(resolveSlot(first!).displayName).toBe(syntheticClass[0]!.displayName);
  });
});
