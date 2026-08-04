#!/usr/bin/env node
/**
 * Privacy guardrails (AGENTS.md "Privacy and test data").
 *
 * Two rules, both of which fail closed:
 *
 * 1. Photographic, audio, and video files may only live in an asset directory
 *    that carries a PROVENANCE.md. Real child media is always one of these
 *    formats, so an undocumented one is either a privacy incident or an asset
 *    whose usage rights nobody recorded.
 * 2. No `console.*` in shipped source. Client logs must never contain names,
 *    media URLs, recordings, photos, or tokens, and the cheapest way to
 *    guarantee that is to have no ad-hoc logging at all.
 */
import { access, readdir } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { findViolations, repoRoot, report, sourceFiles } from "./guardrails.mjs";
import { isConsoleCall, isMediaFile } from "./rules.mjs";

const IGNORED_DIRECTORIES = new Set([
  ".git", ".turbo", ".worktrees", "dist", "node_modules",
  "playwright-report", "scripts", "test-results"
]);

async function mediaFiles() {
  const found = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(entry.name)) continue;
        await walk(absolute);
        continue;
      }
      if (isMediaFile(entry.name)) {
        found.push(relative(repoRoot, absolute).split(sep).join("/"));
      }
    }
  }
  await walk(repoRoot);
  return found.sort();
}

async function hasProvenance(filePath) {
  let directory = dirname(join(repoRoot, filePath));
  while (directory.startsWith(repoRoot) && directory !== repoRoot) {
    try {
      await access(join(directory, "PROVENANCE.md"));
      return true;
    } catch {
      directory = dirname(directory);
    }
  }
  return false;
}

const undocumented = [];
for (const path of await mediaFiles()) {
  if (!(await hasProvenance(path))) {
    undocumented.push({ path, line: 1, text: "undocumented media file" });
  }
}

const consoleUse = await findViolations(
  (await sourceFiles()).filter(
    (path) =>
      !path.includes(".test.") &&
      !path.includes("/e2e/") &&
      !path.includes(".config.")
  ),
  isConsoleCall
);

const ok =
  report(
    "media files carry documented provenance",
    undocumented,
    "Add a PROVENANCE.md to the asset directory recording origin and usage rights — or delete the file. Real child media must never enter source control."
  ) &
  report(
    "no ad-hoc console logging in shipped source",
    consoleUse,
    "Logs must never contain names, media URLs, photos, recordings, or tokens. Use a redacting logger when one exists."
  );

process.exit(ok ? 0 : 1);
