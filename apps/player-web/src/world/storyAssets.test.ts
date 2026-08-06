import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { galloRayoPages, GALLO_RAYO_STORY_ID } from "@lectoemocion/template-catalog";
import { pageLabel } from "@lectoemocion/resource-schema";

/**
 * The catalogue names pages; this app is what serves them.
 *
 * Same seam as `vocabularyAssets.test.ts`, and it matters more here: a story
 * page has a recording as well as a picture, and a missing recording is a book
 * that looks perfectly fine and never says the letter out loud. Nothing else
 * checks the two sides agree — the catalogue cannot see the filesystem, and the
 * guardrails check provenance rather than presence.
 */
const publicDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "public"
);

function fileFor(url: string): string {
  return join(publicDir, decodeURIComponent(url).replace(/^\//, ""));
}

describe("every page of El gallo Rayo is actually served", () => {
  it.each(galloRayoPages.map((page) => [pageLabel(page), page] as const))(
    "%s",
    (_label, page) => {
      expect(existsSync(fileFor(page.imageUrl)), page.imageUrl).toBe(true);
      expect(existsSync(fileFor(page.audioUrl)), page.audioUrl).toBe(true);
    }
  );

  /* An orphan is dead weight in a bundle shipped over a school network. */
  it("ships no page file the story never names", () => {
    const named = new Set(
      galloRayoPages.flatMap((page) => [page.imageUrl, page.audioUrl])
    );
    const orphans = readdirSync(join(publicDir, "story", GALLO_RAYO_STORY_ID))
      .filter((name) => name.endsWith(".webp") || name.endsWith(".m4a"))
      .map((name) => `/story/${GALLO_RAYO_STORY_ID}/${name}`)
      .filter((url) => !named.has(url));

    expect(orphans).toEqual([]);
  });
});
