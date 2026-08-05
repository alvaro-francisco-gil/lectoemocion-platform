import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env["PLAYER_PORT"] ?? 4173);
const baseURL = `http://127.0.0.1:${port}`;

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
   * Playwright's default is 30 seconds, and the album cinematic alone runs for
   * about 24 of them. That left no headroom at all: with three viewport
   * projects rendering at once — one of them 4K — the timeline tests lost the
   * race to their own budget rather than to any defect.
   */
  timeout: 90_000,
  use: {
    baseURL
  },
  webServer: {
    command: "pnpm dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI
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
