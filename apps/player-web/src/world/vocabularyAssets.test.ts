import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { worldNodes } from "@lectoemocion/resource-schema";
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

/*
 * The map is a row of pictures now, so a missing icon is not a cosmetic gap:
 * it is a chapter a child who cannot read has no way to tell from its
 * neighbour.
 */
describe("every chapter's map icon is actually served", () => {
  it.each(worldNodes(world).map((node) => [node.id, node.icon] as const))(
    "%s",
    (_id, icon) => {
      expect(existsSync(fileFor(icon)), icon).toBe(true);
    }
  );

  it("gives each chapter a picture of its own", () => {
    const icons = worldNodes(world).map((node) => node.icon);
    expect(new Set(icons).size).toBe(icons.length);
  });
});

describe("every reward animal is actually served", () => {
  const animals = worldNodes(world).map((node) => node.reward.animal);

  it.each(animals.map((animal) => [animal.animalId, animal] as const))(
    "%s",
    (_id, animal) => {
      expect(existsSync(fileFor(animal.imageUrl)), animal.imageUrl).toBe(true);
    }
  );
});
