import { describe, expect, it } from "vitest";
import { parseResourceManifest } from "./resourceManifest";
import { pageLetterLabel, type NameBookPage } from "./nameBookPage";
import type { PersonalisedCharacter } from "./participantSlot";

function name(id: string, displayName: string, initial: string): PersonalisedCharacter {
  return {
    childRecordId: id,
    displayName,
    verifiedInitial: initial,
    photoUrl: `/synthetic/avatar-${id}.svg`,
    pronunciationUrl: `/synthetic/silent-${id}.mp3`
  };
}

const page: NameBookPage = {
  pageId: "a",
  grapheme: "A",
  names: [name("ana", "Ana", "A")]
};

describe("a letter page names itself", () => {
  it("is called by its letter", () => {
    expect(pageLetterLabel(page)).toBe("Letra A");
  });

  it("keeps a digraph whole", () => {
    expect(pageLetterLabel({ ...page, pageId: "ch", grapheme: "CH" })).toBe(
      "Letra CH"
    );
  });
});

/**
 * The schema is where "a letter nobody is named after has no page" lives. These
 * prove the runtime validator agrees with the type, which is what a manifest
 * crossing a boundary is actually checked by.
 */
describe("a page of the book of names", () => {
  const manifest = (pages: readonly unknown[]) => ({
    schemaVersion: 1,
    resourceId: "name-book-x",
    template: { id: "name-book", version: 1 },
    seed: "x",
    pages
  });

  it("accepts a well-formed book", () => {
    expect(() => parseResourceManifest(manifest([page]))).not.toThrow();
  });

  it("rejects a letter page with nobody on it", () => {
    expect(() => parseResourceManifest(manifest([{ ...page, names: [] }]))).toThrow(
      /Invalid resource manifest/
    );
  });

  it("rejects a page holding more than a class", () => {
    const crowd = Array.from({ length: 31 }, (_, index) =>
      name(`child-${index}`, `Nombre${index}`, "A")
    );
    expect(() =>
      parseResourceManifest(manifest([{ ...page, names: crowd }]))
    ).toThrow(/Invalid resource manifest/);
  });

  it("rejects a grapheme that is not a letter or a digraph", () => {
    expect(() =>
      parseResourceManifest(manifest([{ ...page, grapheme: "ABC" }]))
    ).toThrow(/Invalid resource manifest/);
  });

  it("rejects a name with no voice", () => {
    const voiceless = { ...name("ana", "Ana", "A") } as Record<string, unknown>;
    delete voiceless["pronunciationUrl"];
    expect(() =>
      parseResourceManifest(manifest([{ ...page, names: [voiceless] }]))
    ).toThrow(/Invalid resource manifest/);
  });

  it("rejects a book with no pages", () => {
    expect(() => parseResourceManifest(manifest([]))).toThrow(
      /Invalid resource manifest/
    );
  });

  /* Twenty-seven letters is the Spanish alphabet, and the most a book can hold. */
  it("rejects a book longer than the alphabet", () => {
    const pages = Array.from({ length: 28 }, (_, index) => ({
      pageId: `p${index}`,
      grapheme: "A",
      names: [name(`child-${index}`, `Nombre${index}`, "A")]
    }));
    expect(() => parseResourceManifest(manifest(pages))).toThrow(
      /Invalid resource manifest/
    );
  });
});
