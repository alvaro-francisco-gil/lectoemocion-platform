import { describe, expect, it } from "vitest";
import { parseResourceManifest } from "./resourceManifest";

const validManifest = {
  schemaVersion: 1,
  resourceId: "resource-1",
  template: { id: "name-story", version: 1 },
  seed: "class-a-lesson-1",
  participants: [
    {
      childRecordId: "child-1",
      displayName: "Luna",
      verifiedInitial: "L",
      photoUrl: "/synthetic/luna.svg",
      pronunciationUrl: "/synthetic/silence.mp3"
    }
  ]
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
});
