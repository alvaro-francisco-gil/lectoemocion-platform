# LectoEmoción Agent Contract

This is an **agentic-first repository**. Structure it so a capable agent can
locate ownership, understand invariants, make a bounded change, and verify that
change without reconstructing hidden context.

Optimize for strict types, small explicit interfaces, deterministic scripts,
fast feedback, searchable names, durable decisions, and tests at real
boundaries. Avoid ceremony documentation that duplicates code.

`CLAUDE.md` is a symlink to this file. Edit `AGENTS.md`; never create a second
copy for one tool.

Scoped contracts exist for the areas with their own rules — read the one for
where you are working rather than only this file:

- [`packages/AGENTS.md`](packages/AGENTS.md) — shared contracts
- [`apps/player-web/AGENTS.md`](apps/player-web/AGENTS.md) — the player
- [`apps/mobile/AGENTS.md`](apps/mobile/AGENTS.md) — the native shell
- [`scripts/AGENTS.md`](scripts/AGENTS.md) — guardrails

## Product

LectoEmoción is a personalised early-literacy world for Spanish children aged
3–5, sold to schools and directly to families. A framing story unlocks
minigames from a map hub.

Every template ships with product-authored default content and is playable with
no uploads. Adults may upload a child's first name, recognisable photo,
pronunciation recording, and verified initial letter/sound, which **overrides**
those defaults slot by slot. Personalisation is an enhancement, never a
prerequisite. There is no AI-generated content.

Tenancy is Account → Group → child records, where a group is a class or a
family. No layer may assume a group is a school class.

The institutional market comes first, piloted with default content and no child
data at all. Personalisation is enabled per deployment only after that
deployment's privacy artefacts are complete.

One web player runtime serves every surface: the panel's browser on classroom
displays, and an embedded player inside a native Expo shell on phones and
tablets. A template is implemented exactly once. See
[ADR 0003](docs/decisions/0003-runtime-and-animation.md).

Read first:

- `docs/product/platform-design.md`
- `docs/decisions/0001-platform-foundations.md`
- `docs/decisions/0002-firebase-backend.md`
- `docs/privacy/spain-eu-baseline.md`
- the relevant plan under `docs/plans/`

## Repository health

Every change must leave the repository easier to navigate and modify.

- Keep one source of truth for every domain shape and invariant.
- Prefer deletion over compatibility shims or dead code.
- Fix stale documentation in the same change.
- Do not hide known debt in comments. Fix it or record a scoped plan.
- Do not perform unrelated refactors inside a feature or bug fix.
- Use explicit failures; never catch-and-default a broken invariant.

## Planned architecture

```text
apps/mobile/               Expo native shell and embedded player
apps/player-web/           React shell and Phaser 4 player
functions/                 Firebase Functions v2
packages/domain/           domain records and policies
packages/resource-schema/  versioned engine-neutral manifests
packages/template-sdk/     template contract
packages/template-catalog/ product-authored resources
packages/firebase/         typed Firebase clients, converters, and services
```

Do not create a directory before its implementation plan reaches that task.

## Architecture invariants

1. Models and resource schemas are authoritative. Data crossing app, service,
   function, or player boundaries uses shared types and runtime validation.
2. Templates and manifests are engine-neutral. They never contain renderer
   objects, executable code, device-pixel coordinates, or Firebase references.
   Templates never read or write progress state.
3. Firebase SDK imports are confined to `packages/firebase/`, `functions/`, and
   narrowly documented app bootstrap files. UI, hooks, Phaser scenes, and
   templates call typed services.
4. Guardrails live at every relevant trust boundary: service validation,
   Firestore/Storage Rules, and Functions for privileged operations. Hiding UI
   is never authorization.
5. Published template and manifest versions are immutable. "Published" means
   reachable by a user — see [ADR 0006](docs/decisions/0006-published-means-reachable.md).
6. No silent fallbacks. Invalid schema versions, missing *default* content, or
   denied access fail closed with a recoverable adult-facing error. Missing
   *personalised* media is the one declared exception: it falls back to default
   content and playback continues.

