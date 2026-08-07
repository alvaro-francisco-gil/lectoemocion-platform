# The book of animals

## Status

- **Updated:** 2026-08-07
- **Stage:** built and verified; not yet merged
- **Branch:** `feat/animal-book`, worktree `.worktrees/animal-book`
- **Done:** all of it. One animal per chapter with the distinctness rule and its
  tests; the ten authored animals; `CollectionSlotView` carrying its animal and
  `earned`; three chests over one animal; the book as a modal over the world,
  one page, silhouettes for what is owed; the stamp, opening and closing itself.
  `pnpm check` passes (1012 tests) and `pnpm test:e2e` passes bar one
  pre-existing flake — see below.
- **Next:** merge to `main`, then distil this into a decision record and delete
  the file.
- **Blockers:** none.

**Pre-existing flake, not from this work:** "the letters game is won by dragging
each letter into its slot" times out at `classroom-hd` and `classroom-4k` under
full-suite load, and passes in isolation in 7.6s. It fails identically at
`2445482`, before any of this branch, so it is untouched by these changes and
wants a scoped fix of its own.

## Goal

The collection stops being a grid of tiles and becomes a book: one sheet of
paper, one place per chapter, and the animal printed straight onto the page.
A place a child has not reached yet is not an empty square — it is the shadow of
the exact animal waiting there, pressed into the paper.

Winning an animal stamps it into its place. The book opens itself to show that
happening and closes itself afterwards; nothing is asked of the child.

## Why the current screen is wrong

Three things about `CollectionScreen` fight the idea of a collection.

- **The animals are cards.** Every slot draws a bordered, rounded, tinted
  square, so a row of animals reads as a row of user-interface controls. Nothing
  in it is a button, which makes the control-shaped frames pure noise.
- **An empty place is a `?` in a dashed box.** It says something is missing but
  not what, so it promises nothing in particular. A silhouette promises a
  specific animal.
- **It replaces the world.** Opening the collection unmounts the map, so a look
  at what you have costs a screen transition in both directions.

## One animal per chapter

The three chests become theatre. Each chapter grants one animal, and whichever
chest a child opens hands over that same animal.

This is what makes the shadow honest. With three candidates, a silhouette either
shows an animal the child may never get or has to fan three shapes into one
place. With one, the shadow on the page is exactly the animal that will land
there, from the first screen a child ever sees.

### `packages/resource-schema/src/worldSchema.ts`

```ts
NodeRewardSchema = Type.Object({ animal: CollectibleAnimalSchema })
```

replacing `choices: Type.Array(CollectibleAnimalSchema, { minItems: 3, maxItems: 3 })`.

The validation at the bottom of the file changes with it. "Three chests must
hold three different animals" no longer means anything; the rule the book needs
instead is **no two chapters grant the same animal**, because a book showing the
same badge in two places is a book that cannot be completed and does not look
like it was authored.

### `packages/template-catalog/src/world/index.ts`

Each chapter keeps the first of its current three, which leaves ten distinct
animals: gato, gallo, koala, mariposa, delfín, caballo, tigre, zorro, búho,
pingüino.

### Saved profiles need no migration

A profile holding `perro` for `encuentro` already resolves to nothing under
`earned()`, which puts that chapter back in the chest queue and hands the reward
out again. That recovery exists, is documented, and covers this exactly: stored
client state outlives a content update, and the honest repair is to award again
rather than to leave a hole in the page.

### The chest screen

`Chests` stops mapping over `reward.choices` and renders a fixed `CHEST_COUNT`
of three, each calling `onOpen` with the chapter's one animal. Three is a
presentation constant in the shell, which is where it now belongs: how many
chests the duende offers is a question about the ceremony, not about the world.

## The book

### It is a modal, not a screen

`collectionOpen` leaves the exclusive-screen sequence in `App` and becomes an
overlay rendered above the world, which stays mounted behind a scrim. A child
looking at what they have collected has not gone anywhere, and closing it costs
no transition back.

It keeps everything the screen already had: `role="dialog"`, `aria-modal`,
Escape to close, and the accessible name *Mis animales*. It gains what an
overlay needs and a replaced screen did not — focus moves into the dialog on
open, is held there while it is up, and returns to the paw button on close.

