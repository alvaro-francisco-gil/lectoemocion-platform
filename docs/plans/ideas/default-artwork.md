# Default artwork

## Problem

The vocabulary games now ship real pictures. The **characters** do not.

`defaultCharacters.ts` gives every character a `photoUrl` and a
`pronunciationUrl` under `/synthetic/`, and nothing loads either: no file exists
at those paths, and `renderNameStory` and `renderMemoryAlbum` draw coloured
shapes and lettering instead. The framing story therefore has no faces and no
voices, which is most of what makes it a story.

## Done

Vocabulary pictures, for `pairs-game`, `word-picture-game`, and
`syllables-game`:

- 109 pictures imported from the prototype by
  `scripts/import-vocabulary-images.mjs`, resized and re-encoded as WebP
  (34 MB of source down to 2 MB);
- rights recorded in `apps/player-web/public/vocabulary/PROVENANCE.md`,
  including a known limitation about per-file licensing;
- loaded in `ResourceScene.preload`, failing closed with an adult-facing
  message when a default picture is missing;
- served from `public/` and fetched per resource rather than bundled, so the
  panel's cold start pays only for the round being played.

## Remaining

1. Author or commission one portrait per character in `defaultCharacters.ts`,
   and one pronunciation recording per character, with recorded provenance and
   usage rights. The prototype has no character art, so this cannot be imported
   the way the vocabulary was.
2. Add a `PROVENANCE.md` alongside them; `scripts/check-privacy.mjs` requires
   it for audio as well as images.
3. Load `photoUrl` and `pronunciationUrl` in the roster renderers, failing
   closed on a missing default exactly as the vocabulary path does.
4. Unlock audio on first gesture — every browser blocks autoplay, and the
   unlock has to survive an aged WebView
   ([player AGENTS.md](../../../apps/player-web/AGENTS.md)).

## Not in scope

Personalised media. The vocabulary templates carry no child data and no
personalisation slots at all, and that is deliberate. The roster templates do
have slots, but their *defaults* are product content like any other asset — a
child's photo only ever overlays one.

## Blocked on

Character art and voice recording. Nothing here is technical risk.
