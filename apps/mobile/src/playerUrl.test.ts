import { describe, expect, it } from "vitest";
import { playerOrigin, resolvePlayerUrl } from "./playerUrl";

describe("resolvePlayerUrl", () => {
  it("resolves a LAN development origin", () => {
    expect(resolvePlayerUrl("http://192.168.1.42:4173")).toEqual({
      kind: "resolved",
      url: "http://192.168.1.42:4173"
    });
  });

  it("resolves a hosted https origin with a path", () => {
    expect(resolvePlayerUrl("https://player.example.test/world")).toEqual({
      kind: "resolved",
      url: "https://player.example.test/world"
    });
  });

  it("trims surrounding whitespace, which a copied .env line carries", () => {
    expect(resolvePlayerUrl("  http://192.168.1.42:4173\n")).toEqual({
      kind: "resolved",
      url: "http://192.168.1.42:4173"
    });
  });

  /*
   * Invariant 6: no silent fallbacks. An unset variable must surface as a
   * recoverable adult-facing error, never as the blank white WebView that a
   * parent cannot tell apart from a broken app.
   */
  it("reports a missing value rather than defaulting", () => {
    expect(resolvePlayerUrl(undefined)).toEqual({
      kind: "unusable",
      problem: "missing"
    });
    expect(resolvePlayerUrl("   ")).toEqual({
      kind: "unusable",
      problem: "missing"
    });
  });

  it("rejects a value with no scheme, which a WebView resolves unpredictably", () => {
    expect(resolvePlayerUrl("192.168.1.42:4173")).toEqual({
      kind: "unusable",
      problem: "malformed"
    });
  });

  it("rejects a scheme without an authority", () => {
    expect(resolvePlayerUrl("http:/192.168.1.42")).toEqual({
      kind: "unusable",
      problem: "malformed"
    });
  });

  /*
   * `javascript:` and `data:` in a WebView source are script-injection
   * vectors, and `file:` would expose the device filesystem to the page. The
   * player is only ever served over HTTP.
   */
  it("rejects every scheme but http and https", () => {
    for (const raw of [
      "javascript:alert(1)",
      "data:text/html,<h1>x</h1>",
      "file:///android_asset/index.html"
    ]) {
      expect(resolvePlayerUrl(raw)).toEqual({
        kind: "unusable",
        problem: "unsupported-scheme"
      });
    }
  });

  it("accepts the scheme case-insensitively, as URLs are", () => {
    expect(resolvePlayerUrl("HTTPS://player.example.test")).toEqual({
      kind: "resolved",
      url: "HTTPS://player.example.test"
    });
  });
});

describe("playerOrigin", () => {
  it("keeps the port, which the dev server always carries", () => {
    expect(playerOrigin("http://192.168.1.42:4173")).toBe(
      "http://192.168.1.42:4173"
    );
  });

  it("drops the path, so a deep link still confines to one origin", () => {
    expect(playerOrigin("https://player.example.test/world/map?x=1")).toBe(
      "https://player.example.test"
    );
  });

  it("drops a trailing slash", () => {
    expect(playerOrigin("http://192.168.1.42:4173/")).toBe(
      "http://192.168.1.42:4173"
    );
  });
});
