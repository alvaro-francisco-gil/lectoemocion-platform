# Child profiles

## Goal

The map's hamburger becomes a child's avatar, moves to the top-left corner, and
opens a drawer naming who is playing. From there an adult can add another child,
edit one, or delete one; a child can switch between them unaided. The star
counter moves to the right corner to make room.

Profiles are local to the device. Nothing here talks to Firebase, and nothing
here is a prerequisite for playing.

## Context

The player has no idea who is playing it. `LocalProgressStore` is constructed
with `LOCAL_OWNER`, the string `"local"`, and
[`progressStore.ts`](../../../apps/player-web/src/world/progressStore.ts)
already says why that parameter exists: "today it is one implicit local profile,
and it becomes an account id when accounts exist". Per-owner isolation is
already proven by its tests. This work fills that seam in.

The menu screen it fills is likewise reserved rather than absent.
[`App.tsx`](../../../apps/player-web/src/app/App.tsx) describes it as "the place
the app's own settings will live", and it renders nothing but a close button.

### What this decides

`docs/product/platform-design.md` currently states that progress belongs to the
account and that **per-child profiles within a single account are not
supported**, and lists whether to add them as an open question. This work
answers that question yes, for the local case, and both passages are rewritten
in the same change. The account-level reading is not contradicted so much as
deferred: when accounts arrive, a profile becomes a child record under a group,
and the store behind this UI is swapped without the UI changing.

## The record

A new domain record, in `packages/domain`, because the Firebase work will need
the same shape and a second declaration of it would violate the single-source
rule:

```ts
export interface PlayerProfile {
  readonly id: PlayerProfileId;
  readonly name: string;
  readonly avatarId: AvatarId;
  readonly birth: Birth;
}

export type Birth =
  | { readonly known: true; readonly month: Month; readonly year: number }
  | { readonly known: false };
```

`PlayerProfileId` and `AvatarId` are branded, with constructors, alongside the
existing ids. `Month` is a union of the twelve literals `1 | 2 | ... | 12`, so a
month of 13 is a compile error rather than a validation rule.

`Birth` is a union rather than an optional field for a reason that is not
stylistic. The starter profile is created automatically from progress that
already exists, and the app cannot know that child's birth date; a required
field would be a lie and an optional one would push a null check into every
site that renders a row. The union has exactly two renderings — an age, or an
invitation to supply one — and the compiler demands both.

Age is a pure `ageInYears(birth: Birth, today: Date): number | null`. Components
never read the clock.

`ChildRecord` in `packages/domain` is untouched. It is the roster record that
template participant selection consumes, it requires a photo asset and a
pronunciation asset that a local profile has neither of, and conflating the two
would make both worse.

## Storage, and why there is no migration

`apps/player-web/src/profiles/profileStore.ts`, shaped like the progress store
beside it: a `lectoemocion.profiles` key, validated on read, an interface narrow
enough that a Firestore-backed implementation can replace it later.

**The starter profile takes the id `local`.** That is the existing
`LOCAL_OWNER` string, so its progress key is `lectoemocion.progress.local` —
the key already on every device that has ever run the player. Existing stars are
therefore adopted by construction: there is no copy step, no migration code, and
no window in which a family's progress exists in two places or neither. Every
profile created afterwards gets a fresh id and its own namespace.

The starter profile is created on first read of an empty store, named
**Peque**, with the first avatar in the catalogue and `{ known: false }`. Play
is never blocked on it, and an adult can rename it whenever they like. This is the product's rule that
personalisation is an enhancement and never a prerequisite, applied to
profiles.

A malformed store raises an adult-facing error. It does not reset to empty:
invariant 6 forbids the silent fallback, and quietly discarding a family's
profiles is the worst version of it.

Profiles are capped at eight, which bounds the drawer without needing to scroll
on a phone.

## The adult gate

`Add`, `Edit` and `Delete` sit behind a written-word arithmetic challenge —
*"¿Cuánto es siete más cuatro?"* — answered on a number pad. The words are
spelled out rather than written as digits because a five-year-old who can count
still cannot read `siete`.

