import { defineConfig, devices } from "@playwright/test";
import { resolvePlayerServer } from "./playerServer";

/**
 * The same derivation the dev server uses, so the two cannot disagree about
 * where the player is. `e2eGlobalSetup` then refuses to run against a server
 * that belongs to another checkout.
 */
const { baseURL } = resolvePlayerServer(
  import.meta.dirname,
  process.env["PLAYER_PORT"]
);

/**
 * `bypass.spec.ts` asserts on built bundles, not on anything rendered, so it
 * runs once rather than once per viewport. Running it in all three projects
 * meant six concurrent `vite build` runs competing with a 4K canvas for the
 * same cores, which is how a deterministic twenty-second timeline starts
 * missing its deadline.
 */
const BUILD_SPEC = /bypass\.spec\.ts/;

const viewport = {
  testIgnore: BUILD_SPEC
};

export default defineConfig({
  testDir: "./e2e",
  /*
   * Playwright's default is 30 seconds, and this suite watches real timelines
   * play: the album alone runs about 24, and the sweep through every resource
   * boots six Phaser games in turn. Three viewport projects render those at
   * once, one of them at 4K, so wall-clock stretches two to three times over
   * the same work measured alone. The budget has to cover the slow case or the
   * suite reports contention as failure.
   */
  timeout: 180_000,
  globalSetup: "./e2eGlobalSetup.ts",
  use: {
    baseURL
  },
  webServer: {
    command: "pnpm dev",
    url: baseURL,
    reuseExistingServer: !process.env["CI"]
  },
  projects: [
    {
      name: "phone",
      ...viewport,
      use: { ...devices["iPhone 13"], browserName: "chromium" }
    },
    {
      name: "classroom-hd",
      ...viewport,
      use: {
        browserName: "chromium",
        viewport: { width: 1920, height: 1080 },
        hasTouch: true
      }
    },
    {
      name: "classroom-4k",
      ...viewport,
      use: {
        browserName: "chromium",
        viewport: { width: 3840, height: 2160 },
        deviceScaleFactor: 1,
        hasTouch: true
      }
    },
    {
      name: "build",
      testMatch: BUILD_SPEC
    }
  ]
});