### Every invariant is enforced

An invariant nothing checks is a suggestion, and suggestions decay. Each of the
above has an executable guardrail; `pnpm guardrails` runs them all, and
`pnpm check` includes them.

| Invariant | Enforced by |
|---|---|
| 2 — engine-neutral contracts | `scripts/check-engine-neutral.mjs` |
| 2 — templates never read progress | `scripts/check-progress-boundary.mjs` |
| 3 — Firebase boundary | `scripts/check-firebase-boundary.mjs` |
| 5 — immutable published versions | `packages/template-catalog/src/publishedVersions.test.ts` |
| Privacy — media and logging | `scripts/check-privacy.mjs` |
| Strict typing | `scripts/check-strict-types.mjs` |

**When you add an invariant, add its check in the same change.** The rules
themselves live in `scripts/rules.mjs` and are unit-tested by
`scripts/rules.test.ts`, which proves each one flags a real violation and
accepts legitimate code. A guardrail without that test is decoration.

Do not weaken a guardrail to make a change pass. Either the change is wrong, or
the invariant has genuinely changed — in which case update the invariant, its
check, its test, and the documentation together.

## Typing

Strict typing is a design tool here, not a formality. `tsconfig.base.json`
enables `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`noImplicitReturns`, `noFallthroughCasesInSwitch`, and
`noPropertyAccessFromIndexSignature`.

- **No `any`, `@ts-nocheck`, or bare `@ts-ignore`.** Use `unknown` and narrow at
  the boundary. Enforced by `scripts/check-strict-types.mjs`.
- **Identifiers are branded.** `AccountId`, `GroupId`, `ChildRecordId`,
  `MediaAssetId`, `TemplateId`, and `ResourceId` are nominal types from
  `@lectoemocion/domain`. Construct them with the matching constructor; never
  cast a raw string. Passing a group id where a child id belongs is a
  compile error.
- **Discriminated unions get an exhaustiveness guard.** End every switch over a
  union with `default: assertNever(value, "description")`. Adding a member then
  breaks compilation at every site that must handle it, instead of silently
  falling through to the last branch.
- **Make illegal states unrepresentable.** Prefer a type that cannot express the
  invalid case over a runtime check that rejects it. A personalisation slot and
  its default content are one object (`ParticipantSlotSchema`), so "slot without
  a default" is a compile error rather than a test failure, and `resolveSlot`
  returns content rather than optional content, so the fallback cannot be
  skipped.
- **Derive types from schemas.** Manifest types come from the TypeBox schema via
  `Static<typeof Schema>`. Never hand-write a second declaration of a shape that
  a schema already defines.

There is no ESLint. `typescript-eslint` does not support TypeScript 7, which
this repo pins; the guardrail scripts cover what those rules would have. Revisit
when that support lands.

## Privacy and test data

Real child data is prohibited in development, tests, screenshots, fixtures,
logs, analytics, issue reports, and source control.

- Use synthetic names, generated avatars, and synthetic/silent audio.
- Never log names, media URLs, photos, recordings, tokens, or raw manifests.
- Child media is private; public URLs and security-by-unlisted-link are banned.
- Children never receive Firebase Authentication accounts.
- Analytics, Crashlytics, advertising identifiers, facial recognition,
  transcription, voice cloning, and model training are off by default.
- Deletion is a product capability, not an operational afterthought.
- Sensitive-data changes require privacy, authorization, retention, logging,
  and deletion review.

## Firebase

- Adults — teachers or parents — authenticate with Firebase Authentication.
- Firestore, Storage, and Functions use `europe-southwest1` unless an ADR
  explicitly changes the region.
- New collections or storage paths require, in the same change: shared model,
  runtime converter/validator, typed service, Rules, emulator tests, indexes
  where needed, and deletion behaviour.
- Cross-user, multi-document, or privileged writes belong in Functions.
- Functions triggered by events are idempotent.
- Never deploy or create cloud resources without explicit user authorization.

## Development discipline

- Package manager: `pnpm`; do not introduce npm or yarn lockfiles.
- New production behaviour follows RED → GREEN → REFACTOR.
- A bug fix starts with a failing regression test reproducing the defect.
- Test the smallest public boundary that proves behaviour; avoid tests coupled
  to implementation details.
- No `.skip`, `xit`, exclusion-list additions, hook bypasses, or muted failures.
- Before claiming completion, run `pnpm check` and inspect its output, plus
  `pnpm test:e2e` when the change touches the player.

## Commands

Run `pnpm commands` for the index. The one that matters is **`pnpm check`** —
guardrails, typecheck, tests, and build, in that order. It is the same gate CI
runs.

### Never start long-lived processes

These run until interrupted. The user owns that loop; starting one leaves you
blocked and the terminal occupied.

- `pnpm dev`, `vite`, or any dev server.
- `firebase emulators:start` as a standalone session.
- Any watch-mode test runner.

If you need output from one, ask the user to run it and paste the relevant
lines. Ephemeral, self-terminating runs — `pnpm check`, `pnpm test`,
`pnpm test:e2e` — are yours to run freely.

Never deploy or create cloud resources. That requires explicit authorization
every time; prior approval does not carry over.

## Documentation lifecycle

Use the `managing-plans-lifecycle` skill.

- `docs/plans/ideas/`: proposed or unresolved.
- `docs/plans/ready/`: approved and fully planned.
- `docs/plans/ongoing/`: implementation in progress, with a current Status
  block.
- `docs/decisions/`: durable rationale after decisions ship.

Do not create `docs/superpowers`, archive completed plans, or invent another
lifecycle taxonomy.

## Git

- Preserve unrelated user changes.
- Never use destructive git commands or broad staging.
- Use conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`,
  `build:`, and `chore:`.
