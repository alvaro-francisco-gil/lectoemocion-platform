#!/usr/bin/env node
/**
 * Invariant 2 (AGENTS.md): templates never read or write progress state.
 *
 * Progress lives in `apps/player-web/src/world/`. The shell reads it, derives
 * a map view, and hands templates a manifest and a completion callback. A
 * template that could see progress could branch on it, and content that
 * branches on progress stops being replayable, portable, or reviewable on its
 * own.
 *
 * Shared packages are covered too: a contract that imports progress has made
 * progress part of the contract.
 */
import { findViolations, report, sourceFiles } from "./guardrails.mjs";
import { isProgressImport } from "./rules.mjs";

const files = await sourceFiles();

/** The shell owns progression; the renderer and the catalogue do not. */
const forbidden = files.filter(
  (path) =>
    path.startsWith("packages/") ||
    path.startsWith("apps/player-web/src/game/templates/")
);

const violations = await findViolations(forbidden, isProgressImport);

const ok = report(
  "templates and shared packages cannot reach progress",
  violations,
  "Progress belongs to the shell (apps/player-web/src/world/). A template receives a manifest and reports completion; it never reads progression."
);

process.exit(ok ? 0 : 1);
