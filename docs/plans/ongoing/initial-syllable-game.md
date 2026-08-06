# Initial syllable game

## Status

- **Updated:** 2026-08-06
- **Stage:** implementation
- **Branch:** `feat/initial-syllable-game` in `.worktrees/initial-syllable-game`
- **Done:** design approved — drag-primary selection, audio deferred
- **Next:** schema branch, then rules, then the renderer
- **Blockers:** none
- **Handoff:** audio is out of scope by decision, not by oversight; see the
  "Audio is deferred" section before adding any sound field here.

## Goal

A fifth minigame, `initial-syllable-game`: a pictured word on top, three
pictured words below, one of which begins with the same syllable. Choosing it
reveals both words with the shared opening syllable emphasised.

Syllable awareness is the step between the letter the `initials-game` teaches
and the segmentation the `syllables-game` drills — hearing that `MAriposa` and
`MAnzana` open the same way is the skill Spanish phonics builds blending on.

## Context

The syllabification already exists. Every item in `defaultVocabulary` carries
its syllables, parsed from the prototype's filenames
(`item("caballo", ["ca", "ba", "llo"])`), so the initial syllable is derivable
from shipped content and this template needs no new assets at all. The `ca-`,
`pa-`, `ma-`, `co-` and `ca-` families each have enough members for real
rounds.

### Selection, and why it is a drag

The intent is that tapping any card eventually **plays that word**, which
collides with tapping to answer. The resolution is the one the letters game
already reached: **drag the choice onto the target, with tap-the-choice then
tap-the-target kept alongside**, both calling the same rules function so the
two paths cannot disagree about the answer.

This is not the syllables game's model, which is tap-then-tap only:
`minigame-specifications.md` records that a drag does not survive an aged panel
digitiser equally across touch, stylus and mouse. Keeping both paths is what
lets the primary gesture be a drag without stranding that hardware.

### Audio is deferred, deliberately

No vocabulary item has a recording, and `docs/plans/ideas/audio.md` specifies
what one will be when it exists: AAC-LC 64 kbps mono `.m4a`, the "default
pronunciation" role, ≤ 3 s, normalised to −16 LUFS, with a `PROVENANCE.md`
beside it.

Nothing audio-shaped is added here. An optional `audioUrl` that nothing
populates and a speaker affordance that never appears would be dead code, which
the contract forbids. The drag-primary mechanic is the whole preparation: when
recordings land, tap gains playback and the way a child answers does not change.

## Design

### Template identity

`initial-syllable-game`, version 1, a `minigame`. Distinct from `initials-game`,
which matches an initial **letter** across roster slots; this matches an initial
**syllable** across vocabulary.

### Manifest

```ts
InitialSyllableGameManifestSchema = {
  ...envelope,
  template: {
    id: "initial-syllable-game",
    version: 1,
    targetVocabularyItemId: string,
    matchVocabularyItemId: string
  },
  vocabulary: VocabularyItem[]  // exactly 4: the target and three choices
}
```

Four is pinned by the schema rather than by a constant a caller may pass, so
"three pictures below" is unrepresentable otherwise. Which of the choices is
right is named in the template, not implied by position: the manifest is
shuffled by seed and order carries no meaning.

What the schema cannot express — that the match shares the target's initial
syllable and the distractors do not — is asserted by the rules, which run both
while a world is authored and when a round is built.

### Rules — `packages/template-sdk/src/rules/initialSyllableGame.ts`

- `initialSyllable(item)` — the one place the first syllable is read.
- `sharesInitialSyllable(a, b)` — case-folded for `es-ES`, otherwise literal.
  No accent folding: treating `ni` and `ní` as one syllable is a phonetic claim
  this repository has no basis to make.
- `createInitialSyllableRound(manifest)` — resolves target and match, and
  fails closed if the match does not share the target's initial syllable, if a
  distractor does, or if either id is absent from the vocabulary.
- `chooseInitialSyllable(round, id)` — `correct` | `incorrect` | `ignored`,
  spending from the shared `ROUND_LIVES` budget, exactly as
  `chooseWordPicture` does.

### Catalogue — `createInitialSyllableGameResource(vocabulary, targetId, seed)`

Draws the match from the target's syllable family and two distractors from
outside it, both seeded. Refuses at authoring time when the family is empty.

One candidate rule beyond "shares the syllable": a candidate whose word is a
prefix of the target's, or vice versa, is skipped. `CARAMELO` against
`CARAMELOS` is a round no child can lose fairly and no adult would author on
purpose.

### Player — `renderInitialSyllableGame.ts`

Target card centred at the top, out of a child's reach; three choice cards in
the lower reach band. Each choice is draggable and tappable; the target accepts
a drop and commits a held card.

The reveal on a correct answer draws both words under their pictures with the
shared opening syllable in an accent colour and the remainder in black —
`MA·riposa` / `MA·nzana`. That reveal is the lesson; the win is only its
occasion.

Its own field colour, so the three vocabulary games are told apart from across
a classroom rather than by reading their banners.

## Files

- [ ] `packages/resource-schema/src/resourceManifest.ts` — manifest branch, in
      the union
- [ ] `packages/resource-schema/src/resourceManifest.test.ts` — accepts valid,
      rejects malformed
- [ ] `packages/resource-schema/src/worldSchema.ts` — node resource branch
- [ ] `packages/template-sdk/src/rules/initialSyllableGame.ts` + test
- [ ] `packages/template-sdk/src/index.ts` — exports
- [ ] `packages/template-sdk/src/templateDefinition.ts` — `minigame`
- [ ] `packages/template-catalog/src/vocabularyGames.ts` + test — builder
- [ ] `packages/template-catalog/src/index.ts` — export
- [ ] `packages/template-catalog/src/world/index.ts` — node and dispatcher case
- [ ] `packages/template-catalog/src/publishedVersions.test.ts` — version pin
- [ ] `packages/template-catalog/src/vocabularySweep.test.ts` — real-content
      sweep
- [ ] `apps/player-web/src/game/templates/vocabularyCard.ts` — field colour and
      the emphasised-word label
- [ ] `apps/player-web/src/game/templates/renderInitialSyllableGame.ts`
- [ ] `apps/player-web/src/game/scenes/ResourceScene.ts` — dispatch
- [ ] `apps/player-web/e2e/player.spec.ts` — won by dragging
- [ ] `docs/migration/minigame-specifications.md` — its section

## Verification

- `pnpm check` — guardrails, typecheck, tests, build.
- `pnpm test:e2e` — the player is touched.
- The sweep proves every vocabulary item with a non-empty syllable family
  produces a winnable round, and names the ones that have no family at all.

## Acceptance

1. A child drags the matching picture onto the target and both words appear
   with the shared syllable emphasised.
2. Tap-the-choice then tap-the-target does the same thing, through the same
   rules function.
3. A wrong choice costs one life, shakes, and returns home; three end the round
   with a recoverable message.
4. Authoring a node whose target has no syllable family fails when the world is
   built, not when a child opens the chapter.

## Out of scope

- Audio of any kind — `docs/plans/ideas/audio.md` owns that.
- Naming the match or the distractors from the world node. The derived branch
  is the only one; a named branch is added when a world needs one.
