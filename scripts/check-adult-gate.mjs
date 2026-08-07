#!/usr/bin/env node
/**
 * The adult area is reachable only through its gate.
 *
 * This is a structural check, not a semantic one: it enforces that only
 * `adult/index.tsx` is importable from outside the directory, and that entry
 * point is what applies the gate. Hiding UI is never authorization
 * (invariant 4), and this check does not prove access control — it only
 * proves nothing bypasses the one door that does.
 */
import { findViolations, report, sourceFiles } from "./guardrails.mjs";
import { ADULT_AREA, isDeepAdultAreaImport } from "./rules.mjs";

const guarded = (await sourceFiles()).filter(
  (path) => !path.startsWith(ADULT_AREA)
);

const ok = report(
  "adult area reachable only through its gate",
  await findViolations(guarded, isDeepAdultAreaImport),
  "Import AdultArea from apps/player-web/src/app/adult instead."
);

process.exit(ok ? 0 : 1);
