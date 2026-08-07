# ADR 0010: One template may require a roster

Date: 2026-08-07  
Status: Accepted

Distilled from the *El libro de los nombres* plan, which shipped and was
verified on 2026-08-07 (PR #3).

Amends [ADR 0007](0007-progression-and-default-content.md), which stated that
every resource in the catalogue plays with no personalised content present.

## Context

*El libro de los nombres* is a book of the class's own names: a letter to a
page, each carrying the children whose verified initial it is, with a
photo, the name written out, and the pronunciation played when a child taps the
face.

Every other template in the catalogue ships with product-authored default
content and plays with no uploads, and ADR 0007 built that into the type system
— `ParticipantSlotSchema` pairs personalised content with a *required* default,
so a slot without one is a compile error.

This template does not fit that shape, and forcing it to would have been the
wrong answer twice over. Given defaults it becomes a book of invented children,
which is precisely the opposite of what makes it worth opening: the whole
lesson is *these marks are somebody, most often you*. Given a roster overlaid
onto a fixed cast, its shape would still be the cast's rather than the class's.

Three options were live:

1. give it a default cast and let real children override slot by slot;
2. hide the chapter entirely until a roster exists;
3. let it require a roster, and show the chapter locked until there is one.

## Decision

**Exactly one template may require a roster, and it is declared, not inferred.**

`TEMPLATES_NEEDING_ROSTER` in `packages/template-sdk/src/templateDefinition.ts`
is a `Record<TemplateIdentifier, boolean>`, total over every template. Adding a
template fails to compile until somebody answers the question, in the open, in
a file a reviewer reads. Today exactly one entry is `true`.

The alternative — inferring the requirement from a manifest's shape, or from
whether a build threw — would make "this template needs child data" a property
discovered at runtime rather than a decision anybody made.

### It is a gate, not a fallback

Invariant 6's declared exception covers missing *personalised media*: it falls
back to default content and playback continues. There is no default here to
fall back to, so an empty roster is not that case at all.

`createNameBookResource` throws on an empty roster. The world resolves the gate
before the manifest is ever built, and the throw is what proves the gate is the
only way in — a test asserts both halves.

### `needs-roster` is a fourth node state

`NodeState` gains `needs-roster` beside `locked`, `unlocked`, and `completed`.
It is not a flavour of `locked`, because the two address different people:
`locked` says *not yet, keep playing* to a child, and `needs-roster` says *this
one needs you* to an adult. It is the only state in the world an adult can act
on, and collapsing the two would bury the one message worth reading.

The chapter therefore stands on the shelf carrying its reason —
«Añade los nombres y las fotos de los niños para abrir este libro» — rather
than hiding. An adult who cannot see the feature will never add the names it is
asking for. The message is written on the card rather than waiting behind a
tap, because the card cannot be tapped: what is missing is not something a
child can go and get, so nothing should invite them to try.

**The development unlock bypass does not open it.** That bypass answers "has
the child played enough"; whether a book of names has any names is a different
question with no answer available.

### A page cannot be empty, and the letter is the adult's

`NameBookPageSchema` requires at least one name per page, so "the book has a
page only for letters somebody is named after" is a type rather than a filter
somebody has to remember to write.

Pages are keyed on `verifiedInitial` — the letter an adult confirmed — and
never on the first character of the name. `Chema` is verified under `CH`;
deriving would file them under `C` and silently overrule that adult in the one
place a child is being taught their own letter.

Ordering, for pages and for names within a page, goes through a single
`Intl.Collator("es")`. It already knows `Ñ` follows `N` and that `Á` sorts under
`A` without losing its accent on screen. Writing the alphabet out as a list
would be a second answer to a settled question, and the first name it got wrong
would be a child's own.

### A missing photo does not fail the book closed

A child's photo is the only *personalised* asset the player loads, and
therefore the only one whose absence is invariant 6's exception rather than its
fail-closed rule. `ResourceScene` keeps those keys out of its fail-closed
count; a name whose photo is missing renders as a card with the written name
alone, and the recording still plays. One 404 must not blank a book that is
otherwise complete.

### One seam for a child's media

`packages/template-catalog/src/mediaUrl.ts` is the only place that turns a
`MediaAssetId` into a URL. `slots.ts` and `defaultCharacters.ts` both go
through it rather than building paths themselves.

This was not tidiness. `/synthetic/` did not exist and its URLs had always
404ed, unnoticed because no roster was ever passed; this template made them
load-bearing. Photo and recording capture, being built in parallel, replaces
that one file and nothing else.

### The stand-in roster is development-only

`rosterForBuild(isDevelopment)` returns twenty synthetic children in
development and nothing in production, as one named pure function with the
reasoning beside it. Twenty invented children shown to a school as if they were
its pupils is a worse failure than a chapter that says it needs names.

Their media is generated by `scripts/generate-synthetic-cast.mjs` — geometric
avatars that are deliberately not faces, and MPEG frames of silence — so no
photograph or recording of a real person can enter the repository even by
accident. A test holds the generator and the fixture together, because the
drift would otherwise surface as a photo that silently fails to load, which is
exactly the failure this book is designed to survive and therefore the one
nobody would notice.

## Rejected alternatives

**A default cast this template overrides.** The shape ADR 0007 chose, and it
makes the book a book of invented children. It would also have been the most
expensive kind of wrong: it plays, it looks finished, and it teaches nothing.

**Hiding the chapter until a roster exists.** Simplest for the child, and it
leaves the adult with no way to discover the feature that would fill it. A
locked chapter carrying its reason is the only version that asks for what it
needs.

**Inferring the requirement rather than declaring it.** A `catch` around
`createResourceForNode`, or a check on whether a manifest came out empty, would
have worked and left no record that anybody had decided anything.

## Consequences

- ADR 0007's "every resource in the catalogue plays with no personalised
  content present" now has exactly one exception, declared in
  `TEMPLATES_NEEDING_ROSTER`.
- Adding a template now requires a schema branch, a kind in `TEMPLATE_KINDS`,
  an entry in `TEMPLATES_NEEDING_ROSTER`, a dispatcher case, and a renderer.
  Four of those five are compile errors if forgotten.
- An institutional pilot sees this chapter locked, which is the correct state
  until that deployment's privacy artefacts exist. It is the only chapter whose
  availability tracks that paperwork.
- Photo and recording capture, when it lands, replaces `rosterForBuild` and
  `mediaUrl.ts`. The template consumes `ChildRecord` and cannot tell where the
  records came from, so nothing else changes.

## Revisit when

- A **second** template wants a roster. The record makes that a deliberate
  edit rather than a drift, but two is the point at which "the exception"
  stops being a useful description and the product rule itself should be
  rewritten.
- Groups grow past thirty children, which is the page cap the schema pins.
- A child belongs on more than one letter — a compound name, or a letter whose
  sound and spelling an adult wants taught separately. The schema currently
  gives each child exactly one page.