- Do not bypass hooks or amend commits unless explicitly requested.
- Do not push, open a PR, deploy, or create remote resources without explicit
  authorization.

### The primary checkout stays on `main`

The repository root is the user's editor workspace. Switching its branch
changes what the user is looking at, mid-thought, without warning.

**Never run `git checkout <branch>`, `git switch <branch>`, or anything else
that moves `HEAD` in the repository root.** To work on a branch, add a
worktree:

```bash
git worktree add .worktrees/<short-name> -b <type>/<short-name>
```

Then do all work inside `.worktrees/<short-name>/`. Merging back:

```bash
# from the repository root, which is already on main
git merge --ff-only <type>/<short-name>
git worktree remove .worktrees/<short-name>
git branch -d <type>/<short-name>
```

`.worktrees/` is gitignored. Remove a worktree once merged; do not leave
abandoned ones behind.

Run `pnpm install` inside a new worktree before verifying — it has its own
`node_modules`.

Exception: committing directly to `main` in the root is acceptable for a small,
self-contained change the user has asked for in the current turn. Anything
speculative, long-running, or parallel gets a worktree.

## Be proactive

Surface these as a one-line suggestion at the end of your response — or as an
inline change when it is under about ten lines — whenever you notice:

- **An invariant with no guardrail** → propose the check and its rule test.
- **A manual procedure done twice** → a script under `scripts/`.
- **An encodable workflow** (a migration ritual, an audit playbook) → a skill
  under `.agents/skills/<name>/SKILL.md`.
- **A convention used in three or more places but undocumented** → an addition
  here, or a scoped `AGENTS.md` in that directory so agents working there do
  not load this whole file.
- **A single source of truth violated** (a duplicated shape, status string,
  threshold, or colour) → consolidate in the same change if small.
- **Documentation contradicting code** → fix or delete the document; never work
  around it.
- **A shipped plan still in `docs/plans/ongoing/`** → distil the durable
  rationale into `docs/decisions/`, then delete the plan.
- **A guardrail that would not have caught the bug you just fixed** → propose
  strengthening it.

