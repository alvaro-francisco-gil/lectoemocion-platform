import { describe, expect, it } from "vitest";
// @ts-expect-error -- plain .mjs script module, deliberately untyped
import { assetReferences, cacheProblem, siteUrl } from "./deployed-player.mjs";

describe("siteUrl", () => {
  it("derives the hosting URL from the default project", () => {
    const firebaserc = JSON.stringify({ projects: { default: "a-project" } });

    expect(siteUrl(firebaserc)).toBe("https://a-project.web.app");
  });

  it("fails loudly when no default project is pinned", () => {
    /*
     * Guessing a URL here would check a site nobody deployed and report it
     * healthy or missing for reasons unrelated to the deploy.
     */
    expect(() => siteUrl(JSON.stringify({ projects: {} }))).toThrow(
      "no projects.default"
    );
  });
});

describe("assetReferences", () => {
  it("finds the hashed script and stylesheet a page pulls in", () => {
    const html = [
      '<script type="module" crossorigin src="/assets/index-C-AZi7PP.js"></script>',
      '<link rel="stylesheet" crossorigin href="/assets/index-DoBEE0vf.css">'
    ].join("\n");

    expect(assetReferences(html)).toEqual([
      "/assets/index-C-AZi7PP.js",
      "/assets/index-DoBEE0vf.css"
    ]);
  });

  it("ignores media and absolute URLs, which are not build output", () => {
    /*
     * Only `/assets/` is content-hashed, so only it can be required to be
     * immutable. Story media keeps stable names and is checked by nothing here.
     */
    const html = [
      '<img src="/story/gallo-rayo/00.webp">',
      '<link href="https://fonts.example/x.css">'
    ].join("\n");

    expect(assetReferences(html)).toEqual([]);
  });
});

describe("cacheProblem", () => {
  it("rejects a document that Firebase left on its default hour", () => {
    /*
     * The defect this whole file exists for. `firebase.json` named only
     * `/index.html`, and Firebase matches header globs against the request
     * path — so `/`, the URL a tester actually opens, kept the default and
     * served a stale build for an hour.
     */
    expect(cacheProblem("/", "max-age=3600")).toMatch(/must not be cached/);
  });

  it("accepts a document that is not cached", () => {
    expect(cacheProblem("/", "no-cache")).toBeNull();
    expect(cacheProblem("/index.html", "no-cache")).toBeNull();
  });

  it("rejects a hashed asset that would be refetched every launch", () => {
    /*
     * ADR 0009 makes a repeat launch work offline by caching, not by the
     * player needing less. An asset on a short max-age quietly removes that.
     */
    expect(cacheProblem("/assets/index-abc123.js", "max-age=3600")).toMatch(
      /must be immutable/
    );
  });

  it("accepts a hashed asset cached for good", () => {
    expect(
      cacheProblem("/assets/index-abc123.js", "public, max-age=31536000, immutable")
    ).toBeNull();
  });

  it("reports an absent header rather than passing it", () => {
    expect(cacheProblem("/", undefined)).toMatch(/\(absent\)/);
  });

  it("has no opinion about paths outside the document and its assets", () => {
    expect(cacheProblem("/story/gallo-rayo/00.webp", "max-age=3600")).toBeNull();
  });
});
