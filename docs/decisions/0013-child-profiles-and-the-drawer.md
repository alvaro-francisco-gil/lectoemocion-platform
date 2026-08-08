# ADR 0013: Child profiles, and the drawer that names who is playing

Date: 2026-08-08  
Status: Accepted

Distilled from the child-profiles plan, which shipped and was verified on
2026-08-07, and from the corner and door changes that followed it on
2026-08-08.

## Context

The player had no idea who was playing it. `LocalProgressStore` was already
constructed with `LOCAL_OWNER`, the string `"local"`, and per-owner isolation
was already proven by its tests — the seam existed and nothing filled it. A
tablet shared by siblings kept one world between them.

`docs/product/platform-design.md` stated that progress belonged to the account
and that per-child profiles within one account were **not** supported, listing
whether to add them as an open question. This answers that question yes, for the
local case, and the account-level reading is deferred rather than contradicted.

## Decision

A device holds up to eight `PlayerProfile` records — a name, an avatar, and
optionally a birth month and year. Each has its own progress namespace. A
child's own face sits in the world's top-left corner and opens a drawer naming
who is playing; from there an adult adds, edits or deletes a child, and a child
switches between them unaided.

### The starter profile takes the id `local`, so there is no migration

`LOCAL_OWNER` is the string `"local"`, so the starter profile's progress key is
`lectoemocion.progress.local` — the key already on every device that has ever
run the player. Existing stars are adopted **by construction**: no copy step, no
migration code, and no window in which a family's progress exists in two places
or in neither. Every profile created afterwards gets a fresh id and its own
namespace.

The alternative — creating a profile with a new id and copying progress across —
is one bug away from a family losing a year of stars, and the failure would be
silent. The regression test that the starter profile inherits pre-existing
progress is the most valuable test in this area for the same reason.

A malformed store raises an adult-facing error rather than resetting to empty.
Invariant 6 forbids the silent fallback, and quietly discarding a family's
profiles is its worst form.

### `Birth` is a union, not an optional field

```ts
export type Birth =
  | { readonly known: true; readonly month: Month; readonly year: number }
  | { readonly known: false };
```

The starter profile is created automatically from progress that already exists,
and the app cannot know that child's birth date. A required field would be a
lie; an optional one would push a null check into every site that renders a row.
The union has exactly two renderings — an age, or an invitation to supply one —
and the compiler demands both. `Month` is the union of the twelve literals, so a
month of 13 is a compile error rather than a validation rule.

Age is a pure `ageInYears(birth, today)`. Components never read the clock.

`ChildRecord` is untouched. It is the roster record that template participant
selection consumes, it requires a photo and a pronunciation asset that a local
profile has neither of, and conflating the two would make both worse.

### The gate asks for a year of birth, and verifies nothing

Add, edit and delete sit behind a full-screen gate asking the adult's year of
birth on a large number pad. The app has never been told when any adult was born
and has nowhere to check, so the rule is plausibility: a year that would make
the person between 18 and 110. What defeats a preschooler is the *shape* of the
answer rather than its truth — four digits is beyond a child still learning
letters, their own year of birth is refused by construction, and under one per
cent of the ten thousand four-digit combinations a mashed pad could produce are
accepted.

It is not a security control and must not be mistaken for one. Hiding UI is
never authorization (invariant 4); this gate exists to stop the person sitting
in front of the device, who cannot read.

The gate takes the whole screen rather than sitting inside the panel that
summoned it, so it can be put in front of any feature: the caller says what
happens on the way through and nothing about how the asking looks.

**Switching profile is not gated.** A child choosing their own face is the
reason the avatar is in the corner at all, and the worst outcome of a wrong
choice is a wrong name on screen until someone taps again.

Delete lives inside the edit sheet rather than on the row, so it cannot be
reached without having already passed the gate, and it asks for a second
confirmation naming the child. Local storage has no undo. The last remaining
profile cannot be deleted; the store always holds at least one.

### The drawer is a layer over the world — the one exception to one-screen-at-a-time

