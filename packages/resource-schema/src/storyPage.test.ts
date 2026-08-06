import { describe, expect, it } from "vitest";
import { pageLabel, pageShortLabel, type StoryPage } from "./storyPage";
import { parseResourceManifest } from "./resourceManifest";

const cover: StoryPage = {
  kind: "cover",
  pageId: "portada",
  imageUrl: "/story/x/00.webp",
  audioUrl: "/story/x/00.m4a"
};

const letter: StoryPage = {
  kind: "letter",
  pageId: "m",
  grapheme: "M",
  imageUrl: "/story/x/04.webp",
  audioUrl: "/story/x/04.m4a"
};

const ambiguous: StoryPage = {
  kind: "letter",
  pageId: "c-k",
  grapheme: "C",
  sound: "K",
  imageUrl: "/story/x/01.webp",
  audioUrl: "/story/x/01.m4a"
};

describe("a page names itself", () => {
  it("calls the cover the cover", () => {
    expect(pageLabel(cover)).toBe("Portada");
    expect(pageShortLabel(cover)).toBe("Portada");
  });

  it("names a letter with one sound by the letter alone", () => {
    expect(pageLabel(letter)).toBe("Letra M");
    expect(pageShortLabel(letter)).toBe("M");
  });

  /* `C` is taught twice, fifteen pages apart. The label is what tells them apart. */
  it("names which sound where the letter has two", () => {
    expect(pageLabel(ambiguous)).toBe("Letra C (sonido /K/)");
    expect(pageShortLabel(ambiguous)).toBe("C /K/");
  });
});

/**
 * The union is the guardrail: neither invalid page has a representation the
 * type system would accept, so these prove the *runtime* validator agrees —
 * which is what a manifest crossing a service boundary is checked by.
 */
describe("a page cannot be half a kind", () => {
  const manifest = (pages: readonly unknown[]) => ({
    schemaVersion: 1,
    resourceId: "illustrated-story-x",
    template: { id: "illustrated-story", version: 1 },
    seed: "x",
    pages
  });

  it("accepts a well-formed story", () => {
    expect(() =>
      parseResourceManifest(manifest([cover, ambiguous, letter]))
    ).not.toThrow();
  });

  it("rejects a cover that teaches a letter", () => {
    expect(() =>
      parseResourceManifest(manifest([{ ...cover, grapheme: "Ñ" }]))
    ).toThrow(/Invalid resource manifest/);
  });

  it("rejects a letter page with no letter", () => {
    expect(() =>
      parseResourceManifest(
        manifest([
          {
            kind: "letter",
            pageId: "m",
            imageUrl: "/story/x/04.webp",
            audioUrl: "/story/x/04.m4a"
          }
        ])
      )
    ).toThrow(/Invalid resource manifest/);
  });

  it("rejects a page with no voice", () => {
    expect(() =>
      parseResourceManifest(
        manifest([{ kind: "cover", pageId: "portada", imageUrl: "/story/x/00.webp" }])
      )
    ).toThrow(/Invalid resource manifest/);
  });

  it("rejects a story with no pages", () => {
    expect(() => parseResourceManifest(manifest([]))).toThrow(
      /Invalid resource manifest/
    );
  });
});
