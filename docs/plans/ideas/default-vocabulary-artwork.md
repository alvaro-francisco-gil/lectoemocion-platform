# Default vocabulary artwork

## Problem

`pairs-game`, `word-picture-game`, and `syllables-game` are playable, but their
pictures are deterministic geometric glyphs. A child matching `casa` to a
coloured polygon is exercising the mechanic, not the vocabulary, so these
templates do not yet teach what
[minigame-specifications.md](../../migration/minigame-specifications.md) says
they teach.

Every vocabulary item already names an `imageUrl`. Nothing loads it.

## Scope

1. Commission or author one picture per item in
   `packages/template-catalog/src/fixtures/defaultVocabulary.ts`, with recorded
   provenance and usage rights. The prototype's assets are a candidate source
   and are covered by step 6 of the selective migration process.
2. Add the media-provenance record `scripts/check-privacy.mjs` requires.
3. Load `imageUrl` in the player and delete `pictureGlyph.ts`.
4. Fail closed when a default picture is missing (invariant 6) with a
   recoverable adult-facing error — not a silent placeholder.
5. Decide whether pictures are bundled or fetched, against the classroom
   panel's cold-start budget.

## Not in scope

Personalised media. These three templates carry no child data and no
personalisation slots, and that is deliberate: they are what the
default-content institutional pilot plays.

## Blocked on

Artwork licensing. Nothing else here is technical risk.
