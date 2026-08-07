# ADR 0008: One flat world, under three authored sections

Date: 2026-08-07  
Status: Accepted

## Context

The hub was a map: a scrolling path of circular chapter discs over an
illustrated backdrop, split into two regions — the farm and the forest — that a
child walked between through doors at the ends of the path. The animal
collection was pinned across the bottom edge.

Three things were wrong with it at this size.

The two places were a navigation a child had to learn before they could reach
half the chapters, and the walk they paid for it bought nothing: the regions
held no rule of their own, since what may be played was always `unlockedBy`,
node by node. A region was a backdrop with a door in front of it.

The circles wasted the illustration. A cut-out drawing inset into a disc is
mostly disc, and the picture is the only thing a child aged 3–5 navigates by.

And the bottom band — the one place on a screen where a small child's hands
actually land — was spent on the collection, which is a record rather than a
destination.

## Decision

**The world is a flat list of chapters.** `regions` left `WorldSchema`; `World`
is `{ nodes: WorldNode[] }` and `worldNodes` returns that list. `WorldRegion`,
`RegionDoor`, `MapRegionView`, the `--map-scene` custom property and the two
backdrop pictures are deleted, not deprecated. The hub's background is a flat
colour.

**A node says which section it stands in.** `WorldNode.surface` is
`"juegos" | "recursos"`, authored, required, with no default.

It is not derived from `templateKind`. "A book belongs on the shelf" is a rule
that breaks the first time a game belongs there or a story belongs on the path,
and it breaks *silently* — the node simply appears under the wrong section.
Requiring the field with no default makes a chapter whose place nobody decided a
parse error rather than a chapter missing from both.

**Multijugador is a disabled button, not a third value.** The shell's `TabId`
union is `"juegos" | "recursos"`. A section that cannot be built is a state that
cannot be represented, rather than one rejected at runtime — the same reasoning
as `ParticipantSlotSchema` carrying its own default content.

**What a chapter is worth does not depend on the section it is in.** The story
on the shelf is open from the first screen — a book a child has to unlock is a
book most of them never open — but it still pays letriestrellas every read, still
offers its chests the first time, and still holds its slot in the collection.
Rewards belong to the world. `WorldView.collection` and
`WorldView.pendingReward` stay world-wide, so a chest owed for the story
interrupts whichever section the child is standing in.

**A chapter is a card.** 4:3, rounded, the picture `contain`ed on a saturated
colour field with the title on a chip over the bottom-left corner. `contain`,
not `cover`: the icons are cut-out illustrations, most of them taller than they
are wide, and covering a 4:3 rectangle cropped the rooster down to a patch of
yellow. The whole subject has to survive.

**The colour is a card's second landmark, and it lives in CSS.** Six tints
cycled by the card's position in the row, so no two neighbours ever match. It is
positional rather than authored because what colour a chapter is is not a fact
about the chapter — content stays engine-neutral, and the stylesheet keeps the
palette. On an 86-inch panel at classroom distance a bee and a butterfly are
both "small dark thing"; the colour is what carries the card across the room.

Nothing marks a chapter as finished on the card itself. A completed chapter
stays playable, so "finished" changes nothing a child can do with it, and the
connecting line already fills in behind them. A badge that ends up on every card
is a mark that has stopped meaning anything. The state is still spoken to a
screen reader, so nothing is carried by colour alone.

**The collection is a screen**, reached by a button in the bottom-right corner
on every section. The app's rule is unchanged and now covers one more case:
exactly one screen is on at a time — a playing resource, the stars, the reveal,
the chests, the menu, the collection, or a section.

## Consequences

The "walk between two places" idea the world schema was built around is retired.
That was a product decision, taken deliberately: one world, one scroll, and the
sections carry the only split there is.

`deriveMapView` became `deriveWorldView` and returns `games` and `resources`
instead of `regions`; `mapView.ts` became `worldView.ts`. There is no map.

`El bosque de parejas` and `¿Cuál es?` keep their titles. A forest that is no
longer a region can still be a thing a chapter is about.

Adding a third section later means adding a member to `WorldNode.surface` *and*
to `TabId`. The compiler will name every site that has to handle it, which is
the point of both being unions rather than strings.
