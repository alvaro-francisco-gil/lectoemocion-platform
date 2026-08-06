import { describe, expect, it } from "vitest";
import { pageLabel, parseResourceManifest } from "@lectoemocion/resource-schema";
import { createIllustratedStoryResource, galloRayoPages } from ".";
import { GALLO_RAYO_STORY_ID } from "./fixtures/galloRayo";

describe("an illustrated story plays on authored content alone", () => {
  it("builds a valid manifest with no roster and no vocabulary", () => {
    const resource = createIllustratedStoryResource(
      GALLO_RAYO_STORY_ID,
      "story-seed"
    );

    expect(parseResourceManifest(resource)).toEqual(resource);
    expect(resource.pages).toEqual(galloRayoPages);
  });

  /** Invariant 6: missing default content fails closed, never opens empty. */
  it("fails closed on a story the catalogue does not have", () => {
    expect(() => createIllustratedStoryResource("no-such-book", "seed")).toThrow(
      "Unknown story: no-such-book"
    );
  });
});

/**
 * Content checks, not version checks — these may change if the book does.
 * What they guarantee is that the book shipped is the book printed.
 */
describe("El gallo Rayo is transcribed as printed", () => {
  it("is a cover and thirty letter pages", () => {
    const [cover, ...letters] = galloRayoPages;

    expect(galloRayoPages).toHaveLength(31);
    expect(cover?.kind).toBe("cover");
    expect(letters.every((page) => page.kind === "letter")).toBe(true);
  });

  /**
   * The book's order is phonetic, not alphabetical: it opens on the sounds a
   * child can blend into words almost at once and leaves the rare and the
   * silent for last. Sorting it alphabetically would look like tidying and
   * would quietly undo the pedagogy, so the sequence is pinned here.
   */
  it("keeps the book's phonetic order", () => {
    const graphemes = galloRayoPages
      .filter((page) => page.kind === "letter")
      .map((page) => page.grapheme);

    expect(graphemes).toEqual([
      "C", "O", "A", "M", "E", "I", "B", "J", "G", "K",
      "Q", "D", "Y", "V", "CH", "Z", "C", "P", "T", "N",
      "L", "X", "F", "R", "W", "LL", "Ñ", "S", "H", "U"
    ]);
  });

  it("teaches C twice, as two distinguishable lessons", () => {
    const cs = galloRayoPages.filter(
      (page) => page.kind === "letter" && page.grapheme === "C"
    );

    expect(cs).toHaveLength(2);
    expect(cs.map((page) => page.pageId)).toEqual(["c-k", "c-z"]);
    expect(cs.map(pageLabel)).toEqual([
      "Letra C (sonido /K/)",
      "Letra C (sonido /Z/)"
    ]);
  });

  it("names a letter with only one sound by that letter alone", () => {
    const eñe = galloRayoPages.find(
      (page) => page.kind === "letter" && page.grapheme === "Ñ"
    );

    expect(eñe && pageLabel(eñe)).toBe("Letra Ñ");
  });

  it("gives every page a distinct identifier", () => {
    const ids = galloRayoPages.map((page) => page.pageId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /**
   * The committed files are named by sequence position precisely so the
   * ordering has one home. That only holds while position N really is file NN,
   * which nothing else checks — the catalogue cannot see the filesystem and the
   * asset test only checks the files named here exist, not that they are the
   * right ones.
   */
  it("points page N at file NN, in reading order", () => {
    galloRayoPages.forEach((page, index) => {
      const name = String(index).padStart(2, "0");
      expect(page.imageUrl).toBe(`/story/${GALLO_RAYO_STORY_ID}/${name}.webp`);
      expect(page.audioUrl).toBe(`/story/${GALLO_RAYO_STORY_ID}/${name}.m4a`);
    });
  });
});
