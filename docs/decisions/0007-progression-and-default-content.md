# ADR 0007: Progression and default content

Date: 2026-08-05  
Status: Accepted

Distilled from the world-progression plan, which shipped and was verified on
2026-08-05 (roadmap stage 3).

## Context

Two templates could not play without a roster. Every resource is supposed to
ship playable with product-authored content, with personalisation as an
overlay, and the code had that dependency the wrong way round. The world that
sequences resources did not exist at all.

Both problems are structural rather than incidental, so both are solved with
types and boundaries rather than with rules a reviewer has to remember.

## Decision

### A slot and its default are one object

`ParticipantSlotSchema` makes `default` required and `personalised` optional.
There is no `Slot` type without a default anywhere in the type space, so no
constructor, catalogue entry, or fixture can produce one — it is a compile
error at every construction site.

`resolveSlot(slot): Character` returns content, never optional content. That
signature *is* invariant 6's declared exception: the personalised-media
fallback cannot be forgotten because no code path yields nothing.

`personalised` carries `childRecordId`, so deleting a child record can find and
strip the overlay and leave the default underneath. Deletion restores default
content rather than removing a participant.

### Personalisation never changes a resource's shape

A resource has as many slots as the product authored defaults for. A longer
roster does not fit; a shorter one leaves the remaining slots on defaults. The
alternative — a resource whose size depends on the class — makes every layout,
every timing, and every published version depend on data we do not control.

### The world is authored data with a dispatcher

A node names a template and its parameters. It never holds a function, so
content stays inert and engine-neutral. `createResourceForNode` is the one
place that builds manifests, ending in `assertNever` so adding a template
without teaching it to build is a compile error rather than a blank scene.

The graph is validated for shape, duplicate ids, unknown unlock targets, a
missing entry node, and unreachability. Reachability doubles as the cycle
check: a node in a cycle can never have its prerequisites met.

### Unlock state is derived, never stored

Storage holds completions and nothing else. Unlocked-ness is computed from the
graph on every read.

Storing it would mean migrating every saved profile whenever a content update
changed the graph — and content updates change the graph. For the same reason,
stored ids the world no longer contains are ignored rather than fatal: a
removed node must not brick a profile.

### Progress belongs to the shell, and templates get a callback

Templates receive a manifest and a completion callback. The map scene receives
a `MapView` and a selection callback. Neither ever sees `Progress`, and neither
can tell whether anything is listening.

That is what keeps invariant 2 true while the world still learns what was
played, and `scripts/check-progress-boundary.mjs` enforces it — a template or
shared package importing progression fails the gate.

`ProgressStore` is async and takes an owner from the start, so stage 4 swaps
Firestore in behind it without changing a caller.

### Stored client state is untrusted input

Corrupt JSON, a wrong shape, or entries of the wrong type degrade to what is
recognisable rather than throwing, and a storage backend that denies access
still plays — it just does not persist.

This is not a silent fallback around a broken invariant. A browser, a content
update, or another tab can corrupt this state, and the honest response is to
start the world again rather than lock a child out of it.

### The bypass is asserted against the build

Adults cannot skip ahead. Development, testing, demos, and support still need
an override, so it lives behind a build-time flag that is statically
eliminated, and the test asserts against `dist/`.

That distinction earned itself immediately: writing the flag as
`import.meta.env["VITE_…"]` — the only form `noPropertyAccessFromIndexSignature`
permits without a declaration — defeats Vite's replacement and leaves a runtime
lookup in the bundle. Source review would have passed it. A second test builds
*with* the flag and asserts the output differs, so "absent" cannot pass for the
wrong reason.

## Rejected alternatives

**Storing unlock state alongside completions.** Cheaper to read, and wrong the
first time content changes: every existing profile needs a migration, forever.

**Letting the map read the progress store directly.** One fewer indirection,
and it makes the map a template that reads progress — the exact thing invariant
2 forbids. The `MapView` boundary is what keeps the renderer free of any
opinion about progression.

**Guarding the bypass in source only.** A reviewer can see a correct guard and
still ship a bundle that reads the flag at runtime. This was not hypothetical.

## Consequences

- Every resource in the catalogue plays with no personalised content present.
- Stage 4 replaces `LocalProgressStore` and supplies a real owner id; no other
  caller changes.
- Adding a template requires: a schema branch, a kind in `TEMPLATE_KINDS`, a
  dispatcher case, and a renderer. Three of those four are compile errors if
  forgotten.
- Content updates may reshape the graph freely without touching saved state.

## Revisit when

- Per-child progress within an account is wanted. The store takes an owner, so
  this is a key change rather than a redesign — but `Progress` itself would
  need to become per-profile.
- A template needs more slots than the default cast provides, which would make
  the cast per-template rather than global.
