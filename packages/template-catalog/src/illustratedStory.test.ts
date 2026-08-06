import { describe, expect, it } from "vitest";
import { parseResourceManifest, pageShortLabel } from "@lectoemocion/resource-schema";
import { createIllustratedStoryResource } from "./illustratedStory";
import { GALLO_RAYO_STORY_ID, galloRayoPages } from "./fixtures/galloRayo";

const story = () => createIllustratedStoryResource(GALLO_RAYO_STORY_ID, "seed");

describe("the catalogue builds a story", () => {
  it("produces a manifest the validator accepts", () => {
    expect(() => parseResourceManifest(story())).not.toThrow();
  });

  /* Missing default content fails closed rather than opening an empty book. */
  it("refuses a story it does not have", () => {
    expect(() => createIllustratedStoryResource("no-such-book", "seed")).toThrow(
      /Unknown story: no-such-book/
    );
  });

  it("needs no roster", () => {
    expect(story().pages.length).toBeGreaterThan(0);
  });
});

describe("El gallo Rayo", () => {
  it("has a cover and thirty letter pages", () => {
    expect(galloRayoPages).toHaveLength(31);
    expect(galloRayoPages.filter((page) => page.kind === "cover")).toHaveLength(1);
    expect(galloRayoPages.filter((page) => page.kind === "letter")).toHaveLength(30);
  });

  it("opens on the cover", () => {
    expect(galloRayoPages[0]?.kind).toBe("cover");
  });

  it("gives every page a distinct id", () => {
    const ids = galloRayoPages.map((page) => page.pageId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /**
   * The book's order is phonetic, not alphabetical: it opens on the sounds a
   * child can blend into words straight away and leaves the rare and the silent
   * for the end. Reordering it alphabetically would quietly undo the pedagogy
   * the book is built on, so the sequence is pinned here and should only change
   * if the printed book does.
   */
  it("keeps the printed order", () => {
    expect(
      galloRayoPages
        .filter((page) => page.kind === "letter")
        .map(pageShortLabel)
    ).toEqual([
      "C /K/", "O", "A", "M", "E", "I", "B", "J", "G", "K",
      "Q", "D", "Y", "V", "CH", "Z", "C /Z/", "P", "T", "N",
      "L", "X", "F", "R", "W", "LL", "Ñ", "S", "H", "U"
    ]);
  });

  /* The two `C` lessons are fifteen pages apart and are different sounds. */
  it("teaches C twice, distinguishably", () => {
    const cs = galloRayoPages.filter(
      (page) => page.kind === "letter" && page.grapheme === "C"
    );
    expect(cs.map((page) => page.pageId)).toEqual(["c-k", "c-z"]);
  });

  it("names a picture and a recording for every page, in step", () => {
    galloRayoPages.forEach((page, index) => {
      const position = String(index).padStart(2, "0");
      expect(page.imageUrl).toBe(`/story/gallo-rayo/${position}.webp`);
      expect(page.audioUrl).toBe(`/story/gallo-rayo/${position}.m4a`);
    });
  });
});
