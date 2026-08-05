# Shared packages

These packages define contracts. They are consumed by every surface — the
classroom player, the mobile shell, and later Cloud Functions — so anything
added here becomes everyone's problem.

## Hard boundaries

Enforced by `scripts/check-engine-neutral.mjs`; violating one fails
`pnpm check`.

- **No renderer.** Never import Phaser or any drawing library.
- **No UI framework.** Never import React or React DOM.
- **No backend.** Never import Firebase.
- **No device-pixel coordinates.** Layout is expressed as logical constraints
  and safe areas, resolved by the player.
- **No executable content.** A manifest carries data, never code or a
  serialised function.

If you need one of these, the code belongs in an app or a typed service, not
here.

## Ownership

| Package | Owns |
|---|---|
| `domain/` | Records, policies, branded identifiers, `assertNever` |
| `resource-schema/` | Versioned manifest schemas, validators, derived types |
| `template-sdk/` | The template contract, deterministic selection, and minigame rules |
| `template-catalog/` | Product-authored templates and synthetic fixtures |

One shape has one definition. `resource-schema` derives its types from TypeBox
via `Static<typeof Schema>`; never hand-write a parallel interface for a shape a
schema already describes.

## Identifiers

Every identifier is branded. Construct with `childRecordId(...)`,
`groupId(...)`, and so on — never cast a raw string. The cast lives inside
`domain/src/ids.ts` and nowhere else.

## Versioning

Published template and manifest versions are immutable. A behaviour change
creates a new version; it never edits an existing one.
`template-catalog/src/publishedVersions.test.ts` pins the output of each
published version. If that test fails, publish a new version — do not update
the expectation.

## Determinism

Selection must be reproducible: the same roster, strategy, and seed always
produce the same participants, in the same order. No `Math.random()`, no
`Date.now()`, no ambient state. Preview and classroom playback must agree.

## Tests

Colocated as `*.test.ts`, run by that package's `vitest.config.ts`. Test the
public boundary — the exported function — rather than internals.
