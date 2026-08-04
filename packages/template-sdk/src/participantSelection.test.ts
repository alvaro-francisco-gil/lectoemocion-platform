import { describe, expect, it } from "vitest";
import {
  childRecordId,
  mediaAssetId,
  type ChildRecord
} from "@lectoemocion/domain";
import { selectParticipants } from "./participantSelection";

function child(
  id: string,
  displayName: string,
  verifiedInitial: string
): ChildRecord {
  return {
    id: childRecordId(id),
    displayName,
    verifiedInitial,
    photoAssetId: mediaAssetId(`photo-${id}`),
    pronunciationAssetId: mediaAssetId(`audio-${id}`)
  };
}

const roster: ChildRecord[] = [
  child("1", "Ana", "A"),
  child("2", "Álex", "A"),
  child("3", "Bruno", "B"),
  child("4", "Luna", "L")
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
