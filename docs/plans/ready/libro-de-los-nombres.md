# El libro de los nombres

## Goal

A book of the class's own names. Its pages are letters, turned one at a time in
Spanish alphabetical order, and each page carries the children whose verified
initial is that letter: their photo, their name written out, and their
pronunciation recording, played when a child taps the face.

It is the first resource whose content **is** the roster. With no children
recorded there is no book, so the chapter stands on the shelf visibly locked,
with an adult-facing reason, rather than opening onto nothing.

## Context

### What this decides, and what it costs

`AGENTS.md` and `docs/product/platform-design.md` both state that every template
ships with product-authored default content and is playable with no uploads —
"personalisation is an enhancement, never a prerequisite". Every node in the
world today honours that: `createResourceForNode` takes an optional roster that
defaults to `[]`, and nothing in the player has ever passed one.

This template is the declared exception, and the exception is the point. A book
of default names would be a book of invented children, which is the opposite of
what makes this worth building. Both documents are amended in the same change to
name the exception and say why, so the next reader finds a decision rather than
a contradiction.

The rule that does **not** bend is invariant 6. Missing *personalised* media
falls back to default content; here there is no default to fall back to, so the
absence of a roster is not a fallback case at all — it is a gate, resolved
before the resource is ever built.

### The seam that is being built in parallel

Photo and recording capture is separate, concurrent work. This plan consumes
`ChildRecord` and nothing narrower, so when capture lands the book needs no
change: the same four fields arrive with real assets behind them instead of
synthetic ones.

There is one thing to repair on the way.
[`slots.ts`](../../../packages/template-catalog/src/slots.ts) builds
`/synthetic/{assetId}.svg` and `/synthetic/{assetId}.mp3`, and
`apps/player-web/public/synthetic/` **does not exist**. Those URLs have always
404ed; nothing noticed because no roster was ever passed. This plan makes them
load-bearing, so it creates the assets and pulls the two URL expressions into a
single function — the one place the capture work replaces.

## The shape

### A page's names are `PersonalisedCharacter`

`PersonalisedCharacter` in
[`participantSlot.ts`](../../../packages/resource-schema/src/participantSlot.ts)
is already exactly a name on a page: `childRecordId`, `displayName`,
`verifiedInitial`, `photoUrl`, `pronunciationUrl`. It is reused rather than
redeclared, so there is one description of "a child as a template sees them".

`ParticipantSlot` is deliberately **not** reused. A slot pairs personalised
content with a required default, and this template has no defaults — a slot here
would carry an invented child as the thing a real one overrides.

### The manifest

In `packages/resource-schema/src/nameBookPage.ts`, beside `storyPage.ts`:

```ts
export const NameBookPageSchema = Type.Object(
  {
    pageId: Type.String({ minLength: 1 }),
    /** One letter or a digraph, as `verifiedInitial` is: `A`, but also `CH`. */
    grapheme: Type.String({ minLength: 1, maxLength: 2 }),
    names: Type.Array(PersonalisedCharacterSchema, { minItems: 1, maxItems: 30 })
  },
  { additionalProperties: false }
);
```

`minItems: 1` is the design decision made unrepresentable: the book has a page
only for letters somebody's name begins with, so "an empty letter page" cannot
be written down and then filtered out later by code somebody has to remember to
write.

The manifest branch joins the union in `resourceManifest.ts`:

```ts
export const NameBookManifestSchema = Type.Object(
  {
    ...envelope,
    template: Type.Object(
      { id: Type.Literal("name-book"), version: Type.Literal(1) },
      { additionalProperties: false }
    ),
    pages: Type.Array(NameBookPageSchema, { minItems: 1, maxItems: 27 })
  },
  { additionalProperties: false }
);
```

Twenty-seven is the Spanish alphabet, and it is the most pages this book can
have however large the class grows.

`TEMPLATE_KINDS` gains `"name-book": "cinematic"`. The record is total over
`TemplateIdentifier`, so this is a compile error until it is declared.

### Building it

`packages/template-catalog/src/nameBook.ts`:

```ts
export function createNameBookResource(
  roster: readonly ChildRecord[],
  seed: string
): ManifestFor<"name-book">
```

- Groups by `verifiedInitial` — the letter an adult confirmed, **never** one
  derived from spelling. `deriveInitial` exists for names typed without a
  verification step; a book that teaches a child their own letter must not
  guess it.
- Orders pages by grapheme and names within a page by `displayName`, both
  through one `Intl.Collator("es")`. That places `Ñ` after `N` and folds
  accents without a second alphabet being declared anywhere in the repo.
- `pageId` is the grapheme lowercased, so it is stable across roster changes.
- An empty roster **throws**. The gate means it is unreachable; the throw is
  what proves the gate is the only way in.

### The world node

```ts
{
  id: "libro-nombres",
  title: "El libro de los nombres",
  icon: picture("corazon"),
  surface: "recursos",
  unlockedBy: [],
  resource: { template: "name-book", seed: "libro-nombres" },
  reward: {
    choices: [animal("llama", "Llama"), animal("burro", "Burro"), animal("pajaro", "Pájaro")]
  }
}
```

On the shelf beside `El gallo Rayo`, for the same reason: it is a book, and a
book nobody can reach is a book nobody opens. `unlockedBy` is empty — nothing
about the roster belongs in a graph of chapter prerequisites.

## The gate

In `packages/template-sdk/src/templateDefinition.ts`, beside `TEMPLATE_KINDS`:

```ts
export const TEMPLATES_NEEDING_ROSTER: Record<TemplateIdentifier, boolean>
export function templateNeedsRoster(id: TemplateIdentifier): boolean
```

