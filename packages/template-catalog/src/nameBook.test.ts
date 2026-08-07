import { childRecordId, mediaAssetId, type ChildRecord } from "@lectoemocion/domain";
import { parseResourceManifest } from "@lectoemocion/resource-schema";
import { describe, expect, it } from "vitest";
import { syntheticClass } from "./fixtures/syntheticClass";
import { createNameBookResource } from "./nameBook";

function child(
  id: string,
  displayName: string,
  verifiedInitial: string
): ChildRecord {
  return {
    id: childRecordId(id),
    displayName,
    verifiedInitial,
    photoAssetId: mediaAssetId(`avatar-${id}`),
    pronunciationAssetId: mediaAssetId(`silent-${id}`)
  };
}

const graphemes = (roster: readonly ChildRecord[]) =>
  createNameBookResource(roster, "seed").pages.map((page) => page.grapheme);

describe("the book of names is built from the roster", () => {
  it("is a valid manifest", () => {
    expect(() =>
      parseResourceManifest(createNameBookResource(syntheticClass, "libro"))
    ).not.toThrow();
  });

  it("gives a letter one page however many children share it", () => {
    const book = createNameBookResource(syntheticClass, "libro");
    const a = book.pages.find((page) => page.grapheme === "A");
    expect(a?.names.map((name) => name.displayName)).toEqual([
      "Aitor",
      "Álex",
      "Ana"
    ]);
  });

  it("has no page for a letter nobody is named after", () => {
    expect(graphemes([child("ana", "Ana", "A")])).toEqual(["A"]);
  });

  it("names a page after its letter, lowercased", () => {
    const book = createNameBookResource([child("chema", "Chema", "CH")], "x");
    expect(book.pages[0]?.pageId).toBe("ch");
  });
});

describe("the book is ordered the way the alphabet is", () => {
  /* Ñ is its own letter and it comes after N, not after Z. */
  it("puts Ñ after N", () => {
    expect(
      graphemes([
        child("zara", "Zara", "Z"),
        child("nuria", "Ñuria", "Ñ"),
        child("nora", "Nora", "N")
      ])
    ).toEqual(["N", "Ñ", "Z"]);
  });

  it("sorts an accented name under its unaccented letter and keeps the accent", () => {
    const book = createNameBookResource(
      [child("alex", "Álex", "A"), child("ana", "Ana", "A")],
      "x"
    );
    expect(book.pages).toHaveLength(1);
    expect(book.pages[0]?.names.map((name) => name.displayName)).toEqual([
      "Álex",
      "Ana"
    ]);
  });

  it("orders the names within a page", () => {
    const book = createNameBookResource(
      [child("sara", "Sara", "S"), child("sofia", "Sofía", "S")],
      "x"
    );
    expect(book.pages[0]?.names.map((name) => name.displayName)).toEqual([
      "Sara",
      "Sofía"
    ]);
  });
});

/**
 * The regression that matters most. A child whose verified letter differs from
 * the first character of their name is exactly who this book is for, and
 * grouping on the name instead would file them under a letter no adult chose.
 */
describe("a page is keyed on the verified letter", () => {
  it("files a name under its verified initial, not its first character", () => {
    const book = createNameBookResource([child("chema", "Chema", "CH")], "x");
    expect(book.pages.map((page) => page.grapheme)).toEqual(["CH"]);
  });

  it("keeps two children apart when only their verified letters differ", () => {
    expect(
      graphemes([child("carla", "Carla", "C"), child("chema", "Chema", "CH")])
    ).toEqual(["C", "CH"]);
  });
});

/**
 * With nobody recorded there is no book. This is invariant 6's fail-closed
 * case rather than its personalised-media exception: there is no default here
 * to fall back to, which is why the world gates the chapter before it is built.
 */
describe("a book with no names", () => {
  it("refuses to be built", () => {
    expect(() => createNameBookResource([], "x")).toThrow(
      /El libro de los nombres needs a roster/
    );
  });
});
