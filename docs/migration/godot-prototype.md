# Godot prototype assessment

Date assessed: 2026-07-09  
Source: `alvaro-francisco-gil/lectoemocion`

## Recommendation

Preserve the repository unchanged as a prototype and product reference. Do not
use it as the foundation of the new platform and do not merge its history into
this repository.

## Useful material

- Pairs, syllables, initials, and other game concepts.
- Existing interaction experiments.
- Shared completion-animation ideas.
- Spanish educational vocabulary and content structure.
- A runnable reference when evaluating Phaser equivalents.

## Reasons not to migrate the implementation

- It is a Godot/GDScript application, while the approved platform uses Expo,
  React Native, Phaser, and TypeScript.
- Games discover bundled content from asset filenames rather than consuming
  private, versioned roster manifests.
- Several layouts use fixed positions and compensating pixel offsets.
- Authentication and Firestore REST operations are coupled directly to the
  game runtime.
- No automated test harness or resource-schema contract is present.
- The Git pack is approximately 190 MB and dominated by binary assets.
- The repository does not contain the privacy, retention, deletion, and
  creator-only access boundaries required for identifiable child media.
- The README claims HTML5 export readiness, but an export preset is not
  committed.

## Status

| Prototype minigame | New template | State |
|---|---|---|
| `iniciales` | `initials-game` | reimplemented (roadmap stage 1) |
| `parejas` | `pairs-game` | reimplemented |
| `cartapum` | `word-picture-game` | reimplemented |
| `silabas` | `syllables-game` | reimplemented |

Rules and objectives are in
[minigame-specifications.md](minigame-specifications.md), which is authoritative
where it disagrees with the prototype. Rules live in
`packages/template-sdk/src/rules/`; presentation lives in
`apps/player-web/src/game/templates/`.

Step 6 is done for the vocabulary pictures: 109 of them were imported by
`scripts/import-vocabulary-images.mjs`, resized and re-encoded as WebP, with
rights recorded in `apps/player-web/public/vocabulary/PROVENANCE.md`. Read that
file's "Known limitation" before relying on the licensing.

The prototype's sounds and background textures have not been imported.

## Selective migration process

For each old minigame:

1. Write its learning objective and rules without referring to Godot.
2. Review whether the mechanic fits the new class-roster model.
3. Define a versioned template contract.
4. Reimplement rules with tests in TypeScript.
5. Recreate presentation responsively in Phaser.
6. Import an old asset only after documenting provenance and usage rights.
7. Compare behaviour with the prototype, then treat the new implementation as
   authoritative.

No source file should be mechanically translated from GDScript.

