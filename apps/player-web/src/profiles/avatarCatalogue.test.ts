import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { AVATARS, avatarImageUrl, DEFAULT_AVATAR_ID } from "./avatarCatalogue";

/**
 * The catalogue names avatars; `public/avatars/` is what serves them.
 *
 * The same seam `vocabularyAssets.test.ts` covers, for the same reason: the
 * catalogue cannot see the filesystem, `scripts/import-avatars.mjs` writes the
 * files without consulting the catalogue, and a name in one that is missing
 * from the other is a child staring at a broken picture where their face
 * should be.
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

describe("every avatar in the catalogue is actually served", () => {
  it.each(AVATARS.map((avatar) => [avatar.id, avatar] as const))(
    "%s",
    (_id, avatar) => {
      const url = avatarImageUrl(avatar.id);
      expect(existsSync(fileFor(url)), url).toBe(true);
    }
  );

  it("ships no avatar the catalogue never names", () => {
    const named = new Set(AVATARS.map((avatar) => `${avatar.id}.webp`));
    const orphans = readdirSync(join(publicDir, "avatars"))
      .filter((name) => name.endsWith(".webp"))
      .filter((name) => !named.has(name));

    expect(orphans).toEqual([]);
  });
});

describe("the catalogue itself", () => {
  it("gives every avatar a distinct id", () => {
    const ids = AVATARS.map((avatar) => avatar.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("labels every avatar, because the picture alone is not a name", () => {
    for (const avatar of AVATARS) {
      expect(avatar.label.length, avatar.id).toBeGreaterThan(0);
    }
  });

  it("offers a default that is one of the avatars on offer", () => {
    expect(AVATARS.map((avatar) => avatar.id)).toContain(DEFAULT_AVATAR_ID);
  });
});
