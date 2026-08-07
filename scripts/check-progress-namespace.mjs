#!/usr/bin/env node
/**
 * A progress namespace is derived from a profile id, in exactly one place.
 *
 * `storageKey(id)` in `apps/player-web/src/world/progressStore.ts` builds
 * `lectoemocion.progress.<id>`, and a profile's id *is* that namespace. It is
 * what keeps two children's stars apart on a shared family tablet, and it is
 * only a guarantee while one function builds it.
 *
 * A second place spelling the prefix out by hand can namespace progress by
 * something that is not a profile id — a display name, a stale constant, a
 * position in a list — and nothing about that failure is visible. There is no
 * error and no missing data; a sibling's world quietly becomes yours, and the
 * stars a child earned over a term belong to someone else.
 *
 * No exceptions, tests included. A test that hand-builds the key is a test
 * that keeps passing after the real key changes shape, which is worse than no
 * test: it reports on a contract the app no longer has.
 */
import { findViolations, report, sourceFiles } from "./guardrails.mjs";
import { isProgressKeyLiteral } from "./rules.mjs";

/** Where the key is defined. The one place allowed to know its shape. */
const OWNER = "apps/player-web/src/world/progressStore.ts";

const files = (await sourceFiles()).filter((path) => path !== OWNER);

const violations = await findViolations(files, isProgressKeyLiteral);

const ok = report(
  "progress keys are built only from a profile id",
  violations,
  `Import storageKey from ${OWNER} and pass a profile id. The key's shape is that function's business, and a profile id is the only thing that may namespace progress.`
);

process.exit(ok ? 0 : 1);
