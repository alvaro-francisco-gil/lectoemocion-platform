#!/usr/bin/env node
/**
 * A child's namespace is derived from their profile id, in exactly one place
 * per thing that is theirs.
 *
 * `storageKey(id)` in `apps/player-web/src/world/progressStore.ts` builds
 * `lectoemocion.progress.<id>`, and `giftsKey(id)` in
 * `apps/player-web/src/world/prizeStore.ts` builds `lectoemocion.gifts.<id>`.
 * A profile's id *is* both namespaces. That is what keeps two children's stars
 * and two children's regalos apart on a shared family tablet, and it is only a
 * guarantee while one function builds each.
 *
 * A second place spelling a prefix out by hand can namespace a child's things
 * by something that is not a profile id — a display name, a stale constant, a
 * position in a list — and nothing about that failure is visible. There is no
 * error and no missing data; a sibling's world quietly becomes yours, and the
 * stars a child earned over a term, or the gift they were promised, belong to
 * someone else.
 *
 * The group's goal is deliberately not here: it is one line for a whole family
 * or class, so it is namespaced by the group and not by a child.
 *
 * No exceptions, tests included. A test that hand-builds a key is a test that
 * keeps passing after the real key changes shape, which is worse than no test:
 * it reports on a contract the app no longer has.
 */
import { findViolations, report, sourceFiles } from "./guardrails.mjs";
import { isChildNamespaceLiteral } from "./rules.mjs";

/** Where the keys are defined. The only places allowed to know their shape. */
const OWNERS = [
  "apps/player-web/src/world/progressStore.ts",
  "apps/player-web/src/world/prizeStore.ts"
];

const files = (await sourceFiles()).filter((path) => !OWNERS.includes(path));

const violations = await findViolations(files, isChildNamespaceLiteral);

const ok = report(
  "a child's storage keys are built only from their profile id",
  violations,
  `Import storageKey or giftsKey from ${OWNERS.join(" or ")} and pass a profile id. A key's shape is that function's business, and a profile id is the only thing that may namespace what belongs to one child.`
);

process.exit(ok ? 0 : 1);
