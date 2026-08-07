import { describe, expect, it } from "vitest";
// @ts-expect-error the generator is untyped tooling, deliberately outside the workspace packages
import { CLASS } from "../../../../scripts/generate-synthetic-cast.mjs";
import { syntheticClass } from "./syntheticClass";

/**
 * The fixture and the generator name the same children, or neither is usable.
 *
 * They cannot share a declaration: `scripts/` runs before and independently of
 * any install step, so it cannot import a workspace package. This test is what
 * stands in for that — without it, adding a child to the fixture and forgetting
 * to regenerate would show up as a photo that silently fails to load, which is
 * exactly the failure the book is designed to survive and therefore the one
 * nobody would notice.
 */
describe("the synthetic class and its generated media", () => {
  const generated = new Set((CLASS as readonly (readonly string[])[]).map((entry) => entry[0]));

  it("name the same children", () => {
    const fixture = new Set(syntheticClass.map((child) => child.id));
    expect([...generated].sort()).toEqual([...fixture].sort());
  });

  it("gives every child a photo and a recording named after their id", () => {
    for (const child of syntheticClass) {
      expect(child.photoAssetId).toBe(`avatar-${child.id}`);
      expect(child.pronunciationAssetId).toBe(`silent-${child.id}`);
    }
  });
});
