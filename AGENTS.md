# LectoEmoción Agent Contract

This is an **agentic-first repository**. Structure it so a capable agent can
locate ownership, understand invariants, make a bounded change, and verify that
change without reconstructing hidden context.

Optimize for strict types, small explicit interfaces, deterministic scripts,
fast feedback, searchable names, durable decisions, and tests at real
boundaries. Avoid ceremony documentation that duplicates code.

## Product

LectoEmoción creates private, personalised early-literacy games and animated
stories for Spanish children aged 3–5. Teachers upload a child's first name,
recognisable photo, pronunciation recording, and verified initial letter/sound.
Product-authored templates combine several class records into deterministic
resources. There is no AI-generated content.

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
apps/teacher-mobile/       Expo and React Native teacher workflow
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
2. Templates and manifests are engine-neutral. They never contain Phaser
   objects, executable code, device-pixel coordinates, or Firebase references.
3. Firebase SDK imports are confined to `packages/firebase/`, `functions/`, and
   narrowly documented app bootstrap files. UI, hooks, Phaser scenes, and
   templates call typed services.
4. Guardrails live at every relevant trust boundary: service validation,
   Firestore/Storage Rules, and Functions for privileged operations. Hiding UI
   is never authorization.
5. Published template and manifest versions are immutable.
6. No silent fallbacks. Missing media, invalid schema versions, or denied
   access fail closed with a recoverable teacher-facing error.

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

- Adult teachers authenticate with Firebase Authentication.
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

