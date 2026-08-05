import { describe, expect, it } from "vitest";
import { seededDerangement, seededShuffle } from "./seededRandom";

const items = ["a", "b", "c", "d", "e"];

describe("seededShuffle", () => {
  it("returns the same order for the same seed", () => {
    expect(seededShuffle(items, "lesson-1")).toEqual(
      seededShuffle(items, "lesson-1")
    );
  });

  it("keeps every item exactly once", () => {
    expect([...seededShuffle(items, "lesson-1")].sort()).toEqual([...items].sort());
  });

  it("does not mutate its input", () => {
    seededShuffle(items, "lesson-1");
    expect(items).toEqual(["a", "b", "c", "d", "e"]);
  });
});

describe("seededDerangement", () => {
  it("returns the same order for the same seed", () => {
    expect(seededDerangement(items, "lesson-1")).toEqual(
      seededDerangement(items, "lesson-1")
    );
  });

  it.each([2, 3, 4, 5])("leaves no item at its own index for %i items", (size) => {
    const subset = items.slice(0, size);
    for (const seed of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      const deranged = seededDerangement(subset, seed);
      expect(deranged).toHaveLength(size);
      subset.forEach((item, index) => {
        expect(deranged[index]).not.toBe(item);
      });
    }
  });

  it("terminates for repeated items, where no value-derangement exists", () => {
    expect(seededDerangement(["ca", "ca"], "seed")).toEqual(["ca", "ca"]);
  });

  it("rejects a single item, which cannot be deranged", () => {
    expect(() => seededDerangement(["only"], "seed")).toThrow(
      "A derangement requires at least two items"
    );
  });
});
