#!/usr/bin/env node
/**
 * Invariant 3 (AGENTS.md): Firebase SDK imports are confined to
 * `packages/firebase/`, `functions/`, and narrowly documented bootstrap files.
 *
 * The allow-list in rules.mjs is the documentation. Adding a path to it is a
 * reviewable decision, not an incidental import.
 */
import { findViolations, report, sourceFiles } from "./guardrails.mjs";
import {
  FIREBASE_ALLOWED_FILES,
  FIREBASE_ALLOWED_PREFIXES,
  isFirebaseImport
} from "./rules.mjs";

const guarded = (await sourceFiles()).filter(
  (path) =>
    !FIREBASE_ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix)) &&
    !FIREBASE_ALLOWED_FILES.includes(path)
);

const ok = report(
  "firebase SDK confined to its boundary",
  await findViolations(guarded, isFirebaseImport),
  "Call a typed service from packages/firebase/ instead. Hiding UI is never authorization."
);

process.exit(ok ? 0 : 1);
