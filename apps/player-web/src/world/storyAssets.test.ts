import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { pageLabel } from "@lectoemocion/resource-schema";
import { galloRayoPages } from "@lectoemocion/template-catalog";

/**
 * The catalogue names pages; this app is what serves them.
 *
 * Same seam as `vocabularyAssets.test.ts`, and the same reasoning: the
 * catalogue cannot see the filesystem, the guardrails only check that media
 * carries provenance rather than that a named file is present, and a page whose
 * picture or recording is not there is a blank sheet in a classroom.
 *
 * A book is where this matters most. Thirty-one pages import in one run, and a
 * single mis-numbered file would silently shift a letter onto the wrong
 * drawing — which nobody would catch until a child was looking at it.
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

  /* An orphan is dead weight in the bundle shipped over a school network. */
  it("ships no page file the story never names", () => {
    const named = new Set(
      galloRayoPages.flatMap((page) => [
        decodeURIComponent(page.imageUrl),
        decodeURIComponent(page.audioUrl)
      ])
    );
    const orphans = readdirSync(join(publicDir, "story", "gallo-rayo"))
      .filter((name) => !name.endsWith(".md"))
      .map((name) => `/story/gallo-rayo/${name}`)
      .filter((url) => !named.has(url));

    expect(orphans).toEqual([]);
  });
});
