# ADR 0005: Content pipeline boundaries

Date: 2026-08-05  
Status: Accepted

Distilled from the foundation-and-synthetic-player plan, which shipped and was
verified on 2026-08-05. It records the boundaries that stage 1 established and
that every later stage inherits.

## Context

The catalogue grows without bound and a template is implemented exactly once
([ADR 0003](0003-runtime-and-animation.md)). That makes the seam between
authored content and the renderer the highest-leverage boundary in the
repository: every future template, every personalisation slot, and any renderer
replacement crosses it.

Stage 1 built one animated story and one interactive initials game on synthetic
records, with no backend, in order to force that seam into existence before
volume made it expensive to move.

## Decision

### Packages depend in one direction

```text
domain → resource-schema → template-sdk → template-catalog → player-web
```

`domain` owns child records, branded identifiers, and Spanish initial
normalisation, and depends on nothing. `player-web` is the only package that
may import Phaser. No package imports a package to its right.

### The manifest schema is the single declaration of a resource shape

`packages/resource-schema` defines a **closed** TypeBox schema — unknown
properties are rejected, not ignored — and TypeScript types are derived from it
with `Static<typeof Schema>`. There is no hand-written second declaration of a
manifest shape, so a schema change cannot silently disagree with a type.

Manifests are validated with Ajv at the boundary where they enter the player,
not trusted because they came from our own catalogue. A manifest that fails
validation fails closed.

### Templates are pure; the renderer is an adapter

A template maps records plus a manifest to a description of what to draw. It
returns data, never renderer objects, and never touches progress state. The
Phaser adapter is the only code that turns that description into a scene.

Consequence: replacing Phaser costs one adapter, and a template is testable in
a Node environment with no canvas.

### Participant selection is seeded, never random

`selectParticipants(roster, strategy, seed)` is a pure function over an
explicit seed, using an FNV-1a hash and a linear congruential generator rather
than `Math.random`. The same roster, strategy, and seed always yield the same
participants in the same order.

This is what makes a personalised resource reproducible: a child who sees
themselves in a chapter sees themselves again on replay, and a test asserts an
exact selection instead of a shape. A strategy that cannot be satisfied — more
participants requested than the roster holds — throws rather than returning a
short list.

### One logical resolution, verified at three sizes

The player renders at a 1080p logical canvas and scales. There is no
device-specific layout code. Playwright runs the same specification as three
projects — phone, HD classroom, 4K classroom — and layout correctness is
whatever those three agree on.

### Synthetic fixtures are the only fixtures

Generated names, geometric avatars, and audio-free content, from the first
commit. Synthetic data was never a stage-1 concession to be relaxed later; it
is the permanent development posture until a deployment's privacy artefacts are
complete.

## Rejected alternative

**Let the player read records directly and skip the manifest.** Faster for two
templates. Rejected because it makes the renderer the definition of a resource:
every template would then encode its own reading of a child record, and
personalisation slots would have no single place to live. The manifest exists so
that content, contract, and renderer can be versioned separately.

## What this binds

- Stage 3 models personalisation slots inside `resource-schema`, as part of the
  manifest, with a slot and its default content as one type.
- New template kinds extend the schema and the catalogue; they do not extend the
  Phaser adapter's knowledge of the domain.
- Any renderer change is confined to `apps/player-web/src/game/`.
- Selection remains seeded. A future strategy that needs randomness takes a seed
  parameter; it does not call a global random source.

## Revisit when

- A template genuinely cannot be expressed as data plus a shared renderer — at
  which point the failing case, not the inconvenience, justifies the change.
- Manifest validation cost becomes measurable on target panel hardware.

## Not covered by stage 1

Progression, the map hub, default content, personalisation slots, and every
backend concern. Stage 1 validated the manifest and template boundaries only;
see [the roadmap](../product/implementation-roadmap.md).
