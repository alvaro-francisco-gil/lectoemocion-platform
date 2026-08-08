#!/usr/bin/env node
/**
 * Checks the deployed player, over the network, after `pnpm deploy:player`.
 *
 * This is not a guardrail and `pnpm check` does not run it: guardrails scan
 * source, run offline, and must work before any install, whereas this needs a
 * site that exists. It is the executable half of ADR 0009's statement that
 * caching is "a release criterion, not an optimisation".
 *
 * What it proves: the page answers, it is not cached, every hashed asset it
 * references resolves and is cached hard, and an unknown path still 404s
 * rather than being swallowed by a catch-all rewrite.
 *
 * What it does not prove: that the player renders. A bundle that downloads and
 * then throws passes every check here. Loading it in a browser is still a
 * manual step, and `pnpm test:e2e` covers rendering against a dev server.
 *
 * Usage: `node scripts/verify-deployment.mjs [url]`
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { assetReferences, cacheProblem, siteUrl } from "./lib/deployed-player.mjs";
import { repoRoot } from "./guardrails.mjs";

const failures = [];

function check(name, problem) {
  if (problem === null) {
    console.log(`✓ ${name}`);
    return;
  }
  console.error(`✗ ${name}`);
  console.error(`  ${problem}`);
  failures.push(name);
}

const base =
  process.argv[2] ?? siteUrl(await readFile(join(repoRoot, ".firebaserc"), "utf8"));
console.log(`Checking ${base}\n`);

/* The document: it must answer, and it must not be cached. */
let html = "";
const page = await fetch(base, { redirect: "follow" }).catch((error) => error);
if (page instanceof Error) {
  check("the player answers", `${base} is unreachable: ${page.message}`);
} else {
  html = await page.text();
  check(
    "the player answers",
    page.ok ? null : `expected 200 from ${base}, got ${page.status}`
  );
  check(
    "the page is not cached",
    cacheProblem("/", page.headers.get("cache-control"))
  );
}

/* Its hashed assets: each must resolve, and each must be cached for good. */
const assets = assetReferences(html);
check(
  "the page references its build output",
  assets.length > 0 ? null : "no /assets/ script or stylesheet in the served page"
);

for (const asset of assets) {
  const response = await fetch(`${base}${asset}`, { method: "HEAD" }).catch(
    (error) => error
  );
  if (response instanceof Error) {
    check(`${asset} resolves`, response.message);
    continue;
  }
  check(
    `${asset} resolves`,
    response.ok ? null : `expected 200, got ${response.status} — partial upload?`
  );
  check(
    `${asset} is cached for good`,
    cacheProblem(asset, response.headers.get("cache-control"))
  );
}

/*
 * An unknown path must 404. The player has no router, so a catch-all rewrite
 * would answer 200 with the app for any mistyped URL — the silent fallback
 * invariant 6 forbids, and the thing most likely to be added by accident.
 */
const missing = await fetch(`${base}/not-a-real-path`, { method: "HEAD" }).catch(
  (error) => error
);
check(
  "an unknown path 404s",
  missing instanceof Error
    ? missing.message
    : missing.status === 404
      ? null
      : `expected 404, got ${missing.status} — has an SPA rewrite been added?`
);

/*
 * Whether the live page is the one last built here. A mismatch is ordinary —
 * a build after a deploy, or a deploy from another checkout — so it is a note
 * rather than a failure. It is worth saying because everything above passes
 * just as happily against last week's deploy.
 */
const built = await readFile(
  join(repoRoot, "apps/player-web/dist/index.html"),
  "utf8"
).catch(() => null);
if (built !== null && html !== "") {
  console.log(
    built.trim() === html.trim()
      ? "\nnote: live page matches apps/player-web/dist"
      : "\nnote: live page differs from apps/player-web/dist — deploy to publish it"
  );
}

if (failures.length > 0) {
  console.error(`\n→ ${failures.length} check(s) failed. Fix firebase.json, then redeploy.`);
  process.exit(1);
}
console.log("\nDeployment healthy.");
