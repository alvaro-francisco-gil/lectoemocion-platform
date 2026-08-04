import { readFile, readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";

export const repoRoot = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

/**
 * `scripts/` is excluded because it is build tooling rather than shipped
 * source, and because the guardrail tests there hold deliberate violations as
 * fixtures.
 */
const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".turbo",
  ".worktrees",
  "dist",
  "node_modules",
  "playwright-report",
  "scripts",
  "test-results"
]);

/** Every tracked source file under `root`, as repo-relative POSIX paths. */
export async function sourceFiles(root = repoRoot, extensions = [".ts", ".tsx"]) {
  const found = [];

  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(entry.name)) continue;
        await walk(absolute);
        continue;
      }
      if (extensions.some((extension) => entry.name.endsWith(extension))) {
        found.push(relative(repoRoot, absolute).split(sep).join("/"));
      }
    }
  }

  await walk(root);
  return found.sort();
}

export async function readSource(path) {
  return readFile(join(repoRoot, path), "utf8");
}

/**
 * Matches a line-by-line predicate across files, returning every violation as
 * `{ path, line, text }` so failures point at an exact location.
 */
export async function findViolations(paths, predicate) {
  const violations = [];
  for (const path of paths) {
    const source = await readSource(path);
    source.split("\n").forEach((text, index) => {
      if (predicate(text, path)) {
        violations.push({ path, line: index + 1, text: text.trim() });
      }
    });
  }
  return violations;
}

export function report(name, violations, guidance) {
  if (violations.length === 0) {
    console.log(`✓ ${name}`);
    return true;
  }

  console.error(`✗ ${name}`);
  for (const violation of violations) {
    console.error(`  ${violation.path}:${violation.line}  ${violation.text}`);
  }
  console.error(`  → ${guidance}`);
  return false;
}
