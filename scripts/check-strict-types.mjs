#!/usr/bin/env node
/**
 * Type-safety guardrails.
 *
 * `tsc` cannot catch a type hole that was opened deliberately. These patterns
 * are how strictness is usually escaped, so they are banned outright rather
 * than left to review.
 *
 * This check exists because typescript-eslint does not support TypeScript 7,
 * which this repo pins. Replace it with `@typescript-eslint/no-explicit-any`
 * and friends once that support lands.
 */
import { findViolations, report, sourceFiles } from "./guardrails.mjs";
import { STRICT_TYPES_ALLOWED_FILES, isStrictTypeEscape } from "./rules.mjs";

const files = (await sourceFiles()).filter(
  (path) => !STRICT_TYPES_ALLOWED_FILES.includes(path)
);

const ok = report(
  "no escapes from strict typing",
  await findViolations(files, isStrictTypeEscape),
  "Use `unknown` and narrow at the boundary. If a type is genuinely unrepresentable, fix the type, do not silence the compiler."
);

process.exit(ok ? 0 : 1);
