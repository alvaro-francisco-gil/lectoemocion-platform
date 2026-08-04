# ADR 0004: Every invariant is executable

Date: 2026-08-04  
Status: Accepted

## Context

This repository is developed primarily by agents. Its `AGENTS.md` stated six
architecture invariants and a privacy baseline, none of which were enforced by
anything: no linter, no CI, no aggregate gate.

An unenforced rule is a suggestion. Agents do not violate suggestions
maliciously; they violate them when a plausible shortcut compiles and nothing
goes red. Over a long-lived catalogue that decay is guaranteed rather than
likely.

The failure modes here are not evenly weighted. A renderer import leaking into a
shared contract costs a refactor. A child's photograph committed to git history
is not recoverable.

## Decision

Every invariant has an executable check, and all of them run in one gate.

- `pnpm check` runs guardrails, typecheck, tests, and build. CI runs the same
  command; there is no separate CI-only configuration to drift.
- Guardrail rules live as pure predicates in `scripts/rules.mjs`, apart from the
  scripts that apply them, so they can be unit-tested.
- `scripts/rules.test.ts` proves each rule flags a real violation *and* accepts
  legitimate code. A guardrail whose ability to fail was never demonstrated is
  decoration.
- Adding an invariant means adding its check in the same change.
- Weakening a guardrail to make a change pass is prohibited. Either the change
  is wrong, or the invariant changed — and then the invariant, rule, test, and
  documentation move together.

### Typing

Strict typing is treated as a design tool rather than a formality.
`tsconfig.base.json` adds `noImplicitReturns`, `noFallthroughCasesInSwitch`,
`noPropertyAccessFromIndexSignature`, `noImplicitOverride`, `isolatedModules`,
and `verbatimModuleSyntax` to the existing `strict`,
`noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes`.

Three patterns are mandatory:

- **Branded identifiers.** Six nominal ID types, constructed through validating
  functions. Passing a group id where a child id belongs is a compile error.
- **Exhaustiveness guards.** Every switch over a discriminated union ends in
  `assertNever`. Adding a union member breaks compilation at each site that must
  handle it. This was not hypothetical: `ResourceScene` treated any unrecognised
  template as the initials game, so a third template would have silently
  rendered the wrong scene.
- **Illegal states unrepresentable.** Preferred over runtime rejection. When
  personalisation slots arrive, a slot and its default are one type.

### No ESLint

`typescript-eslint` does not support TypeScript 7, which this repo pins.
Downgrading the compiler to gain a linter is the worse trade: the guardrail
scripts already cover `no-explicit-any`, the import boundaries, and the logging
ban, and they run without a toolchain dependency. Revisit when TS 7 support
lands.

## Consequences

- One command to verify, locally and in CI.
- Guardrail failures name a file, a line, and a corrective action, so an agent
  can act without reading this document.
- Scoped `AGENTS.md` files exist in `packages/`, `apps/player-web/`, and
  `scripts/`, so an agent loads the rules for where it is working.
- Grep-based checks are coarse. They can produce false positives; the fix is to
  narrow the rule and add a test case, never to add a blanket exclusion.
- `scripts/` is excluded from scanning, because the rule tests hold deliberate
  violations as fixtures.

## Revisit when

- `typescript-eslint` supports TypeScript 7 — several checks then become lint
  rules with better precision.
- A guardrail produces repeated false positives, indicating the rule rather than
  the code is wrong.
- Firebase lands, which activates the currently dormant boundary allow-list.
