import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env["PLAYER_PORT"] ?? 4173);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
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
      use: { ...devices["iPhone 13"], browserName: "chromium" }
    },
    {
      name: "classroom-hd",
      use: {
        browserName: "chromium",
        viewport: { width: 1920, height: 1080 },
        hasTouch: true
      }
    },
    {
      name: "classroom-4k",
      use: {
        browserName: "chromium",
        viewport: { width: 3840, height: 2160 },
        deviceScaleFactor: 1,
        hasTouch: true
      }
    }
  ]
});