Switching profile is **not** gated. A child choosing their own face is the
reason the avatar is in the corner at all, and the worst outcome of a wrong
choice is a wrong name on screen until someone taps again.

The question and its answer come from a pure seeded function, so the gate is
unit-tested without a DOM.

Delete lives inside the edit sheet rather than on the row, so it cannot be
reached without already having passed the gate, and it asks for a second
confirmation naming the child. Local storage has no undo: once a profile and its
progress are gone they are gone, and the confirmation is the only thing standing
between a mistap and a lost year of stars. The last remaining profile cannot be
deleted; the store always holds at least one.

## What changes on screen

The corners swap. `.star-counter` moves to the right, and a new
`.profile-button` — the same 56px disc as the control it replaces, with the
child's avatar inside — takes the left.

The rule recorded in `styles.css`, that what was won and what an adult can
change never share a corner, is preserved exactly. The two have traded sides,
not merged. Both comments are rewritten to say which corner now holds what and
why the avatar earns the more prominent one: the child's own face is the most
legible way for a pre-reader to know the app is theirs.

The menu becomes a **drawer over a dimmed map** rather than a screen that
replaces it. This reverses the decision recorded in `App.tsx`, which chose a
full screen because "a panel a child can tap through is a way to leave the world
by accident". That objection is about mis-taps, and a full-surface scrim answers
it directly — the scrim swallows every pointer event, so nothing under the
drawer is reachable. What the reversal buys is that the world stays visible: a
three-year-old can see the game is still there and they are coming right back.
The comment is rewritten to record this, so the next reader finds the reasoning
rather than an unexplained inconsistency.

The drawer traps focus, closes on Escape and on scrim tap, and keeps
`role="dialog"` with `aria-modal`.

Two rows — **Progreso** and **Zona de adultos** — are rendered visibly disabled.
Each gets a scoped document under `docs/plans/ideas/` in this change, so they
are planned work rather than debt parked in the interface.

### File layout

`App.tsx` is 690 lines and already carries the map, the menu, the award screen,
the chests, the collection and every icon. This change extracts
`src/profiles/` (record glue, store, avatar catalogue), `ProfileMenu.tsx` and
`AdultGate.tsx`, leaving `App.tsx` as a composition root. The extraction is
limited to what this feature touches.

## Avatars

Twelve animals from Microsoft's Fluent Emoji, 3D style, under the **MIT**
licence — permissive, and requiring no user-visible credit line.

`scripts/import-avatars.mjs` joins the three importers already in `scripts/`:
it fetches a fixed list once, resizes to 256×256 WebP through `sharp`, writes
`apps/player-web/public/avatars/`, and writes a `PROVENANCE.md` recording the
licence, the author, and **a source URL per file**. The vocabulary set's own
provenance document admits it cannot recover per-file origins; this one can, and
should.

Nothing is fetched from a third party at runtime. The import is a build-time
step whose output is committed, so no request ever leaves a child's device.

Animals: zorro, panda, gato, perro, león, rana, búho, pingüino, tortuga,
unicornio, koala, tigre.

## Tests

Written before the code they describe.

Unit:

- `ageInYears` across both `Birth` cases and a birthday boundary;
- store round-trip, and per-profile progress isolation;
- **the starter profile inherits pre-existing progress** — the regression that
  matters most, because the failure is silent and destroys a family's stars;
- a malformed store fails closed rather than resetting;
- deleting a profile removes its progress, and the last one cannot be deleted;
- the gate's question and answer agree.

Component, in `App.test.tsx`:

- the avatar opens the drawer, and the map stays mounted behind the scrim;
- switching profile changes the star count;
- `Añadir niño` is refused until the gate is passed;
- Escape and scrim tap close the drawer.

Then `pnpm check`, and `pnpm test:e2e` because the player changed.

## Not in scope

Firebase sync, progress reports, a parents area, the screen-time control in the
reference design, and any photo or recording upload.
