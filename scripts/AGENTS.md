# Guardrail scripts

Executable enforcement for the architecture and privacy invariants in the root
[AGENTS.md](../AGENTS.md). `pnpm guardrails` runs them all; `pnpm check`
includes them.

## Layout

| File | Role |
|---|---|
| `rules.mjs` | The rules themselves, as pure predicates |
| `rules.test.ts` | Proves every rule fires on a violation and accepts valid code |
| `guardrails.mjs` | File walking, matching, and reporting |
| `check-*.mjs` | One executable per invariant |
| `help.mjs` | The `pnpm commands` index |
| `import-*.mjs` | One-off content importers — not guardrails, not run by `pnpm check` |
| `verify-deployment.mjs` | Checks the live site after a deploy — not a guardrail |
| `mobile-emulator.mjs` | Drives the native shell on an Android emulator — not a guardrail |
| `lib/` | Pure logic for the non-guardrail scripts, with tests beside it |

Rules live apart from the scripts that run them so they can be unit-tested. A
guardrail nobody proved can fail is decoration — that is why `rules.test.ts`
exists and why every new rule needs a case there.

`verify-deployment.mjs` is deliberately outside that set. Guardrails scan source
and must run offline before any install; it needs a site that exists, so
`pnpm check` cannot depend on it without making the gate require a network and
a deploy. Its rules still live in `lib/deployed-player.mjs` and are tested
beside it, for the same reason every other rule is.

## Adding a guardrail

1. Add the predicate to `rules.mjs`.
2. Add cases to `rules.test.ts`: at least one violation it must flag, and one
   piece of legitimate code it must not.
3. Add or extend a `check-*.mjs` that applies it and calls `report()`.
4. Wire it into the `guardrails` script in `package.json` and into `help.mjs`.
5. Record the invariant it enforces in the root `AGENTS.md` table.

Verify both directions: run it clean, then introduce a violation, confirm a
non-zero exit, and remove it.

## Conventions

- Exit non-zero on any violation. Report every violation, not just the first —
  an agent fixing one at a time wastes runs.
- Every failure prints `path:line`, the offending text, and a `→` line saying
  what to do instead. A guardrail that only says "no" teaches nothing.
- Node built-ins only. These must run before and independently of any install
  step.
- `scripts/` is excluded from the scanners: it is tooling, and the rule tests
  hold deliberate violations as fixtures.

## Do not weaken a guardrail to make a change pass

Either the change is wrong, or the invariant genuinely changed — in which case
update the invariant, its rule, its test, and the documentation together, in the
same commit.
