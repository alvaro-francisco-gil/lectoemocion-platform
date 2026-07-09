import { describe, expect, it } from "vitest";
import type { ChildRecord } from "@lectoemocion/domain";
import { selectParticipants } from "./participantSelection";

const roster: ChildRecord[] = [
  { id: "1", displayName: "Ana", verifiedInitial: "A", photoAssetId: "p1", pronunciationAssetId: "a1" },
  { id: "2", displayName: "Álex", verifiedInitial: "A", photoAssetId: "p2", pronunciationAssetId: "a2" },
  { id: "3", displayName: "Bruno", verifiedInitial: "B", photoAssetId: "p3", pronunciationAssetId: "a3" },
  { id: "4", displayName: "Luna", verifiedInitial: "L", photoAssetId: "p4", pronunciationAssetId: "a4" }
];

describe("selectParticipants", () => {
  it("returns the whole class without mutation", () => {
    expect(selectParticipants(roster, { kind: "whole-class" }, "seed")).toEqual(roster);
    expect(roster.map((child) => child.id)).toEqual(["1", "2", "3", "4"]);
  });

  it("filters records by verified initial", () => {
    expect(
      selectParticipants(roster, { kind: "matching-initial", initial: "A" }, "seed")
        .map((child) => child.id)
    ).toEqual(["1", "2"]);
  });

  it("returns the same seeded subset on repeated calls", () => {
    const strategy = { kind: "seeded-subset", count: 2 } as const;
    expect(selectParticipants(roster, strategy, "lesson-1"))
      .toEqual(selectParticipants(roster, strategy, "lesson-1"));
  });

  it("rejects an oversized subset", () => {
    expect(() =>
      selectParticipants(roster, { kind: "seeded-subset", count: 5 }, "seed")
    ).toThrow("requires 5 participants but only 4 are available");
  });
});
