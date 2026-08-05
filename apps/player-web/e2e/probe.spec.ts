import { expect, test } from "@playwright/test";

/**
 * The capability probe is the instrument for roadmap stage 2. It has to run on
 * a panel browser too old for the player, so it is a dependency-free static
 * page rather than a route in the React shell. These tests hold it to the
 * measurements ADR 0003 needs and to the constraints that keep it runnable
 * there.
 */

const REQUIRED_MEASUREMENTS = [
  "userAgent",
  "engine",
  "webgl",
  "deviceMemoryGb",
  "devicePixelRatio",
  "screen",
  "maxTouchPoints",
  "frameRate",
  "audioUnlocked"
];

test("reports every capability ADR 0003 needs", async ({ page }) => {
  await page.goto("/probe.html");
  await expect(
    page.getByRole("heading", { name: "Classroom panel capability probe" })
  ).toBeVisible();

  for (const measurement of REQUIRED_MEASUREMENTS) {
    await expect(page.getByTestId(`measurement-${measurement}`)).toBeVisible();
  }

  const report = page.getByTestId("report");
  await expect(report).not.toBeEmpty();
  const parsed = JSON.parse(await report.inputValue());
  for (const measurement of REQUIRED_MEASUREMENTS) {
    expect(parsed).toHaveProperty(measurement);
  }
});

test("measures a frame rate rather than only reporting strings", async ({
  page
}) => {
  await page.goto("/probe.html");
  await expect(page.getByTestId("measurement-frameRate")).toContainText(/\d+ fps/, {
    timeout: 15_000
  });
});

test("audio stays unknown until a gesture unlocks it", async ({ page }) => {
  await page.goto("/probe.html");
  const audio = page.getByTestId("measurement-audioUnlocked");
  await expect(audio).toContainText("not tested");

  await page.getByRole("button", { name: "Tap to test audio" }).click();
  await expect(audio).toContainText(/^(yes|no)$/, { timeout: 10_000 });

  const parsed = JSON.parse(await page.getByTestId("report").inputValue());
  expect(typeof parsed.audioUnlocked).toBe("boolean");
});

test("records the panel model and route alongside the measurements", async ({
  page
}) => {
  await page.goto("/probe.html");
  await page.getByLabel("Panel model").fill("TTL-65-TEST");
  await page.getByLabel("Firmware version").fill("1.2.3");
  await page.getByLabel("Delivery route").selectOption("connected-computer");

  const parsed = JSON.parse(await page.getByTestId("report").inputValue());
  expect(parsed.panelModel).toBe("TTL-65-TEST");
  expect(parsed.firmwareVersion).toBe("1.2.3");
  expect(parsed.route).toBe("connected-computer");
});

test("sends nothing to the network", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (!url.startsWith("http://127.0.0.1:4173")) external.push(url);
    if (request.method() !== "GET") external.push(`${request.method()} ${url}`);
  });

  await page.goto("/probe.html");
  await page.getByRole("button", { name: "Tap to test audio" }).click();
  await expect(page.getByTestId("measurement-audioUnlocked")).toContainText(
    /^(yes|no)$/
  );

  expect(external).toEqual([]);
});

test("loads without a module bundle, so an aged WebView can run it", async ({
  page
}) => {
  const response = await page.goto("/probe.html");
  const html = (await response?.text()) ?? "";

  expect(html).not.toContain('type="module"');
  expect(html).not.toMatch(/<script[^>]+src=/);
  expect(html).not.toMatch(/<link[^>]+rel=["']stylesheet["']/);
});
