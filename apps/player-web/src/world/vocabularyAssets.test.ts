import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultVocabulary, world } from "@lectoemocion/template-catalog";

/**
 * The catalogue names pictures; this app is what serves them.
 *
 * A manifest that points at a file `public/` does not have is a lesson that
 * renders a broken image in a classroom, and nothing else checks the two sides
 * agree: the catalogue cannot see the filesystem, and the guardrails only
 * check provenance, not that a named file is present. This test is that seam.
 *
 * It also runs the other way — an orphan picture is dead weight in the bundle
 * shipped to a panel over a school network.
 */
const publicDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "public"
);

/** `/vocabulary/ara%C3%B1a.webp` is served from `public/vocabulary/araña.webp`. */
function fileFor(url: string): string {
  return join(publicDir, decodeURIComponent(url).replace(/^\//, ""));
}

describe("every named picture is actually served", () => {
  it.each(defaultVocabulary.map((item) => [item.vocabularyItemId, item] as const))(
    "%s",
    (_id, item) => {
      expect(existsSync(fileFor(item.imageUrl)), item.imageUrl).toBe(true);
    }
  );

  it("ships no picture the vocabulary never names", () => {
    const named = new Set(
      defaultVocabulary.map((item) => decodeURIComponent(item.imageUrl))
    );
    const orphans = readdirSync(join(publicDir, "vocabulary"))
      .filter((name) => name.endsWith(".webp"))
      .map((name) => `/vocabulary/${name}`)
      .filter((url) => !named.has(url));

    expect(orphans).toEqual([]);
  });
});

describe("every reward animal is actually served", () => {
  const animals = world.nodes.flatMap((node) => node.reward.choices);

  it.each(animals.map((animal) => [animal.animalId, animal] as const))(
    "%s",
    (_id, animal) => {
      expect(existsSync(fileFor(animal.imageUrl)), animal.imageUrl).toBe(true);
    }
  );
});
