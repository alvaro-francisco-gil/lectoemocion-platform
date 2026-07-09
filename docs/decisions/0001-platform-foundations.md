# ADR 0001: Platform foundations

Date: 2026-07-09  
Status: Accepted for planning

## Context

Teachers create personalised literacy resources from class photos, names, and
audio. Creation happens primarily on phones; playback happens primarily on
heterogeneous interactive classroom displays. The first implementation must
support iOS and Android creation without implementing every game twice.

## Decision

- Use a TypeScript monorepo.
- Use Expo and React Native for the teacher application.
- Use one Phaser web player for animated stories and interactive games.
- Run the player directly in classroom browsers and embed it for mobile
  playback when required.
- Use deterministic, predefined templates rather than AI generation.
- Keep resource schemas independent of Phaser.
- Use creator-only authentication for the initial product.
- Keep the previous Godot implementation as a prototype rather than a codebase
  to migrate.

## Why not a native board application?

Classroom displays use a mixture of Android, Windows, ChromeOS, macOS, and
externally connected computers. Browser delivery avoids installation and update
requirements while allowing teachers to change games directly on the board.

## Why not Godot initially?

Godot offers stronger visual authoring and a higher game-production ceiling,
but its web runtime adds loading and compatibility risk on unknown classroom
hardware. Phaser is sufficient for the intended rich 2D scope and integrates
cleanly with authenticated web delivery.

Godot remains an escape hatch when a measured limitation—not hypothetical
future ambition—justifies the migration cost.

## Consequences

- The teacher UI can use native mobile capabilities without containing game
  logic.
- Gameplay is implemented once.
- Browser compatibility becomes a release criterion.
- Template schemas require careful versioning and semantic design.
- Mobile playback uses a web runtime unless a later decision changes it.

