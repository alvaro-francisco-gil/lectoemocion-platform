#!/usr/bin/env node
/**
 * Invariant 2 (AGENTS.md): templates and manifests are engine-neutral.
 *
 * Phaser may only be imported inside the player's rendering adapter. Shared
 * packages must not import a renderer, a UI framework, or Firebase.
 */
import { findViolations, report, sourceFiles } from "./guardrails.mjs";
import {
  RENDERER_ADAPTER,
  isForbiddenInSharedPackage,
  isPhaserImport
} from "./rules.mjs";

const files = await sourceFiles();

const packageViolations = await findViolations(
  files.filter((path) => path.startsWith("packages/")),
  isForbiddenInSharedPackage
);

const phaserOutsideAdapter = await findViolations(
  files.filter(
    (path) => !path.startsWith(RENDERER_ADAPTER) && !path.startsWith("packages/")
  ),
  isPhaserImport
);

const ok =
  report(
    "shared packages are engine-, UI-, and backend-neutral",
    packageViolations,
    "Shared packages define contracts only. Move renderer, React, or Firebase usage into an app or a typed service."
  ) &
  report(
    `phaser confined to ${RENDERER_ADAPTER}`,
    phaserOutsideAdapter,
    `Import Phaser only inside ${RENDERER_ADAPTER}, so the renderer stays replaceable.`
  );

process.exit(ok ? 0 : 1);
