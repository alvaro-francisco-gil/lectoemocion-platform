#!/usr/bin/env node
/**
 * The adult area is reachable only through its gate.
 *
 * This is a structural check, not a semantic one: it flags a static
 * `from "..."`, a dynamic `import("...")`, or a `require("...")` anywhere
 * outside the directory that names a path under `adult/` other than the
 * entry point itself (`./adult` or `./adult/index`). It does not catch a
 * multi-line import whose `from` clause sits on its own source line — the
 * line-by-line scanner shares that gap with the firebase-boundary and
 * progress-boundary checks. Hiding UI is never authorization (invariant 4),
 * and this check does not prove access control — it only proves nothing
 * bypasses the one door that applies `AdultGate`.
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
