# Stars fly to the counter

## Status

- **Updated:** 2026-08-08
- **Stage:** designed and approved; not started.
- **Branch:** none yet.
- **Next:** write the implementation plan, then build it.
- **Blockers:** none.

## What a child sees

A chapter finishes. The award screen says `¡+3 letriestrellas!`, the child
presses *Seguir*, and — depending on what the chapter owed — the chests, the
animal reveal and the gift ceremony each take the screen in turn. Then the
world comes back.

Today the world comes back with the counter already reading the new total. The
three stars the child was just shown never went anywhere; they were simply
replaced by a larger number in a corner the child was not looking at. The
arithmetic happened off-screen, which for a child of three or four means it did
not happen at all.

After this change the world returns with the counter still reading the **old**
number, and then, over about a second:

```text
        world appears, pill reads 3
   ·                                  ( 3 ★ )
        ★ ★ ★  rise from the centre        ↗
   ·      staggered 110ms apart

   star 1 lands → ( 4 ★ ) pops   ◜ ring +1 step, flares
   star 2 lands → ( 5 ★ ) pops   ◝ ring +1 step, flares
   star 3 lands → ( 6 ★ ) pops   ◞ ring +1 step, flares
                                     flare fades
```

The stars leave from the centre of the screen, which is where the child last
saw them on the award screen, and land on the pill top-right. Each landing does
three things at once: the pill's number goes up by one and pops, the ring
bottom-left advances by one star's worth, and the ring flares. Three landings,
three steps, one beat each — not one number swapping and one arc sliding.

Each star arcs rather than travelling in a straight line. An outer element
carries it sideways and an inner one lifts and drops it, so the curve is two
nested `transform` transitions and nothing the compositor cannot do on the
classroom panel's hardware.

## The decisions behind it, and why

### The flight happens on the world, not on the award screen

The obvious reading of "the stars go to the counter" puts the flight on the
award screen, where the stars already are. It cannot work. After the award the
child may be routed through the chests, the animal reveal and the gift
ceremony, and `AGENTS.md` states that exactly one screen is on at a time — a
flight begun on the award screen would have to survive two or three full screen
swaps to reach a counter that is not mounted on any of them.

The world is the only screen that has the pill and the ring on it, and it is
the screen the child is guaranteed to land on. So the flight belongs there, and
the counter's job is to hold the old number until the child can see it change.

### The lag lives above the screen switch

The world is unmounted for the whole ceremony. Anything remembering "the number
we were showing before" therefore cannot live in the world's subtree — it would
be reinitialised from the new truth on remount and there would be nothing left
to count up from. The lag lives in `App`, above the screen switch.

### The world reports its own arrival

The flight must start when the world is on screen, so something has to say when
that is. `App` could re-derive it from the six early returns that precede the
world's own — but that is a second copy of the screen ordering, including the
`detour`/`stamping` interlock that holds the gift back until the animal's stamp
has landed, in a place that would drift from the original in silence.

Instead the readout dispatches `arrived` when it mounts. The world screen is
the only thing that renders the readout, so its mount *is* the fact, and there
is no second opinion to keep in step.

### A claimed gift snaps; it never counts down

Crossing the goal resets the fill: 28 stars plus 3 becomes 3, not 31, because
30 were just spent on a regalo. A flight here would count *downwards*, and it
would arrive as a fourth beat immediately after a ceremony that had already
ended. Any decrease snaps.

### A cold start never flies

Opening the app with twelve stars shows twelve, at once. The flight is the
telling of an event; nothing happened here.

### The readout appears under the first star

`filled === 0` renders no readout at all today, deliberately: the whole thing
arrives with the child's first letriestrella, which makes its appearance part
of the reward. That is kept. On the first finish the corner is empty, the stars
fly to it anyway, and the pill and ring pop into being under the first one.

For that to work the flight needs to know where the pill *will* be. During a
first flight the readout is laid out but `visibility: hidden` and
`aria-hidden` — present so it can be measured, unseen so no child is ever shown
a `0`.

