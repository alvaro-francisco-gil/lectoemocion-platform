# World, progression, and default content

Roadmap stage 3. Proposed, not approved — three open questions at the bottom
need answers before this moves to `ready/`.

## Goal

The world is playable end to end with **no uploads and no backend**: an adult
opens it, plays a story chapter, unlocks a minigame, replays it, reaches a
non-interactive resource, and finds the same progress on the next visit.

## Context

Stage 1 proved the manifest and template boundaries ([ADR
0005](../../decisions/0005-content-pipeline-boundaries.md)) on two resources
selected by hand. It has no world, no progression, no resource kinds in the
manifest, and no default content — every participant in a stage 1 manifest is a
child record, so nothing is playable without a roster.

That is the gap stage 3 closes, and it inverts the dependency: **default
content is the resource, personalisation is an overlay on it.** Getting that
inversion right in the type system is the point of this stage. Everything else
here is a consequence of it.

Constraints from the contract that shape the design:

- Templates never read or write progress ([AGENTS.md](../../../AGENTS.md)
  invariant 2). The map reads progress, so the map is not a template.
- Missing *personalised* media falls back to default; missing *default* media
  fails closed (invariant 6).
- Adults cannot skip ahead; a build-level bypass for development and testing
  must not be reachable in production
  ([platform-design.md](../../product/platform-design.md) §6.1).
- No backend until stage 4. Progress persists locally.

## Proposed design

### 1. A slot and its default are one type

The stage's central constraint, stated in the roadmap: *"slot without a
default" must fail compilation, not review.*

```ts
// packages/resource-schema — derived from the TypeBox schema, not hand-written
export interface Slot<Content> {
  role: SlotRole;
  default: Content;              // required — there is no optional variant
  personalised?: Content;        // the overlay
}
```

There is no `Slot` without `default` anywhere in the type space, so no
constructor, catalogue entry, or test fixture can produce one. Resolution is a
single total function:

```ts
export function resolveSlot<C>(slot: Slot<C>): C {
  return slot.personalised ?? slot.default;
}
```

`resolveSlot` returns `C`, never `C | undefined`. That signature *is* invariant
6's declared exception — the fallback cannot be forgotten at a call site
because there is no code path that yields nothing.

### 2. Manifest schema version 2

Version 2 adds `kind`, `slots`, and world placement. Version 1 has no slots and
cannot express a default, so this is a new version rather than an edit.

Whether v1 survives alongside v2 is **open question A** below.

### 3. The world is authored data, not code

`packages/template-catalog/src/world/` holds the node graph: each node's id,
title, resource kind, the manifest it plays, and the nodes that unlock it. It
is engine-neutral and schema-validated like any other content, so a broken
world fails at load with an adult-facing error rather than rendering a map with
a hole in it.

### 4. Unlock state is derived, never stored

Storage holds only what actually happened:

```ts
interface Progress {
  completed: readonly ResourceId[];
  lastPlayed: ResourceId | null;
}
```

Unlocked-ness is computed from `Progress` plus the world graph on every read.
Storing it would mean migrating every account's saved state whenever content
changes the graph — and content changes the graph on every product update.

### 5. Progress lives behind an interface, in the shell

```ts
interface ProgressStore {
  read(): Promise<Progress>;
  recordCompletion(resource: ResourceId): Promise<Progress>;
}
```

Stage 3 ships `LocalProgressStore` over `localStorage`, validated on read —
corrupt or foreign JSON resets to empty rather than crashing. Stage 4 swaps in
a Firestore implementation behind the same interface with no caller changes.

It lives in `apps/player-web/src/world/`, not in a shared package, because
nothing shared may touch progress.

### 6. The map is shell state rendered by a dumb adapter

The shell computes a view and hands it over; the renderer draws it and reports
taps back.

```ts
type NodeState = "locked" | "unlocked" | "completed";
interface MapView { nodes: readonly { id: NodeId; state: NodeState; … }[] }
```

