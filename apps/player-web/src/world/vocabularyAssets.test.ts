import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { worldNodes } from "@lectoemocion/resource-schema";
// @ts-expect-error -- plain .mjs script module, deliberately untyped
import { TARGET_COVERAGE, inkArea } from "../../../../scripts/lib/normalise-ink-area.mjs";
import { defaultVocabulary, world } from "@lectoemocion/template-catalog";
import { LETRIESTRELLAS } from "../app/letriestrellas";

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

  /*
   * The same seam the vocabulary has, in the other direction. `world/` holds
   * two kinds of picture and nothing else: a chapter's card, and the
   * letriestrella a chapter pays out. A file that is neither is weight shipped
   * to a classroom panel over a school network, and the likeliest way to get
   * one is a card repointed at a new picture while the old one stays behind.
   */
  it("ships no world picture nothing points at", () => {
    const named = new Set([
      ...worldNodes(world).map((node) => decodeURIComponent(node.icon)),
      ...LETRIESTRELLAS
    ]);
    const orphans = readdirSync(join(publicDir, "world"))
      .filter((name) => name.endsWith(".webp"))
      .map((name) => `/world/${name}`)
      .filter((url) => !named.has(url));

    expect(orphans).toEqual([]);
  });
});

/*
 * `index.html` names the five stars a second time, to have them on their way
 * before the bundle has parsed. Two lists of the same five files is exactly
 * the duplication that drifts — a star renamed in one place and preloaded from
 * the other, which costs a fetch and shows nothing for it, and which no screen
 * would look broken enough to report.
 */
describe("the letriestrellas are preloaded", () => {
  const html = readFileSync(join(publicDir, "..", "index.html"), "utf8");
  const preloaded = [
    ...html.matchAll(/<link rel="preload" as="image" href="([^"]+)"/g)
  ].map((match) => match[1]);

  it("preloads exactly the stars the award screen draws", () => {
    expect(preloaded).toEqual([...LETRIESTRELLAS]);
  });

  it.each([...LETRIESTRELLAS])("%s is actually served", (url) => {
    expect(existsSync(fileFor(url)), url).toBe(true);
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

/*
 * Every surface that draws these scales the whole picture to fit, so a picture's
 * margin is what decides how big it comes out. `scripts/lib/normalise-ink-area.mjs`
 * holds that constant at import time — but nothing downstream would notice a
 * picture that skipped it, and the symptom is not an error: it is one animal
 * quietly twice the size of its neighbour on a page meant to read as a set.
 *
 * This is that seam. A hand-added or stale picture fails here rather than in a
 * classroom.
 */
describe("every picture carries the same visual weight", () => {
  const files = readdirSync(join(publicDir, "vocabulary")).filter((name) =>
    name.endsWith(".webp")
  );

  it.each(files)("%s", async (name) => {
    const { data, info } = await sharp(join(publicDir, "vocabulary", name))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const ink = inkArea(data) as number;
    const canvas = Math.max(info.width, info.height);
    const coverage = ink / (canvas * canvas);

    /*
     * Below the target is the declared case: a subject too thin to reach it
     * keeps its own box, and is then square in neither dimension nor coverage.
     * Above it is a picture that never went through the normaliser.
     *
     * The tolerance absorbs whole-pixel canvases and lossy alpha; it is far
     * tighter than the 5.6× spread the raw pictures arrived with.
     */
    expect(coverage, `${name} covers ${coverage.toFixed(3)}`).toBeLessThanOrEqual(
      TARGET_COVERAGE + 0.01
    );
  });
});
