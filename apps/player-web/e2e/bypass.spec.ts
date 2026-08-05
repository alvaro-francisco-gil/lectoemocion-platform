import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

/**
 * Adults cannot skip ahead, and there is no product-facing unlock override
 * (platform-design.md §6.1). Development, tests, demos, and support
 * reproduction still need one, so it exists — behind a build-time flag.
 *
 * These assert against built output rather than source, because that is where
 * the guarantee has to hold: a reviewer can see the flag guarded in source and
 * still ship a bundle that reads it at runtime. That is not hypothetical —
 * writing this flag as `import.meta.env["VITE_…"]` to satisfy
 * `noPropertyAccessFromIndexSignature` defeats Vite's static replacement and
 * leaves the lookup in the bundle. This test caught exactly that.
 */

const FLAG = "VITE_LECTOEMOCION_UNLOCK_ALL";
const app = join(import.meta.dirname, "..");

function buildInto(outDir: string, env: NodeJS.ProcessEnv = {}): string[] {
  execFileSync("pnpm", ["exec", "vite", "build", "--outDir", outDir], {
    cwd: app,
    stdio: "pipe",
    env: { ...process.env, ...env }
  });
  const assets = join(app, outDir, "assets");
  return readdirSync(assets)
    .filter((name) => name.endsWith(".js"))
    .map((name) => readFileSync(join(assets, name), "utf8"));
}

test("a production build carries no unlock bypass", () => {
  const bundles = buildInto("dist");
  expect(bundles.length).toBeGreaterThan(0);
  for (const bundle of bundles) {
    expect(bundle).not.toContain(FLAG);
  }
});

/**
 * Proves the assertion above is not vacuous. If the flag never reached the
 * bundle under any conditions, "it is absent" would be true for the wrong
 * reason and the test would guard nothing.
 */
test("the bypass does change a build that asks for it", () => {
  const outDir = "dist-bypass-check";
  try {
    const withFlag = buildInto(outDir, { [FLAG]: "true" }).join("");
    const without = buildInto("dist").join("");

    /*
     * The minifier folds the comparison away in both builds, so neither the
     * flag name nor the literal survives to compare. What does survive is the
     * difference itself: setting the flag changes the emitted code, which is
     * what proves the guard is real and the assertion above has something to
     * catch.
     */
    expect(withFlag).not.toEqual(without);
  } finally {
    rmSync(join(app, outDir), { recursive: true, force: true });
  }
});