The renderer receives no progress and no store. This is what keeps the map from
becoming a template that reads progress by the back door.

### 7. Default content assets

Geometric, product-authored placeholders in
`packages/template-catalog/assets/`, with the `PROVENANCE.md` the privacy
guardrail requires. Placeholders are honest about what they are; the real art
budget is **open question C**.

### 8. The development bypass

A `LECTOEMOCION_UNLOCK_ALL` flag read through Vite's `import.meta.env`, so it
is statically eliminated from a production build. A test asserts the built
bundle contains neither the flag name nor the bypass branch — an assertion
about `dist/`, not about source, because that is where the guarantee has to
hold.

## Tasks

Each follows RED → GREEN → REFACTOR and ends green on `pnpm check`.

- [ ] **1. Slots in the schema.** `Slot`, `SlotRole`, `resolveSlot`, manifest
      v2 with `kind` and `slots`. Tests: a slot missing a default fails to
      compile (a `@ts-expect-error` fixture); `resolveSlot` prefers
      personalised, falls back to default, never returns undefined.
- [ ] **2. The world graph.** Schema, validator, and the authored graph.
      Tests: a node referencing an unknown unlock target fails validation; the
      graph has no cycles and exactly one entry node.
- [ ] **3. Unlock derivation.** `deriveUnlocks(world, progress)`. Tests: entry
      node unlocked from empty progress; completing a node unlocks its
      successors; a node with two prerequisites stays locked until both are
      done; derivation is pure.
- [ ] **4. Progress store.** `ProgressStore`, `LocalProgressStore`, validation
      on read. Tests: round-trip; corrupt JSON resets to empty; unknown
      resource ids in stored progress are dropped, not fatal.
- [ ] **5. Default-content resources.** One cinematic, one minigame, one
      non-interactive, each fully playable with zero personalised slots.
      Tests: every slot of every catalogue resource has a default; manifests
      validate.
- [ ] **6. Map hub.** `MapView` computation in the shell, Phaser map scene,
      node selection routing into the player. Tests: locked nodes are not
      selectable; completing a resource updates the map without a reload.
- [ ] **7. Non-interactive resource kind.** Renderer path for a fixed timeline
      with slot content placed into it. Tests: it plays to completion and
      exposes no export, download, or share affordance.
- [ ] **8. The bypass flag.** Guarded unlock-all, plus the `dist/` assertion.
- [ ] **9. End to end.** Playwright, all three viewport projects: open world →
      play chapter → minigame unlocks → replay → non-interactive resource →
      reload → progress intact.
- [ ] **10. Guardrail: templates cannot reach progress.** Invariant 2 says
      templates never touch progress state, and nothing checks it today. Add
      the rule to `scripts/rules.mjs` with its test in `scripts/rules.test.ts`,
      per the "add an invariant, add its check" contract.

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

## Open questions

**A. Does manifest v1 survive?** Invariant 5 makes published versions
immutable, and `publishedVersions.test.ts` pins v1's exact output. But nothing
is published: there is no backend, no stored manifest, and no user who can hold
one. *Recommendation:* define "published" as **reachable by a user**, delete v1
outright, and ship v2 as the only version — recording that definition in an ADR
and updating the invariant, its test, and the documentation together. The
alternative is carrying a dead version and a dual-version player from the
product's first month. This needs an explicit decision, not a quiet one.

**B. Whose progress is it, before accounts exist?** Progress belongs to the
account (§6.2), and there are no accounts until stage 4. *Recommendation:* a
single implicit local profile keyed by a constant, with the store interface
already shaped to take an owner so stage 4 adds the key without a migration.
Confirm no per-child progress is wanted in stage 3.

**C. Who produces the default art and audio?** Every slot needs
product-authored content, and §6.4 calls this a standing production cost. Stage
3 can ship on geometric placeholders, but the world will look like a prototype
until real assets land. Is that acceptable for the 9a default-content pilot, or
does the pilot need finished art — in which case the asset work should start
in parallel now rather than after stage 3?