## Shape

### `src/world/starArrival.ts` — pure, no timers, no DOM

Progression lives in `src/world/`, and this is the same split `prizes.ts` and
`prizeStore.ts` already draw: the arithmetic is pure and testable, the effects
sit outside it.

```ts
interface StarArrival {
  started: boolean   // a cold start snaps; it never flies
  filled: number     // the truth, last read
  shown: number      // what the readout draws — lags during a flight
  landings: number   // bumped per landing, so the readout flares once each
  flight: { id: number; count: number; landed: number } | null
  motion: Motion
}

nextArrival(state, event)
  { type: "reading", filled, motion }   // the truth changed
  { type: "arrived" }                   // the world is on screen now
  { type: "landed" }                    // one star reached the pill
  { type: "reset" }                     // a different child is playing
```

Rules:

| Event | Condition | Result |
|---|---|---|
| `reading` | not `started` | `started`, `shown = filled` — cold start |
| `reading` | `filled < shown` | `shown = filled`, flight cleared — a gift was claimed |
| `reading` | reduced motion | `shown = filled` |
| `reading` | `filled > shown` | `shown` held; the flight waits for `arrived` |
| `arrived` | no flight, `filled > shown`, full motion | flight of `filled - shown`, new `id` |
| `landed` | — | `shown + 1`, `landings + 1`, `landed + 1`; flight cleared on the last |
| `reset` | — | back to `NO_ARRIVAL` |

`flight.id` keys the overlay, so a flight's stars are a stable list for its
whole life. Re-deriving the elements from the count still in the air would
re-key them on every landing and restart the two that are still travelling.

### `src/app/PrizeReadout.tsx`

`PrizeMeter` moves out of `App.tsx` and is joined here by `StarFlight`. They
are one unit: the readout, and the thing that arrives at it.

- `PrizeMeter` takes `shown` rather than `filled`, plus `landings` for the
  flare. `role="meter"` is polled rather than announced, so the sub-second
  visual lag is invisible to a screen reader and no second number is needed.
- It renders when `shown > 0 || flight !== null`, hidden-but-laid-out in the
  first-flight case described above.
- `StarFlight` is `aria-hidden` and `pointer-events: none`, keyed by
  `flight.id`, measures the pill in `useLayoutEffect`, and runs one `setTimeout`
  per star. It never reads the pill's position from CSS: the pill's geometry
  stays stated once, in the stylesheet, and is measured rather than copied.

The ring's flare is a stroke change — brighter gold, slightly thicker — rather
than a `drop-shadow`. The classroom panel's fill rate is a product concern.

### `src/app/App.tsx`

`useReducer(nextArrival, NO_ARRIVAL)`; an effect dispatching `reading` when
`prizeView.filled` changes; an effect dispatching `reset` when the selected
profile changes, because a profile switch changes the number for a reason that
is not an achievement. `<PrizeReadout>` replaces `<PrizeMeter>`. `App.tsx` gets
shorter.

### Motion preference

`prefers-reduced-motion: reduce` is read once through `matchMedia` and fed to
the reducer, so under it no timers are scheduled at all and the number simply
updates. The stylesheet's existing reduced-motion blocks stay as they are.

## Tests

RED first, in this order.

1. `src/world/starArrival.test.ts` — every row of the rules table, with no
   timers and no render.
2. `src/app/PrizeReadout.test.tsx` — nothing at zero with no flight; the
   hidden-but-measurable first flight; one `onLanded` per star under fake
   timers; the flare on landing.
3. `src/app/App.test.tsx` — one case: a finish leaves the counter at the new
   total.
4. `e2e/` — one assertion that the counter reads `3` after a real finish.

## Out of scope

- Any change to what a finish is worth, to the goal, or to when a gift is owed.
  `prizes.ts` is untouched.
- Sound. The award screen is silent today and this does not change that.
- Animating the gift ceremony or the chests.
