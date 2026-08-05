/**
 * The development bypass (platform-design.md §6.1).
 *
 * Adults cannot skip ahead, and there is no product-facing unlock override.
 * Development, automated tests, demos, screenshots, and support reproduction
 * still need one, so it lives behind a build-time flag rather than a runtime
 * setting: `import.meta.env` is statically replaced, so with the variable
 * unset the branch and its name are eliminated from the bundle entirely.
 *
 * `e2e/bypass.spec.ts` asserts that against the built output, because the
 * guarantee has to hold in `dist/`, not in source.
 */
export function unlockAllEnabled(): boolean {
  return import.meta.env.VITE_LECTOEMOCION_UNLOCK_ALL === "true";
}
