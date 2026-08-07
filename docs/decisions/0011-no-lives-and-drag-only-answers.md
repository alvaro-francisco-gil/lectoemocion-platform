# ADR 0011: No lives, and answering is a drag

Date: 2026-08-07  
Status: Accepted

Supersedes the lives budget and the tap-alongside-drag arrangement recorded in
[minigame-specifications.md](../migration/minigame-specifications.md), both
inherited from the Godot prototype.

## Context

Every vocabulary minigame spent from a shared three-life budget: three wrong
answers ended the round with *Vamos a intentarlo otra vez* and a board that
could no longer be touched. `RoundStatus` had a third member, `lost`, and each
of the five rule modules decremented `livesRemaining` and decided from it.

The budget was the prototype's, carried over without being re-argued. For an
audience of Spanish children aged 3–5 meeting these letters for the first time,
it buys nothing. A child who has just put `RI` where `MA` goes has not failed a
test; they have learned where `RI` does not go. Taking the board away at that
moment ends the only activity that was teaching them anything, and it ends it
hardest for the child who most needed the extra attempts. Nothing downstream
depended on the distinction either: a lost round awards no star, and neither
does an abandoned one.

Separately, the two ordering games disagreed about how a card is placed. The
letters game accepted a drag *and* tap-the-card-then-tap-the-slot; the syllables
game accepted only the taps. The stated reason for keeping taps was hardware:
a drag gesture does not survive an aged classroom panel's digitiser equally
across touch, stylus, and mouse.

That reason competed with a better use for the gesture. Word recordings are
planned — see [audio](../plans/ideas/audio.md) — and tapping a card to hear its
syllable read aloud is the single most useful thing a tap could do in a game
about sounding words out. A gesture cannot both place a card and read it aloud.

## Decision

**No round can be lost.** `RoundStatus` is `"playing" | "won"`. A wrong answer
does not stick and costs nothing else: the card returns to where it came from
and the round handed back is equal to the round that came in.

**A card is placed by dragging it, and only by dragging it.** Tapping a card in
the syllables, letters, and initial-syllable games does nothing today, and is
reserved for playing that card's word or syllable when recordings exist.

Where no drag exists — the pairs and initial-letter matching games — tap remains
the placement gesture. The rule is not "tap never places"; it is that a game
offering a drag does not also offer a tap.

## Consequences

The union has two members rather than three with one unreachable, so `lost` is
not a sentence this codebase can write. Shrinking it is what found every site:
the compiler flagged each renderer branch that had handled it.

`SequenceAttempt` lost its `ignored` member too. A sequence round now ends only
by being won, and winning is exactly what empties the tray, so there is no card
left to offer a finished round — the id lookup rejects it before any status
could be consulted. The kind existed to absorb taps on a round out of lives.

The invariant tests changed shape rather than shrinking. "Lives only ever fall"
became "a rejected attempt leaves the round *equal to what it was*", which is
strictly stronger: there is nowhere for a hidden penalty to accumulate, and a
game that grew one fails in
[roundInvariants.test.ts](../../packages/template-sdk/src/rules/roundInvariants.test.ts)
rather than in a classroom.

**The digitiser fallback is given up knowingly.** On a panel where a drag does
not complete, a child now has no way to finish the two ordering games — where
before they had the tap path. This is the real cost of the decision, accepted
because the hardware claim was never measured against the panels this product
actually ships to, while the audio gesture is a definite future use. If a
deployment turns up where drags genuinely do not land, the answer is a
per-deployment input mode, not a second gesture wired into every game.

Because a drag is the only way in, it needs proving through a real canvas: a
drag can be perfectly right in the rules and unwired from the pointer, and no
rules test would notice. `player.spec.ts` plays both ordering games through the
canvas, with press coordinates derived from the seeded deal and the layout
modules rather than copied into the test. The syllables game needed its own
`syllablesLayout.ts` for that, since the end-to-end suite must not carry a
second copy of coordinates that can drift from the renderer's.

Making the syllables game a third canvas-driven test exposed a flake that was
already there — the same suite failed two such tests on an unchanged tree. A
synthetic gesture is occasionally dropped when three viewport projects, one of
them 4K, render at once, and a chapter needing every card placed loses the
whole run to one lost drag. A trace showed exactly that: three letters seated,
the fourth still in the row. The suite now paces input against real animation
frames rather than the wall clock, and retries a lost gesture — in place where
the round has no selection to corrupt, by reopening the chapter where it does.
Neither can hide a broken gesture, because every attempt would then place
nothing.

Wrong answers still *say so* — the card flashes red and shakes. Removing the
penalty is not removing the feedback.
