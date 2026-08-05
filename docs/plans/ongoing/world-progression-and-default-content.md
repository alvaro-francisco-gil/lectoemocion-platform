# World, progression, and default content

Roadmap stage 3.

## Status

- **Updated:** 2026-08-05
- **Stage:** task 1 — participant slots
- **Branch:** `feat/world-progression` in `.worktrees/world-progression`
- **Done:** open questions resolved; plan rebased onto the vocabulary minigames
- **Next:** `Slot`, `resolveSlot`, name-story and initials-game version 2
- **Blockers:** none
- **Handoff:** default artwork is deliberately deferred to
  [default-vocabulary-artwork.md](../ideas/default-vocabulary-artwork.md);
  placeholder glyphs are a decision, not an oversight

## Goal

The world is playable end to end with **no uploads and no backend**: an adult
opens it, plays a story chapter, unlocks a minigame, replays it, reaches a
non-interactive resource, and finds the same progress on the next visit.

## Context

Five templates exist. Three of them — `pairs-game`, `word-picture-game`,
`syllables-game` — already carry product-authored default vocabulary and no
child data at all, which is exactly what the 9a default-content pilot plays.
They need nothing from this stage.

The gap is narrower than it looks, and it is in the other two. `name-story` and
`initials-game` take `participants` built from child records, with **no
default**. They cannot play without a roster, which inverts the product rule:
default content is the resource, personalisation is an overlay on it.

Stage 3 fixes that inversion, then builds the world that sequences all five.

Constraints from the contract:

- Templates never read or write progress ([AGENTS.md](../../../AGENTS.md)
  invariant 2). The map reads progress, so the map is not a template.
- Missing *personalised* media falls back to default; missing *default* media
  fails closed (invariant 6).
- Published versions are immutable (invariant 5).
- Adults cannot skip ahead; the development bypass must not be reachable in
  production ([platform-design.md](../../product/platform-design.md) §6.1).
- No backend until stage 4. Progress persists locally.

## Design

### 1. A slot and its default are one type

The stage's central constraint: *"slot without a default" must fail
compilation, not review.*

```ts
ParticipantSlotSchema = Type.Object({
  slotId,
  default: CharacterSchema,                        // required, always
  personalised: Type.Optional(PersonalisedCharacterSchema)
}, { additionalProperties: false })
```

`default` is a required property of the schema, and the type is derived from
the schema, so no constructor, catalogue entry, or fixture can express a slot
without one. Resolution is total:

```ts
export function resolveSlot(slot: ParticipantSlot): Character {
  return slot.personalised ?? slot.default;
}
```

It returns `Character`, never `Character | undefined`. That signature *is*
invariant 6's declared exception — the fallback cannot be forgotten at a call
site because no code path yields nothing. `personalised` carries
`childRecordId` so deleting a child record can find and strip it, leaving the
default behind.

### 2. Two template versions retire, the envelope does not move

`schemaVersion` stays `1`: the envelope shape does not change. What changes is
the content of two templates, so **`name-story` and `initials-game` go to
version 2** and their version 1 is deleted rather than carried.

That follows the resolved principle in question A — "published" means
*reachable by a user*, and no user can hold a manifest from a product with no
backend. The vocabulary games are untouched at version 1. This is narrower than
the plan originally proposed, which predated the per-template manifest union;
the principle is the same, the blast radius is two templates instead of the
whole schema.

`publishedVersions.test.ts` is re-pinned on the new output, and the definition
of "published" goes into an ADR in the same change.

### 3. The world is authored data

`packages/template-catalog/src/world/` holds the node graph: each node's id,
title, the resource it plays, and the nodes that unlock it. Engine-neutral and
schema-validated, so a broken world fails at load with an adult-facing error
rather than rendering a map with a hole in it.

A node declares *which template and which parameters*, not a function. A
catalogue dispatcher turns a node into a manifest, switching on template id
with `assertNever` so a new template cannot be forgotten.

### 4. Unlock state is derived, never stored

Storage holds only what happened:

```ts
interface Progress {
  completed: readonly ResourceId[];
  lastPlayed: ResourceId | null;
}
```

Unlocked-ness is computed from `Progress` plus the graph on every read. Storing
it would mean migrating saved state whenever content changes the graph — and
content changes the graph on every product update.

