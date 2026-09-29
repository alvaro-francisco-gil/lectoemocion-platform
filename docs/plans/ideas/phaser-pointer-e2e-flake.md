# A dropped pointer in the Phaser e2e tests reads as a two-minute hang

Status: idea. Not scoped, not scheduled.

**Priority:** low

## The problem

Under full-suite load, one Phaser pointer test in
`apps/player-web/e2e/player.spec.ts` times out at the 120 s `completed()` poll —
a different one each run, usually "the letters game is won by dragging each
letter into its slot" or "the initial-letter game is won by tapping each
picture and its letter", at `classroom-hd`, `classroom-4k` or `phone`.

The game is not broken. Each test passes in isolation in 1.4–7.6 s; under load,
with several browsers competing for the machine, some clicks are dropped before
the canvas sees them.

## Evidence

Recorded while verifying the animal book (2026-08-07), on untouched `main` at
the commit that branch sat on: run 1 passed 83/83, run 2 failed on the letters
game at 2.1 minutes with the same signature. It also fails at `2445482`, before
that work. Nothing in it touched those games, their canvases or their input
paths.

## Why it costs so much

`completed()` polls `localStorage` for the chapter's completion for up to
120 s, and nothing between the pointer action and that poll asserts the
pointer landed. A dropped click is therefore indistinguishable from a hang,
and it takes two minutes to say anything — and then says the wrong thing.

## Proposed fix

Scoped to the test helpers, not the games:

- After each drag or tap, assert the game's observable response to *that*
  input (the letter seated, the picture marked) with a short timeout, so a
  dropped pointer fails fast and names the step that dropped.
- Retry a single pointer action whose response did not arrive, rather than the
  whole test — a dropped input under contention is an environment fact, while
  a game that ignores a correct input twice is a bug.
- Keep the long `completed()` budget only for the fixed-timeline resources it
  was sized for.

No `retries`, `.skip` or exclusion — `AGENTS.md` forbids muting it.