Total over `TemplateIdentifier` for the same reason as `TEMPLATE_KINDS`: a new
template cannot silently inherit "plays on defaults" without somebody deciding
it does.

`NodeState` in
[`worldView.ts`](../../../apps/player-web/src/world/worldView.ts) gains a fourth
member, `"needs-roster"`, and `buildWorldView` is given whether a roster exists.
The state is derived, never stored, exactly as unlock state already is.

`"needs-roster"` is a distinct state rather than reusing `"locked"` because the
two say different things to the adult standing next to the child: one is *not
yet*, the other is *this needs you*. `NodeState` is switched over with
`assertNever`, so every rendering site is forced to answer the new case.

On screen the chapter renders with its lock and the line **«Añade los nombres y
las fotos de los niños para abrir este libro»**. Until capture exists, tapping
shows that message and nothing else; the message is the seam, and it becomes a
link to the adult screen in the change that adds one.

## The screen

`apps/player-web/src/game/templates/renderNameBook.ts`.

A large grapheme, and beneath it a grid of cards — photo above, name written
below. Tapping a card enlarges it and plays that child's recording. Nothing
plays on its own and no page turns itself: this is a book to linger on, unlike
`El gallo Rayo`, which is paced by its narration.

Page turns are the back/forward pills. The picker is a grid of **letters**
rather than page labels. A progress bar runs along the bottom. Reaching the last
page completes the chapter once, `completed` guarding the replay, exactly as the
story does.

### Shared chrome

`renderIllustratedStory.ts` is 451 lines, and the pills, the progress bar, the
picker overlay and the curtain are all page-turning-book furniture rather than
illustrated-story furniture. They move to
`apps/player-web/src/game/templates/bookChrome.ts` and both books use them.

This is an extraction limited to what the second book needs, not a rewrite of
the story renderer.

### One hazard in `ResourceScene.preload`

It currently reads:

```ts
if ("pages" in resource) queueStoryPictures(this, resource.pages);
```

The name book also has `pages`, of an entirely different shape. TypeScript will
narrow the union on `in` and refuse to compile, which is the correct outcome —
the fix is to dispatch asset queuing on `resource.template.id` rather than on
the presence of a field two templates share. The book's photos are queued the
same way story pictures are: with the scene, so a page turn never waits on one.

### A photo that does not arrive

`ResourceScene` treats a missing picture as fail-closed, because every picture
it has ever queued was *default* content. A child's photo is not: it is
personalised media, invariant 6's one declared exception. One 404 must not blank
a book that is otherwise complete.

So the book's photos are queued outside that count, and a name whose photo is
missing renders as a card carrying the written name alone. The recording still
plays. Nothing about the page is silently dropped — the child is on the page
either way, which is the whole point of the book.

A missing *recording* is the same case: the card enlarges and shows the name,
and no voice plays.

## Synthetic children

`scripts/generate-synthetic-cast.mjs`, joining the importers already in
`scripts/`. It writes `apps/player-web/public/synthetic/`:

- `avatar-{id}.svg` — generated geometric avatars, no photograph of anybody.
- `silent-{id}.mp3` — a short silent track, so the audio path is exercised
  end to end without a recording of a real voice existing anywhere.

Committed output and a `PROVENANCE.md` recording that every file is generated,
matching what the avatar and vocabulary importers do.

`syntheticClass` grows from four children over three letters to roughly twenty
spread across the alphabet, including `Ñ`, an accented name, and one letter
carrying several children, so the book has a real spine to test against. The
names are invented; `AGENTS.md` forbids real child data anywhere, and this
fixture is the reason that rule is written down.

### It is development-only

`App.tsx` passes `syntheticClass` when `import.meta.env.DEV` is true and an
empty roster otherwise. A production build therefore shows the chapter in its
`"needs-roster"` state until real capture lands. No invented child can reach a
school, and the locked state is the one a pilot deployment actually sees.

The single expression that decides this lives in one named function with the
reasoning beside it, not inlined at a call site.

## Tests

Written before the code they describe.

Unit, in `packages/`:

- pages come out in Spanish alphabetical order, with `Ñ` after `N`;
- an accented name sorts under its unaccented letter and keeps its accent on
  screen;
- names within a page are ordered, and a letter with several children yields
  one page holding all of them;
- grouping uses `verifiedInitial` and not the first character of the name —
  the regression that matters most, because a child whose verified letter
  differs from their spelling is exactly who this book is for;
- an empty roster fails closed;
- a page with no names is rejected by the schema;
- the manifest round-trips through `parseResourceManifest`;
- `name-book` version 1 is registered in `publishedVersions.test.ts`
  (invariant 5);
- the world parses with the new node, and `templateNeedsRoster("name-book")`
  is true.

Component, in `App.test.tsx`:

- with no roster the chapter renders in `"needs-roster"` and is not playable;
- with a roster it opens, and the first page is the first letter in order;
- a name whose photo fails to load still appears on its page, and the book
  does not fail closed around it.

Then `pnpm check`, and `pnpm test:e2e` because the player changed.

## Not in scope

- Photo and recording capture, and the adult screens for it. Concurrent work;
  this plan consumes `ChildRecord` and waits.
- Firebase. Nothing here reads or writes anything remote.
- Per-child progress or profiles — see
  [`child-profiles.md`](child-profiles.md), which is independent of this.
- Letters with no child. The book has no page for them, by design.

## After it ships

The durable rationale — that one template is allowed to require personalisation,
and why — belongs in `docs/decisions/` as an ADR, and this plan is deleted.
