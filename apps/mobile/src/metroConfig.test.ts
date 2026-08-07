import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

/**
 * A regression test for the bundler, not for the shell.
 *
 * The symptom was `Unable to resolve "expo-modules-core" from
 * expo/src/Expo.ts` — a bundle that never built and an emulator stuck on a
 * splash screen. It reads as a broken install, which is what makes it
 * expensive: the install was fine and the resolver setting was wrong.
 *
 * pnpm puts a package's dependencies *beside* it inside the store, so
 * `expo-modules-core` is reachable from `expo` only by walking parent
 * directories. `nodeModulesPaths` cannot stand in for that walk, because the
 * store path carries a content hash and is not a fixed directory to list.
 */
describe("metro.config.js", () => {
  const config = require("../metro.config.js") as {
    resolver: {
      disableHierarchicalLookup?: boolean;
      unstable_enableSymlinks?: boolean;
      nodeModulesPaths?: readonly string[];
    };
  };

  it("leaves hierarchical lookup enabled, which is what pnpm resolution needs", () => {
    expect(config.resolver.disableHierarchicalLookup).not.toBe(true);
  });

  it("follows symlinks, which is the only kind of link pnpm creates", () => {
    expect(config.resolver.unstable_enableSymlinks).toBe(true);
  });

  it("still searches the workspace root, for hoisted packages", () => {
    expect(config.resolver.nodeModulesPaths?.length).toBeGreaterThan(1);
  });
});
