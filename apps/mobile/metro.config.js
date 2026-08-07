// Learn more https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

/*
 * pnpm keeps real packages in the workspace root's store and symlinks into each
 * project, so Metro has to watch the root and be told both module directories.
 * Without this the bundler resolves the shell's own dependencies and nothing
 * else — which is survivable only while the shell has no workspace imports, and
 * it will not stay that way.
 */
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules")
];
config.resolver.unstable_enableSymlinks = true;

/*
 * Hierarchical lookup stays ON, which is the opposite of the usual advice.
 *
 * That advice assumes npm or yarn, where every package is hoisted flat and
 * walking parent directories only finds duplicates. pnpm is the other shape: a
 * package's own dependencies sit beside it inside the store, so
 * `expo/src/Expo.ts` reaches `expo-modules-core` through its *sibling*, and
 * only a parent-directory walk gets there. `nodeModulesPaths` cannot substitute
 * — the store path contains a content hash and is not a fixed directory to
 * list.
 *
 * Disabling it bundles nothing and fails with `Unable to resolve
 * "expo-modules-core" from .../expo/src/Expo.ts`, which reads as a broken
 * install rather than a resolver setting.
 */

module.exports = config;