### One page, no scrolling

Ten places in a 5×2 grid on a single sheet. No pagination, no scroll container.
The badge size is derived from the modal box, so the page fits whatever screen
it is on — a phone in the native shell and a classroom 4K panel alike.

An eleventh chapter shrinks the badges rather than growing a scrollbar. That is
the accepted limit of this design, not an oversight: the whole point is that a
child sees the entire collection at once. When the world grows past what stays
legible, the answer is page turns, and that is a change to make then with the
real number in hand.

### The badge

Every place always holds its chapter's artwork. What changes is whether it has
colour:

| | drawn as |
|---|---|
| not collected | the artwork with `filter: brightness(0) saturate(0)` at low opacity — an ink shadow of that exact animal |
| collected | the artwork in full colour, with a drop shadow lifting it off the page |

Same picture, same place, same size in both states, so stamping one moves
nothing on the page. Behind each sits a circular well drawn with an inset
shadow, which is the only frame there is — no card, no border, no tile.

The silhouette works because the vocabulary artwork is transparent RGBA, which
`apps/player-web/public/vocabulary/PROVENANCE.md` already requires and
`scripts/lib/remove-white-background.mjs` already produces. What changes is that
it becomes load-bearing: artwork that slipped through with an opaque background
would draw a black rectangle on the page rather than an animal, which is exactly
the shape this design set out to remove.

Names stay undrawn and spoken, as they are today — a visually hidden label per
place, and "todavía no" for one still owed.

### The view change

`CollectionSlotView` becomes:

```ts
{ nodeId: string; title: string; animal: CollectibleAnimal; earned: boolean }
```

The animal is no longer nullable, because the page needs the artwork whether or
not it has been won. `earned` is the only thing the renderer branches on, and
`deriveWorldView` stays the one place that decides it.

## The stamp

When the child taps *Seguir* on the reveal, the book opens itself. The animal
arrives from where the reveal left it — large, off to one side, tilted — travels
to its place, holds above it for a beat, and comes down hard: a squash past its
final size, a small counter-bounce, and a gold ring puffing outward from the
impact. Roughly 0.95s. Then the book holds about a second, long enough to see
the animal sitting in the page among the others, and closes itself.

The pause before the hit is the point. Without it the animal lands; with it, it
is stamped, which is what the page is for.

Nothing is tapped in any of this. A three-year-old at the end of a chapter has
already made every choice the ceremony asks for.

Under `prefers-reduced-motion` the book still opens and closes on the same
timing and the animal is simply already in its place, matching how the other
ceremonies reduce.

This needs one piece of state in `App`: the node just stamped, set when the
reveal is acknowledged and cleared when the book closes itself. It drives both
the auto-open and which place animates.

## Testing

RED → GREEN → REFACTOR, at the smallest boundary that proves the behaviour.

- **`packages/template-catalog/src/world/world.test.ts`** — where every other
  `parseWorld` rule is proved: a world granting the same animal in two chapters
  is rejected, a node reward parses to one animal, and the ten authored animals
  are distinct.
- **`worldView.test.ts`** — every slot carries its chapter's animal, with
  `earned: false` before the chest and `true` after; a stored animal the chapter
  no longer grants still returns the chapter to the chest queue.
- **`App.test.tsx`** — the paw opens the book without unmounting the world;
  Escape closes it and returns focus to the paw; every chapter has a place
  before anything is won; opening a chest hands over the chapter's animal
  whichever chest is tapped; after the reveal the book opens and then closes
  without a tap.
- **`e2e`** — the existing player sweep, since this touches the player.

Verification is `pnpm check` plus `pnpm test:e2e`.

## What this change also does

- Deletes the `?` empty-slot styling and the tile borders from `styles.css`.
- Records the durable rationale in a decision record once shipped: why the
  chests became theatre, and why the book shows what is owed rather than that
  something is owed.

## Open question

**Whether the book stays one page as the world grows.** Ten chapters fit
comfortably; the plan for chapter eleven and beyond is deliberately deferred
until the count is real.
