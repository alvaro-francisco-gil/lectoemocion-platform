# LectoEmoción Agent Contract

This is an **agentic-first repository**. Structure it so a capable agent can
locate ownership, understand invariants, make a bounded change, and verify that
change without reconstructing hidden context.

Optimize for strict types, small explicit interfaces, deterministic scripts,
fast feedback, searchable names, durable decisions, and tests at real
boundaries. Avoid ceremony documentation that duplicates code.

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
5. Published template and manifest versions are immutable.
6. No silent fallbacks. Invalid schema versions, missing *default* content, or
   denied access fail closed with a recoverable adult-facing error. Missing
   *personalised* media is the one declared exception: it falls back to default
   content and playback continues.

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
- Before claiming completion, run the exact typecheck, test, build, and
  end-to-end commands required by the active plan and inspect their output.

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

