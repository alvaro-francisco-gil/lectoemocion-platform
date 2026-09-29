# ADR 0015: The animal book, and one animal per chapter

Date: 2026-09-30  
Status: Accepted

Distilled from the animal-book plan, which shipped and was verified on
2026-08-07.

## Context

The collection was a screen of tiles. Every animal sat in a bordered, tinted
card, so a row of animals read as a row of controls in a place where nothing is
a button. A place not yet reached was a `?` in a dashed box, which says that
something is missing but not what, and so promises nothing in particular.
Opening it unmounted the world, so a look at what you had cost a screen
transition in both directions.

Each chapter also offered three chests holding three different animals, so
which animal would ever fill a given place was not decided until a child chose.

## Decision

The collection is a book: one sheet of paper, one place per chapter, each
animal printed straight onto the page. A place not yet reached holds the shadow
of the exact animal waiting there. Winning an animal stamps it into its place;
the book opens itself to show that happening and closes itself afterwards.

### One animal per chapter; the chests are theatre

A chapter grants exactly one animal, and whichever chest a child opens hands
over that same animal. This is what makes the shadow honest. With three
candidates a silhouette either shows an animal the child may never get or fans
three shapes into one place; with one, the shadow on the page is exactly the
animal that will land there, from the first screen a child ever sees.

The three chests stay, because choosing one is the part of the ceremony a
child enjoys. How many are offered is a presentation constant in the shell,
not a property of the world: it is a question about the ceremony, and the
content no longer has an opinion on it.

**No two chapters grant the same animal**, enforced where every other world
rule is. A book showing the same animal in two places is a book that cannot
be completed and does not look authored.

### A content update re-awards; it never leaves a hole

Changing what a chapter grants — as this change itself did to every chapter —
leaves saved profiles holding a claim for an animal the chapter no longer
gives. That claim reads as unearned and the chapter is paid again, rather than
leaving a page nobody can fill. Stored client state outlives content, and
awarding again is the honest repair; there is no migration.

The claim therefore follows the content. One claim per chapter, naming the
animal the chapter grants now: a repeat claim naming the same animal is a
double tap and is idempotent, and one naming a different animal can only be a
content update. Treating any existing claim as final — which the first version
did — made the re-offer unpayable: the chest wrote nothing, the reward stayed
owed, and since the ceremony is derived from storage it became the first
screen of every visit with the world unreachable behind it.

### The book shows *what* is owed, not *that* something is

Every place always holds its chapter's artwork. Unearned, it is drawn as an ink
shadow of that animal; earned, in full colour. Same picture, same place, same
size in both states, so winning one changes its colour and nothing else, and a
child finds the animal they just won exactly where its shadow was.

This makes transparent artwork load-bearing. A picture that slipped through
with an opaque background draws a black rectangle on the page instead of an
animal — exactly the tile this design set out to remove.
[ADR 0014](0014-supplied-art-is-rendered-not-unwrapped.md) is where an opaque
result is refused at import.

Nothing on the page is chrome. The first version kept a circular well behind
each animal and a close cross in the corner; both went. A ring around a shadow
says what the shadow already says, and a grid of rings reads as slots rather
than a page. The way out is the world around the book: tapping outside it, or
Escape, closes it. A cross is a second thing to learn for a child who can
already point at what they want instead.

### The book is a layer over the world, not a screen

A child looking at what they have collected has not gone anywhere, and closing
it costs no transition back. It is one of the two layers
[ADR 0013](0013-child-profiles-and-the-drawer.md) allows over the world, on
the same terms as the drawer: a scrim takes the taps meant for the map.

Because the world stays mounted underneath, the book owns focus in a way a
replaced screen never had to: focus moves into the book on open and returns to
where it was on close, or a keyboard or screen reader wanders into a map
nobody can see.

### One page, no scrolling

The whole collection is seen in one look; that is the point of a book at this
age. The page has no pagination and no scroll container, and a growing world
changes the shape of the grid and shrinks the animals rather than growing a
scrollbar. The eleventh chapter, *El libro de los nombres*, arrived while this
was being built and proved the rule: a fixed column count added a row the
paper had no room for, so the shape is now decided from the chapter count in
one place and the stylesheet never counts.

### The stamp asks nothing of the child

After the reveal the book opens itself, the animal travels to its place, holds
above it for a beat, and comes down hard; then the book holds long enough to
see it among the others and closes. Nothing is tapped. A child at the end of a
chapter has already made every choice the ceremony asks for.

The pause before the hit is the point: without it the animal lands, with it
the animal is stamped. Under reduced motion the book still opens and closes on
the same timing and the animal is simply already in its place.

### It is `AnimalBook`, because "book" was taken

On `main`, *book* already meant the book of profiles on the device, and *El
libro de los nombres* is a chapter. One name means one thing, so the component
is `AnimalBook` and its classes are `.animal-book__*`. On screen it is *Mis
animales*.

## Rejected alternatives

- **Three candidates per chapter, fanned into one silhouette.** Honest about
  the choice, but a page of three-headed shadows promises no animal in
  particular — the failure of the `?` box, drawn more elaborately.
- **Keeping the collection as a screen.** One-screen-at-a-time is simpler, but
  every look costs two transitions and hides the world a child is about to go
  back to.
- **Pages or a scroll once the world grows.** Deferred rather than rejected:
  see below.

## Revisit when

- **The world outgrows one legible page.** The answer is page turns, designed
  with the real chapter count in hand, not a scrollbar.
- **A chapter's animal is changed again.** Nothing needs doing — the re-award
  above covers it — but a child will be asked to open a chest for a chapter
  they already finished, and that should be a deliberate content decision.
