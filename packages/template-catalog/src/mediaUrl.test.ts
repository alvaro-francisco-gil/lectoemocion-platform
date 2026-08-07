import { childRecordId, mediaAssetId } from "@lectoemocion/domain";
import { describe, expect, it } from "vitest";
import {
  photoUrl,
  pronunciationUrl,
  toPersonalisedCharacter
} from "./mediaUrl";

describe("where a child's media is served from", () => {
  it("builds a photo url from the asset id", () => {
    expect(photoUrl(mediaAssetId("avatar-ana"))).toBe("/synthetic/avatar-ana.svg");
  });

  it("builds a pronunciation url from the asset id", () => {
    expect(pronunciationUrl(mediaAssetId("silent-ana"))).toBe(
      "/synthetic/silent-ana.mp3"
    );
  });

  /* An id is a path segment, and a path segment is never trusted raw. */
  it("escapes an id that would otherwise change the path", () => {
    expect(photoUrl(mediaAssetId("a/b"))).toBe("/synthetic/a%2Fb.svg");
  });
});

describe("a child record as a template sees them", () => {
  const child = {
    id: childRecordId("alex"),
    displayName: "Álex",
    verifiedInitial: "A",
    photoAssetId: mediaAssetId("avatar-alex"),
    pronunciationAssetId: mediaAssetId("silent-alex")
  };

  it("carries the record's own fields through untouched", () => {
    expect(toPersonalisedCharacter(child)).toEqual({
      childRecordId: "alex",
      displayName: "Álex",
      verifiedInitial: "A",
      photoUrl: "/synthetic/avatar-alex.svg",
      pronunciationUrl: "/synthetic/silent-alex.mp3"
    });
  });

  /*
   * The verified letter is what an adult confirmed, and it is not always the
   * first character of the name. Deriving it here would quietly overrule them.
   */
  it("does not derive the initial from the name", () => {
    const withDivergentInitial = { ...child, displayName: "Chema", verifiedInitial: "CH" };
    expect(toPersonalisedCharacter(withDivergentInitial).verifiedInitial).toBe("CH");
  });
});