This reverses an earlier decision recorded in `App.tsx`, which made the menu a
full screen because "a panel a child can tap through is a way to leave the world
by accident". That objection is about mis-taps, and a full-surface scrim answers
it directly: the scrim swallows every pointer event, and `select` refuses to
open a chapter while the drawer is up. Two mechanisms, because a stylesheet
alone is not a guarantee.

What the reversal buys is that the world stays visible. A three-year-old can see
the game is still there and that they are coming right back — which matters more
at that age than the rule it breaks.

The adult area is **not** a layer. It replaces the world outright, so there is
nothing underneath for a child to tap through while an adult is in it.

### The drawer is the only door to the adult area

The world briefly carried two adult controls in the same corner: the avatar, and
a hamburger under it that opened the prize settings. The hamburger is gone and
its row lives in the drawer, where it had already been announced as
"próximamente".

One door, and one keypad: the adult area carries `AdultGate` around itself, so
the drawer adds no gate of its own and there is no second place for that
decision to drift. `scripts/check-adult-gate.mjs` is what keeps the area
reachable only through it.

### The corners say what they are for

What was won and what an adult can change never share a corner. The avatar took
the left because a pre-reader's own face is the most legible label the app has,
and the letriestrella readout took the right.

That rule survived the readout being redrawn: the count sits top-right opposite
the face, and the ring closing on the gift sits bottom-left, clear of both the
avatar above it and the animals opposite. See
[ADR 0012](0012-prizes-and-the-star-meter.md) for what the meter itself says and
why it says it without a second number.

### Avatars are imported at build time, never fetched

Twelve animals from Microsoft's Fluent Emoji, 3D style, MIT-licensed —
permissive, and requiring no user-visible credit line.
`scripts/import-avatars.mjs` fetches a fixed list once, resizes to 256×256 WebP,
and writes a `PROVENANCE.md` recording the licence, the author, and **a source
URL per file**. The vocabulary set's own provenance document admits it cannot
recover per-file origins; this one can, and does.

Nothing is fetched from a third party at runtime, so no request ever leaves a
child's device.

## Rejected alternatives

- **One profile per device, as before.** Simplest, and wrong the moment two
  siblings share a tablet: one child's stars pay for the other's gift, and
  neither world is theirs.
- **Reusing `ChildRecord` for the local profile.** It is the roster record for
  participant selection and requires media a local profile does not have.
  Conflating them would force optional media into the roster type and invent
  fields the drawer has no way to fill.
- **A PIN or password on the gate.** A shared classroom panel has no one to
  hold the secret, and a PIN written on the whiteboard is worse than a
  plausibility check because it looks like security.
- **Copying progress into a freshly-minted starter profile id.** See above:
  every failure mode is silent and destroys stars.

## What this binds

- The profile id **is** the progress namespace. `LOCAL_OWNER` remains the
  starter profile's id; changing it orphans every existing device.
  `scripts/check-child-namespace.mjs` enforces that a namespace comes only from
  a profile id.
- Anything an adult may do to a profile goes behind `AdultGate`; switching does
  not.
- The drawer and the animal book are the only layers over the world. A third
  one needs its own argument.
- The adult area is entered from the drawer and nowhere else.

## Revisit when

- **Accounts arrive.** A profile becomes a child record under a group and the
  store behind the interface is replaced without the UI changing. See
  `docs/plans/ready/backend-and-adult-auth.md`, which supersedes this for the
  hosted case.
- **Deleting a child has to take everything of theirs.** `LocalProfileStore`
  removes `storageKey(id)`; the gifts and prize pictures owed by
  [ADR 0012](0012-prizes-and-the-star-meter.md) are still outstanding.
- **The gate needs to resist more than a curious child.** That is a different
  problem, belongs with real accounts and identity, and must not turn this gate
  into something it explicitly is not.
- **The eight-profile cap stops fitting.** It exists to bound the drawer without
  scrolling on a phone, not because eight is a fact about families.
