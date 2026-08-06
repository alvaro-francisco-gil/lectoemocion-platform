import { cpus } from "node:os";
import { defineConfig } from "vitest/config";

/**
 * Workspace packages are consumed as TypeScript source, so every worker
 * transforms and imports the whole graph — Phaser and React included — for
 * itself. Vitest's default fork count is sized for cheap workers, and at this
 * suite's size that starves the pool: workers time out before they answer, and
 * the files they were given never run.
 *
 * Capping the pool trades a little wall-clock for every test file actually
 * being executed.
 */
const maxForks = Math.max(2, Math.min(4, cpus().length - 2));

export default defineConfig({
  test: {
    pool: "forks",
    poolOptions: { forks: { maxForks } },
    projects: [
      "packages/*/vitest.config.ts",
      "apps/*/vitest.config.ts",
      "scripts/vitest.config.ts"
    ]
  }
});