### 5. Progress lives behind an interface, in the shell

```ts
interface ProgressStore {
  read(): Promise<Progress>;
  recordCompletion(resource: ResourceId): Promise<Progress>;
}
```

Stage 3 ships `LocalProgressStore` over `localStorage`, keyed by an owner id.
Stage 3's owner is a single implicit local profile (resolved question B); stage
4 passes a real account id into the same interface with no migration. Corrupt
or foreign stored JSON resets to empty rather than crashing.

It lives in `apps/player-web/src/world/`, because nothing shared may touch
progress.

### 6. The map is shell state rendered by a dumb adapter

The shell computes a view; the renderer draws it and reports taps back.

```ts
type NodeState = "locked" | "unlocked" | "completed";
interface MapView { nodes: readonly MapNodeView[] }
```

The map scene receives no progress and no store. That is what stops the map
becoming a template that reads progress by the back door.

### 7. The non-interactive resource kind

A new template, `memory-album`: a fixed timeline that shows each slot's picture
and name in sequence, with no interaction and no export, download, or share
affordance (§6.3). It uses the same participant slots as `name-story`, so it is
fully playable on defaults.

### 8. The development bypass

A `LECTOEMOCION_UNLOCK_ALL` flag read through `import.meta.env`, statically
eliminated from a production build. A test asserts the built bundle contains
neither the flag name nor the bypass branch — an assertion about `dist/`,
because that is where the guarantee has to hold.

## Tasks

Each follows RED → GREEN → REFACTOR and ends green on `pnpm check`.

- [ ] **1. Participant slots.** `Slot`, `resolveSlot`, `name-story` v2 and
      `initials-game` v2 carrying slots, v1 of both deleted, catalogue and
      renderers updated, `publishedVersions.test.ts` re-pinned.
- [ ] **2. Default characters.** Product-authored characters so both templates
      play with zero personalisation. Test: every catalogue resource resolves
      every slot with no personalised content present.
- [ ] **3. World graph.** Schema, validator, authored graph, node-to-manifest
      dispatcher. Tests: unknown unlock target fails validation; no cycles;
      exactly one entry node.
- [ ] **4. Unlock derivation.** `deriveUnlocks(world, progress)`. Tests: entry
      unlocked from empty progress; completion unlocks successors; two
      prerequisites both required; pure.
- [ ] **5. Progress store.** `ProgressStore`, `LocalProgressStore`, validation
      on read. Tests: round-trip; corrupt JSON resets; unknown ids dropped.
- [ ] **6. Map hub.** `MapView` in the shell, Phaser map scene, node routing.
      Tests: locked nodes are not selectable; completing updates the map
      without a reload.
- [ ] **7. `memory-album`.** Schema branch, catalogue resource, renderer.
      Tests: plays to completion; exposes no export affordance.
- [ ] **8. Bypass flag.** Guarded unlock-all plus the `dist/` assertion.
- [ ] **9. End to end.** Playwright, three viewports: world → chapter →
      minigame unlocks → replay → non-interactive → reload → progress intact.
- [ ] **10. Guardrail: templates cannot reach progress.** Invariant 2 says
      templates never touch progress, and nothing checks it. Rule in
      `scripts/rules.mjs`, test in `scripts/rules.test.ts`.

## Acceptance

```bash
pnpm check
pnpm test:e2e
```

Plus, by inspection:

- every catalogue resource plays with no personalised content present;
- no `packages/` file imports progress, and no template signature receives it;
- a production build contains no unlock bypass;
- no real child data anywhere, and every asset directory has a `PROVENANCE.md`.

## Resolved questions

**A. Does the old version survive?** No. "Published" means reachable by a user;
nothing is. `name-story` v1 and `initials-game` v1 are deleted rather than
carried, and the definition is recorded in an ADR alongside the change. The
vocabulary games keep version 1 — nothing about them changes.

**B. Whose progress is it before accounts exist?** One implicit local profile,
with `ProgressStore` already shaped to take an owner so stage 4 supplies a real
account id without a migration. No per-child progress in stage 3.

**C. Who produces the default art?** Deferred by decision.
[default-vocabulary-artwork.md](../ideas/default-vocabulary-artwork.md) owns it
and is blocked on licensing, not engineering. Stage 3 ships on the existing
deterministic placeholder glyphs.
