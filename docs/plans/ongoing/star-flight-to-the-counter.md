# Stars fly to the counter

## Status

- **Updated:** 2026-08-08
- **Stage:** designed and planned; implementation not started.
- **Branch:** `feat/star-flight`, worktree `.worktrees/star-flight`, branched
  from `86fc8fa`.
- **Next:** Task 1.
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

The stars leave from the middle of the screen, which is where the child last
saw them on the award screen, and land on the pill top-right. Each landing does
three things at once: the pill's number goes up by one and pops, the ring in
the reward corner advances by one star's worth, and the ring flares. Three
landings, three steps, one beat each — not one number swapping and one arc
sliding.

Each star arcs rather than travelling in a straight line. An outer element
carries it sideways and an inner one lifts and shrinks it, so the curve is two
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

Instead the overlay dispatches `arrived` when it mounts. The world screen is
the only thing that renders it, so its mount *is* the fact, and there is no
second opinion to keep in step.

### A claimed gift snaps; it never counts down

Crossing the goal resets the fill: 28 stars plus 3 becomes 3, not 31, because
30 were just spent on a regalo. A flight here would count *downwards*, and it
would arrive as a fourth beat immediately after a ceremony that had already
ended. Any decrease snaps.

### A cold start never flies

Opening the app with twelve stars shows twelve, at once. The flight is the
telling of an event; nothing happened here. The same holds when the child at
the wheel changes: a different profile's total is a different fact, not an
achievement.

### The readout appears under the first star

`shown === 0` renders no readout at all today, deliberately: the whole thing
arrives with the child's first letriestrella, which makes its appearance part
of the reward. That is kept. On the first finish the corner is empty, the stars
fly to it anyway, and the pill pops into being under the first one.

For that to work the flight needs to know where the pill *will* be. During a
first flight the pill is laid out but `visibility: hidden` and `aria-hidden` —
present so it can be measured, unseen so no child is ever shown a `0`. The ring
needs no such treatment: nothing aims at it, so it simply appears with the
first landing.

## Shape

### `src/world/starArrival.ts` — pure, no timers, no DOM

Progression lives in `src/world/`, and this is the same split `prizes.ts` and
`prizeStore.ts` already draw: the arithmetic is pure and testable, the effects
sit outside it.

Rules:

| Event | Condition | Result |
|---|---|---|
| `reading` | not `started` | `started`, `shown = filled` — cold start |
| `reading` | `filled < shown` | `shown = filled`, flight cleared — a gift was claimed |
| `reading` | reduced motion | `shown = filled` |
| `reading` | `filled > shown` | `shown` held; the flight waits for `arrived` |
| `arrived` | no flight, `filled > shown`, full motion | flight of `filled - shown`, new `id` |
| `landed` | more stars in this flight | `shown + 1`, `landings + 1` |
| `landed` | the last of this flight, and `filled > shown` still | a further flight for the remainder |
| `landed` | the last of this flight | `shown + 1`, `landings + 1`, flight cleared |
| `reset` | — | back to `NO_ARRIVAL` |

`flight.id` keys the overlay, so a flight's stars are a stable list for its
whole life. Re-deriving the elements from the count still in the air would
re-key them on every landing and restart the two that are still travelling.

### `src/app/PrizeReadout.tsx`

`PrizeCount` and `PrizeRing` move out of `App.tsx` and are joined here by
`StarFlight`. They are one unit: the readout, and the thing that arrives at it.

- Both take `shown` rather than `filled`, plus `landings`, which flares them
  once per landing.
- `PrizeCount` also takes `arriving`, for the hidden-but-measurable first
  flight, and the ref the flight aims at.
- `StarFlight` is `aria-hidden` and `pointer-events: none`, keyed by
  `flight.id`, measures the pill in `useLayoutEffect`, and runs one `setTimeout`
  per star. It never reads the pill's position from CSS: the pill's geometry
  stays stated once, in the stylesheet, and is measured rather than copied.

The ring's flare is a stroke change — brighter gold, slightly thicker — rather
than a `drop-shadow`. The classroom panel's fill rate is a product concern.

### Motion preference

`prefers-reduced-motion: reduce` is read once through `matchMedia` and fed to
the reducer, so under it no timers are scheduled at all and the number simply
updates. `.star-flight` is `display: none` under the same query, belt and
braces for a preference that changes mid-flight.

jsdom has no compositor, so the test setup answers `reduce` for every media
query by default. That is the truthful answer for a headless DOM, and it keeps
every existing `App` test measuring the arithmetic rather than racing the
choreography. The one `App` test that is *about* the flight opts into full
motion explicitly.

## Out of scope

- Any change to what a finish is worth, to the goal, or to when a gift is owed.
  `prizes.ts` is untouched.
- Sound. The award screen is silent today and this does not change that.
- Animating the gift ceremony or the chests.

---

# Implementation Plan

> **For agentic workers:** use `superpowers:subagent-driven-development` or
> `superpowers:executing-plans` to work this task by task. Steps are
> checkboxes.

**Goal:** the letriestrellas a finish paid fly from the middle of the world to
the counter top-right, one at a time, each landing advancing the counter and
the ring.

**Architecture:** a pure reducer in `src/world/starArrival.ts` holds the
displayed count behind the true one; a `src/app/PrizeReadout.tsx` renders the
pill, the ring and the flight; `App` owns the reducer and dispatches.

**Tech Stack:** React 19, TypeScript 7 (strict, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `noImplicitReturns`), Vitest + Testing Library,
Playwright, plain CSS in `apps/player-web/src/styles.css`.

## Global Constraints

- All work happens in `.worktrees/star-flight` on `feat/star-flight`. Never
  move `HEAD` in the repository root.
- No `any`, no `@ts-ignore`, no `.skip`. Every switch over a union ends with
  `assertNever(value, "description")`.
- Every task ends with `pnpm check` green before its commit.
- Conventional commits. Never `--no-verify`, never `git add -A`.
- Copy is Spanish and unchanged: `Letriestrellas hacia el próximo regalo`,
  `Tu regalo`, `Tus regalos: N`.
- Motion durations live in TypeScript constants and are handed to CSS as custom
  properties. Never write a duration in both places.
- Comments explain *why*, in the register the surrounding file already uses.

---

### Task 1: the arrival reducer

**Files:**
- Create: `apps/player-web/src/world/starArrival.ts`
- Test: `apps/player-web/src/world/starArrival.test.ts`

**Interfaces:**
- Consumes: `assertNever` from `@lectoemocion/domain`.
- Produces: `Motion`, `StarFlightState`, `StarArrival`, `ArrivalEvent`,
  `NO_ARRIVAL`, `nextArrival(state, event): StarArrival`.

- [ ] **Step 1: Write the failing test**

Create `apps/player-web/src/world/starArrival.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  NO_ARRIVAL,
  nextArrival,
  type ArrivalEvent,
  type StarArrival
} from "./starArrival";

/** Replays a run of events, the way the app dispatches them. */
function run(events: readonly ArrivalEvent[]): StarArrival {
  return events.reduce(nextArrival, NO_ARRIVAL);
}

const reading = (filled: number): ArrivalEvent => ({
  type: "reading",
  filled,
  motion: "full"
});

describe("the star arrival", () => {
  /*
   * Opening the app with stars already banked is not an event. There is
   * nothing to tell, so there is nothing to fly.
   */
  it("snaps to what is already earned on the first reading", () => {
    const state = run([reading(12), { type: "arrived" }]);
    expect(state.shown).toBe(12);
    expect(state.flight).toBeNull();
  });

  /* The award screen is on: the world has not seen this yet. */
  it("holds an increase until the world is on screen", () => {
    const state = run([reading(0), reading(3)]);
    expect(state.shown).toBe(0);
    expect(state.flight).toBeNull();
  });

  it("launches one star per letriestrella when the world arrives", () => {
    const state = run([reading(0), reading(3), { type: "arrived" }]);
    expect(state.flight).toEqual({ id: 1, count: 3, landed: 0 });
  });

  it("advances the readout by one on every landing", () => {
    const state = run([
      reading(3),
      reading(6),
      { type: "arrived" },
      { type: "landed" },
      { type: "landed" }
    ]);
    expect(state.shown).toBe(5);
    expect(state.landings).toBe(2);
    expect(state.flight).toEqual({ id: 1, count: 3, landed: 2 });
  });

  it("clears the flight when the last star lands", () => {
    const state = run([
      reading(3),
      reading(6),
      { type: "arrived" },
      { type: "landed" },
      { type: "landed" },
      { type: "landed" }
    ]);
    expect(state.shown).toBe(6);
    expect(state.flight).toBeNull();
  });

  /*
   * A second arrival mid-flight — the profile drawer opening and closing over
   * the world, say — must not launch the same stars twice.
   */
  it("ignores an arrival while stars are still in the air", () => {
    const state = run([
      reading(0),
      reading(3),
      { type: "arrived" },
      { type: "arrived" }
    ]);
    expect(state.flight).toEqual({ id: 1, count: 3, landed: 0 });
  });

  /*
   * Crossing the goal spends the stars on a regalo, so the fill drops. A
   * flight here would count downwards, after a ceremony that already ended.
   */
  it("snaps and cancels when a claimed gift empties the meter", () => {
    const state = run([
      reading(27),
      reading(30),
      { type: "arrived" },
      { type: "landed" },
      reading(0)
    ]);
    expect(state.shown).toBe(0);
    expect(state.flight).toBeNull();
  });

  /* Nothing moves, and no timer is ever scheduled to move it. */
  it("never flies when motion is reduced", () => {
    const state = run([
      { type: "reading", filled: 0, motion: "reduced" },
      { type: "reading", filled: 3, motion: "reduced" },
      { type: "arrived" }
    ]);
    expect(state.shown).toBe(3);
    expect(state.flight).toBeNull();
  });

  /*
   * A finish landing while the previous flight is still in the air would
   * otherwise leave the readout permanently short of the truth.
   */
  it("flies the remainder when stars arrive mid-flight", () => {
    const state = run([
      reading(0),
      reading(3),
      { type: "arrived" },
      reading(6),
      { type: "landed" },
      { type: "landed" },
      { type: "landed" }
    ]);
    expect(state.shown).toBe(3);
    expect(state.flight).toEqual({ id: 4, count: 3, landed: 0 });
  });

  /* A different child's total is a different fact, not an achievement. */
  it("forgets everything when the player changes", () => {
    const state = run([reading(3), reading(6), { type: "reset" }]);
    expect(state).toEqual(NO_ARRIVAL);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm --filter @lectoemocion/player-web test -- src/world/starArrival.test.ts
```

Expected: every case fails — `Failed to resolve import "./starArrival"`.

- [ ] **Step 3: Write the reducer**

Create `apps/player-web/src/world/starArrival.ts`:

```ts
import { assertNever } from "@lectoemocion/domain";

/**
 * Where the readout is, against where it ought to be.
 *
 * The counter tells a child what a finish was worth, and it can only tell them
 * that if it is still showing the old number when they arrive to watch it
 * change. So the truth and the drawing are two numbers here: `filled` is what
 * the child has earned, `shown` is what the corner says, and the gap between
 * them is stars that are still in the air.
 *
 * Pure on purpose, exactly as `prizes.ts` is. Every rule below is a rule about
 * when a number may move, and none of them needs a clock or a screen to decide.
 */
export type Motion = "full" | "reduced";

/** One flight of stars, from the middle of the screen to the counter. */
export interface StarFlightState {
  /**
   * Unique and rising. The overlay is keyed by it, which is what keeps a
   * flight's stars one stable list for its whole life: elements re-derived
   * from the number still in the air would re-key on every landing and restart
   * the two that were still travelling.
   */
  readonly id: number;
  readonly count: number;
  readonly landed: number;
}

export interface StarArrival {
  /** Whether a first reading has been taken. The first one never flies. */
  readonly started: boolean;
  /** What the child has earned towards the next regalo. */
  readonly filled: number;
  /** What the corner is drawing. Behind `filled` while stars are in the air. */
  readonly shown: number;
  /** Total landings ever. Bumped per star, so a readout can flare once each. */
  readonly landings: number;
  readonly motion: Motion;
  readonly flight: StarFlightState | null;
}

export const NO_ARRIVAL: StarArrival = {
  started: false,
  filled: 0,
  shown: 0,
  landings: 0,
  motion: "full",
  flight: null
};

export type ArrivalEvent =
  /** The truth changed: a finish paid, or a regalo spent what was there. */
  | { readonly type: "reading"; readonly filled: number; readonly motion: Motion }
  /** The world is on screen, so there is something to watch the stars land on. */
  | { readonly type: "arrived" }
  /** One star reached the counter. */
  | { readonly type: "landed" }
  /** A different child is playing. */
  | { readonly type: "reset" };

export function nextArrival(
  state: StarArrival,
  event: ArrivalEvent
): StarArrival {
  switch (event.type) {
    case "reading": {
      const read = { ...state, filled: event.filled, motion: event.motion };

      /* What is already banked is not an event: nothing happened to tell. */
      if (!state.started) {
        return { ...read, started: true, shown: event.filled, flight: null };
      }

      /*
       * Crossing the goal spends the stars on a regalo and the fill drops.
       * Counting downwards says nothing a child can use, and it would arrive
       * as one beat too many after a ceremony that has already ended.
       */
      if (event.filled < state.shown) {
        return { ...read, shown: event.filled, flight: null };
      }

      if (event.motion === "reduced") {
        return { ...read, shown: event.filled, flight: null };
      }

      /*
       * An increase waits. This reading almost always happens on the award
       * screen, with the world unmounted; the corner it belongs to is not on
       * screen yet, and a number that changed while nobody could see it is the
       * whole problem this file exists to fix.
       */
      return read;
    }

    case "arrived": {
      if (state.flight !== null || state.motion === "reduced") return state;
      const count = state.filled - state.shown;
      if (count <= 0) return state;
      return { ...state, flight: { id: state.landings + 1, count, landed: 0 } };
    }

    case "landed": {
      /* A landing with nothing in the air is a stray timer, not a star. */
      if (state.flight === null) return state;

      const shown = state.shown + 1;
      const landings = state.landings + 1;
      const landed = state.flight.landed + 1;

      if (landed < state.flight.count) {
        return { ...state, shown, landings, flight: { ...state.flight, landed } };
      }

      /*
       * Stars paid while this flight was still travelling have to arrive too.
       * Without this they would never be drawn: the world is already on screen,
       * so no further `arrived` is coming to collect them, and the corner would
       * sit permanently short of the truth.
       */
      const remaining = state.filled - shown;
      return {
        ...state,
        shown,
        landings,
        flight:
          remaining > 0
            ? { id: landings + 1, count: remaining, landed: 0 }
            : null
      };
    }

    case "reset":
      return NO_ARRIVAL;

    default:
      return assertNever(event, "star arrival event");
  }
}
```

- [ ] **Step 4: Run it and watch it pass**

```bash
pnpm --filter @lectoemocion/player-web test -- src/world/starArrival.test.ts
```

Expected: 10 passed.

- [ ] **Step 5: Run the gate**

```bash
pnpm check
```

Expected: green.

- [ ] **Step 6: Commit**

```bash
git add apps/player-web/src/world/starArrival.ts \
        apps/player-web/src/world/starArrival.test.ts
git commit -m "feat(player): hold the star counter behind the stars in the air"
```

---

### Task 2: the readout moves out of App

A pure move plus a rename, so the diff that follows is only about the flight.
`PrizeCount` and `PrizeRing` go to their own file, take `shown` instead of
`filled`, and gain the flare.

**Files:**
- Create: `apps/player-web/src/app/PrizeReadout.tsx`
- Create: `apps/player-web/src/app/PrizeReadout.test.tsx`
- Modify: `apps/player-web/src/app/App.tsx` — delete `PrizeCount` and
  `PrizeRing` (around lines 950–1050), import them instead, pass `shown` and
  `landings`, drop the now-unused `GiftShadow` import
- Modify: `apps/player-web/src/styles.css` — the flare rules

**Interfaces:**
- Consumes: `StarIcon` and `GiftShadow` from `./icons`.
- Produces:
  - `FLARE_MS: number`
  - `PrizeCount({ shown, arriving, landings, pill })` where `pill` is
    `RefObject<HTMLParagraphElement | null>`
  - `PrizeRing({ shown, goal, landings })`

- [ ] **Step 1: Write the failing test**

Create `apps/player-web/src/app/PrizeReadout.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { act, createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FLARE_MS, PrizeCount, PrizeRing } from "./PrizeReadout";

describe("the counter in the corner", () => {
  /* Nothing to say, and nothing on screen saying it. */
  it("draws nothing before the first letriestrella", () => {
    render(
      <PrizeCount
        shown={0}
        arriving={false}
        landings={0}
        pill={createRef<HTMLParagraphElement>()}
      />
    );
    expect(document.querySelector(".prize-count")).toBeNull();
  });

  /*
   * The first flight has to aim somewhere. The pill is laid out so it can be
   * measured, and hidden so no child is shown a nought.
   */
  it("is laid out but unseen while the first stars are still flying", () => {
    render(
      <PrizeCount
        shown={0}
        arriving
        landings={0}
        pill={createRef<HTMLParagraphElement>()}
      />
    );
    const pill = document.querySelector(".prize-count");
    expect(pill).not.toBeNull();
    expect(pill).toHaveAttribute("data-waiting");
  });

  it("shows the count once a star has landed", () => {
    render(
      <PrizeCount
        shown={1}
        arriving
        landings={1}
        pill={createRef<HTMLParagraphElement>()}
      />
    );
    const pill = document.querySelector(".prize-count");
    expect(pill).toHaveTextContent("1");
    expect(pill).not.toHaveAttribute("data-waiting");
  });

  /* Hidden from a screen reader: the ring says the same thing, in words. */
  it("stays out of the accessibility tree", () => {
    render(
      <PrizeCount
        shown={3}
        arriving={false}
        landings={0}
        pill={createRef<HTMLParagraphElement>()}
      />
    );
    expect(document.querySelector(".prize-count")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
  });
});

describe("the flare", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("marks the pill for one beat after a landing, then lets it settle", () => {
    const pill = createRef<HTMLParagraphElement>();
    const { rerender } = render(
      <PrizeCount shown={3} arriving landings={0} pill={pill} />
    );
    expect(document.querySelector(".prize-count")).not.toHaveAttribute(
      "data-flaring"
    );

    rerender(<PrizeCount shown={4} arriving landings={1} pill={pill} />);
    expect(document.querySelector(".prize-count")).toHaveAttribute(
      "data-flaring"
    );

    act(() => {
      vi.advanceTimersByTime(FLARE_MS);
    });
    expect(document.querySelector(".prize-count")).not.toHaveAttribute(
      "data-flaring"
    );
  });

  it("flares the ring on the same landing", () => {
    const { rerender } = render(
      <PrizeRing shown={3} goal={30} landings={0} />
    );
    rerender(<PrizeRing shown={4} goal={30} landings={1} />);
    expect(document.querySelector(".prize-meter")).toHaveAttribute(
      "data-flaring"
    );
  });
});

describe("the ring", () => {
  it("draws nothing before the first letriestrella", () => {
    render(<PrizeRing shown={0} goal={30} landings={0} />);
    expect(screen.queryByRole("meter")).toBeNull();
  });

  /* The picture and the attributes state the same fraction. */
  it("fills in proportion to the goal it is measured against", () => {
    render(<PrizeRing shown={15} goal={30} landings={0} />);
    const meter = screen.getByRole("meter", {
      name: "Letriestrellas hacia el próximo regalo"
    });
    expect(meter).toHaveAttribute("aria-valuenow", "15");
    expect(meter).toHaveAttribute("aria-valuemax", "30");
    expect(
      meter.querySelector(".prize-meter__fill")?.getAttribute("stroke-dasharray")
    ).toBe("50 50");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm --filter @lectoemocion/player-web test -- src/app/PrizeReadout.test.tsx
```

Expected: `Failed to resolve import "./PrizeReadout"`.

- [ ] **Step 3: Create the file**

Create `apps/player-web/src/app/PrizeReadout.tsx`. The doc comment moves across
from `App.tsx` verbatim — it is the rationale for both halves and must not be
left behind or reworded:

```tsx
import { useEffect, useState, type RefObject } from "react";
import { GiftShadow, StarIcon } from "./icons";

/** How long a landing is marked for, so the flare reads as one beat. */
export const FLARE_MS = 420;

/**
 * True for one beat after each landing.
 *
 * Driven by the running total rather than by a boolean, because two stars
 * landing 110ms apart must flare twice: a flag that was already `true` would
 * swallow the second, and the child would see three stars arrive and two
 * things happen.
 */
function useFlare(landings: number): boolean {
  const [flaring, setFlaring] = useState(false);
  useEffect(() => {
    if (landings === 0) return undefined;
    setFlaring(true);
    const timer = window.setTimeout(() => setFlaring(false), FLARE_MS);
    return () => window.clearTimeout(timer);
  }, [landings]);
  return flaring;
}

/**
 * How close the child is to the next regalo.
 *
 * [move the whole existing doc comment from App.tsx here, unchanged, then add
 * the paragraph below]
 *
 * Both halves draw `shown` rather than what the child has earned. The two part
 * company for about a second after a finish, while the stars are still on their
 * way here — see `src/world/starArrival.ts`. `role="meter"` is polled rather
 * than announced, so that lag is invisible to a screen reader and there is no
 * need for a second number.
 */
export function PrizeCount({
  shown,
  arriving,
  landings,
  pill
}: {
  shown: number;
  /** Stars are in the air, so the pill must be laid out for them to aim at. */
  arriving: boolean;
  landings: number;
  pill: RefObject<HTMLParagraphElement | null>;
}) {
  const flaring = useFlare(landings);

  /* Nothing yet, and nothing on its way: nothing to show. */
  if (shown === 0 && !arriving) return null;

  return (
    /*
      Hidden from a screen reader, not because it says nothing but because the
      ring says it already, and in fuller words.

      The number first, then what it counts: "3 letriestrellas", the way it is
      said aloud, rather than a label with a figure hung off it.
    */
    <p
      ref={pill}
      className="prize-count"
      aria-hidden="true"
      data-waiting={shown === 0 ? "" : undefined}
      data-flaring={flaring ? "" : undefined}
    >
      {shown}
      <span className="prize-count__star">
        <StarIcon />
      </span>
    </p>
  );
}

export function PrizeRing({
  shown,
  goal,
  landings
}: {
  shown: number;
  goal: number;
  landings: number;
}) {
  const flaring = useFlare(landings);

  if (shown === 0) return null;

  /* Whole percent, because the ring is drawn in hundredths of its own path. */
  const percentFilled = Math.round((shown / goal) * 100);
  return (
    <section
      className="prize-meter"
      role="meter"
      aria-label="Letriestrellas hacia el próximo regalo"
      aria-valuenow={shown}
      aria-valuemin={0}
      aria-valuemax={goal}
      data-flaring={flaring ? "" : undefined}
    >
      {/*
        [the existing comment about pathLength moves here unchanged]
      */}
      <svg className="prize-meter__ring" viewBox="0 0 48 48" aria-hidden="true">
        <circle
          className="prize-meter__fill"
          cx="24"
          cy="24"
          r="21"
          pathLength="100"
          strokeDasharray={`${percentFilled} ${100 - percentFilled}`}
          transform="rotate(-90 24 24)"
        />
      </svg>
      <span className="prize-meter__gift" aria-hidden="true">
        <GiftShadow />
      </span>
    </section>
  );
}
```

- [ ] **Step 4: Delete the originals from `App.tsx`**

Remove the `PrizeCount` and `PrizeRing` function declarations and the doc
comment above them. Add the import beside the other local imports:

```tsx
import { PrizeCount, PrizeRing } from "./PrizeReadout";
```

Remove `GiftShadow` from the `./icons` import list — `StarIcon` stays, because
`StarAward` still uses it.

Declare the ref with the other refs near the top of `App` — not in the JSX,
where a hook may not be called:

```tsx
/* Where the stars are flying to. Measured, never derived from the stylesheet. */
const pill = useRef<HTMLParagraphElement>(null);
```

At the two call sites, pass the props the new signatures ask for. `App` has no
arrival state yet, so the truth is handed straight through and nothing flares:

```tsx
<PrizeCount
  shown={prizeView.filled}
  arriving={false}
  landings={0}
  pill={pill}
/>
```

The ring call site becomes:

```tsx
<PrizeRing shown={prizeView.filled} goal={prizeView.goal} landings={0} />
```

- [ ] **Step 5: Add the flare styles**

In `apps/player-web/src/styles.css`, beside the existing `.prize-count` block:

```css
/*
 * A landing, drawn on the thing that received it.
 *
 * A scale rather than a colour: the pill is white on a busy map, and a child
 * watching a star arrive is watching the corner, not reading it. It transitions
 * both ways from one rule, so a second star landing mid-flare simply retargets
 * the same transition instead of restarting an animation.
 */
.prize-count {
  transition: transform 180ms ease-out;
}
.prize-count[data-flaring] {
  transform: scale(1.18);
}
/* Laid out so a flight can measure it, unseen because it still says nought. */
.prize-count[data-waiting] {
  visibility: hidden;
}
```

and beside `.prize-meter__fill`:

```css
/*
 * The ring answers the same landing, brighter and a little heavier. Not a
 * `drop-shadow`: the classroom panel's fill rate is a product concern, and a
 * stroke change costs nothing.
 */
.prize-meter__fill {
  transition:
    stroke-dasharray 400ms ease-out,
    stroke 200ms ease-out,
    stroke-width 200ms ease-out;
}
.prize-meter[data-flaring] .prize-meter__fill {
  stroke: #ffe4a3;
  stroke-width: 6.5;
}
```

The existing reduced-motion block that switches off the dasharray transition
must switch off all three:

```css
@media (prefers-reduced-motion: reduce) {
  .prize-count,
  .prize-meter__fill {
    transition: none;
  }
}
```

- [ ] **Step 6: Run the tests**

```bash
pnpm --filter @lectoemocion/player-web test
```

Expected: `PrizeReadout.test.tsx` passes and every existing `App.test.tsx` case
still passes — nothing about the rendered DOM changed except the two new
`data-` attributes.

- [ ] **Step 7: Run the gate and commit**

```bash
pnpm check
git add apps/player-web/src/app/PrizeReadout.tsx \
        apps/player-web/src/app/PrizeReadout.test.tsx \
        apps/player-web/src/app/App.tsx \
        apps/player-web/src/styles.css
git commit -m "refactor(player): give the prize readout its own file and a flare"
```

---

### Task 3: the flight

**Files:**
- Modify: `apps/player-web/src/app/PrizeReadout.tsx` — add `StarFlight`
- Modify: `apps/player-web/src/app/PrizeReadout.test.tsx` — add its tests
- Modify: `apps/player-web/src/styles.css` — `.star-flight` rules

**Interfaces:**
- Consumes: `StarFlightState` from `../world/starArrival`.
- Produces: `STAR_STAGGER_MS`, `STAR_TRAVEL_MS`,
  `StarFlight({ flight, pill, onArrive, onLanded })`.

- [ ] **Step 1: Write the failing test**

Append to `apps/player-web/src/app/PrizeReadout.test.tsx`:

```tsx
describe("the flight to the counter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /*
   * The world screen is the only thing that renders this, so its mount is how
   * the reducer learns the world is on screen. Deriving that in `App` from the
   * screens that precede it would be a second copy of their ordering.
   */
  it("reports that the world has arrived, once", () => {
    const onArrive = vi.fn();
    const { rerender } = render(
      <StarFlight
        flight={null}
        pill={createRef<HTMLParagraphElement>()}
        onArrive={onArrive}
        onLanded={vi.fn()}
      />
    );
    rerender(
      <StarFlight
        flight={{ id: 1, count: 3, landed: 0 }}
        pill={createRef<HTMLParagraphElement>()}
        onArrive={onArrive}
        onLanded={vi.fn()}
      />
    );
    expect(onArrive).toHaveBeenCalledTimes(1);
  });

  it("draws one star per letriestrella still in the air", () => {
    render(
      <StarFlight
        flight={{ id: 1, count: 3, landed: 0 }}
        pill={createRef<HTMLParagraphElement>()}
        onArrive={vi.fn()}
        onLanded={vi.fn()}
      />
    );
    expect(document.querySelectorAll(".star-flight__star")).toHaveLength(3);
  });

  /* Staggered, so three stars are three arrivals rather than one. */
  it("lands them one at a time", () => {
    const onLanded = vi.fn();
    render(
      <StarFlight
        flight={{ id: 1, count: 3, landed: 0 }}
        pill={createRef<HTMLParagraphElement>()}
        onArrive={vi.fn()}
        onLanded={onLanded}
      />
    );

    act(() => {
      vi.advanceTimersByTime(STAR_TRAVEL_MS);
    });
    expect(onLanded).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(STAR_STAGGER_MS * 2);
    });
    expect(onLanded).toHaveBeenCalledTimes(3);
  });

  /* Decoration only: it must not be read out, and it must not eat a tap. */
  it("is hidden from a screen reader", () => {
    render(
      <StarFlight
        flight={{ id: 1, count: 3, landed: 0 }}
        pill={createRef<HTMLParagraphElement>()}
        onArrive={vi.fn()}
        onLanded={vi.fn()}
      />
    );
    expect(document.querySelector(".star-flight")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
  });

  it("draws nothing when nothing is in the air", () => {
    render(
      <StarFlight
        flight={null}
        pill={createRef<HTMLParagraphElement>()}
        onArrive={vi.fn()}
        onLanded={vi.fn()}
      />
    );
    expect(document.querySelector(".star-flight")).toBeNull();
  });
});
```

Add `StarFlight`, `STAR_STAGGER_MS` and `STAR_TRAVEL_MS` to the import at the
top of the file.

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm --filter @lectoemocion/player-web test -- src/app/PrizeReadout.test.tsx
```

Expected: `StarFlight is not exported`.

- [ ] **Step 3: Write the component**

Append to `apps/player-web/src/app/PrizeReadout.tsx`, and add
`useLayoutEffect` and `type CSSProperties` to the React import:

```tsx
/** Between one star setting off and the next. Three stars, three beats. */
export const STAR_STAGGER_MS = 110;
/** How long one star is on its way. */
export const STAR_TRAVEL_MS = 520;
/** How far apart the stars start, so three do not leave as one. */
const STAR_SPREAD_PX = 56;
/** Where they set off from: the middle, a little high, where the award was. */
const ORIGIN_HEIGHT = 0.42;

/**
 * The letriestrellas on their way to the corner.
 *
 * Mounted with the world and nothing else, which is what makes its mount the
 * signal that the world is on screen: `onArrive` is the whole of how the
 * reducer learns that, and `App` never has to restate the order the screens
 * come in.
 *
 * The pill is measured rather than derived. Its position is stated once, in the
 * stylesheet, in `clamp()`s that depend on the viewport — reading it back out
 * here in TypeScript would be a second copy of a geometry that is free to
 * change.
 */
export function StarFlight({
  flight,
  pill,
  onArrive,
  onLanded
}: {
  flight: StarFlightState | null;
  pill: RefObject<HTMLParagraphElement | null>;
  onArrive: () => void;
  onLanded: () => void;
}) {
  useEffect(onArrive, [onArrive]);

  if (flight === null) return null;

  /*
   * Keyed by the flight, so one flight's stars are one stable list. Without
   * the key a second flight would reuse the first's elements, inheriting the
   * transforms they had already reached.
   */
  return (
    <Flight
      key={flight.id}
      count={flight.count}
      pill={pill}
      onLanded={onLanded}
    />
  );
}

function Flight({
  count,
  pill,
  onLanded
}: {
  count: number;
  pill: RefObject<HTMLParagraphElement | null>;
  onLanded: () => void;
}) {
  const [course, setCourse] = useState<{
    readonly originX: number;
    readonly originY: number;
    readonly targetX: number;
    readonly targetY: number;
  } | null>(null);
  const [flying, setFlying] = useState(false);

  useLayoutEffect(() => {
    const box = pill.current?.getBoundingClientRect();
    /*
     * No pill to aim at means no flight — but the landings below still fire,
     * so the counter reaches the truth either way. What is lost is the
     * decoration, never the number.
     */
    if (box === undefined) return undefined;

    setCourse({
      originX: window.innerWidth / 2,
      originY: window.innerHeight * ORIGIN_HEIGHT,
      targetX: box.left + box.width / 2,
      targetY: box.top + box.height / 2
    });

    /* One frame at the origin, so there is something to transition from. */
    const frame = window.requestAnimationFrame(() => setFlying(true));
    return () => window.cancelAnimationFrame(frame);
  }, [pill]);

  useEffect(() => {
    const timers = Array.from({ length: count }, (_unused, index) =>
      window.setTimeout(onLanded, index * STAR_STAGGER_MS + STAR_TRAVEL_MS)
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [count, onLanded]);

  return (
    <div
      className="star-flight"
      aria-hidden="true"
      style={
        {
          "--star-travel": `${STAR_TRAVEL_MS}ms`
        } as CSSProperties
      }
    >
      {Array.from({ length: count }, (_unused, index) => {
        const spread = (index - (count - 1) / 2) * STAR_SPREAD_PX;
        const startX = (course?.originX ?? 0) + spread;
        const across = flying && course !== null ? course.targetX - startX : 0;
        const up = flying && course !== null ? course.targetY - course.originY : 0;
        const delay = `${index * STAR_STAGGER_MS}ms`;
        return (
          /*
            Two elements, one star. The outer one carries it sideways at a
            constant rate and the inner one lifts it with a curve of its own,
            which is what makes the path an arc rather than a diagonal — and
            both are transforms, so nothing here touches layout.
          */
          <span
            key={index}
            className="star-flight__star"
            style={{
              left: `${startX}px`,
              top: `${course?.originY ?? 0}px`,
              transitionDelay: delay,
              transform: `translateX(${across}px)`
            }}
          >
            <span
              className="star-flight__lift"
              style={{
                transitionDelay: delay,
                transform: `translateY(${up}px) scale(${flying ? 0.42 : 1})`
              }}
            >
              <StarIcon />
            </span>
          </span>
        );
      })}
    </div>
  );
}
```

Add the type import at the top of the file:

```tsx
import type { StarFlightState } from "../world/starArrival";
```

- [ ] **Step 4: Add the styles**

Append to `apps/player-web/src/styles.css`, after the reward-corner block:

```css
/*
 * The letriestrellas on their way from the middle of the screen to the counter.
 *
 * Fixed to the viewport rather than placed in the world, because it is neither
 * a screen nor part of the map: it is one second of decoration over both, and
 * it must not move when the map is panned underneath it. `pointer-events` are
 * off throughout — a star crossing the map may not swallow a tap aimed at a
 * chapter it happens to be over.
 *
 * `--star-travel` is set by the component from the same constant that schedules
 * the landings, so the drawing and the arithmetic can never disagree about how
 * long a star takes.
 */
.star-flight {
  --star-size: clamp(38px, 7vmin, 96px);
  position: fixed;
  inset: 0;
  z-index: 3;
  pointer-events: none;
}

.star-flight__star {
  position: absolute;
  width: var(--star-size);
  height: var(--star-size);
  /* Centred on its own point, so `left`/`top` name where the star *is*. */
  margin: calc(var(--star-size) / -2) 0 0 calc(var(--star-size) / -2);
  transition: transform var(--star-travel) linear;
}

/*
 * The vertical leg leads and then settles, against a horizontal leg that does
 * not — which is the whole of the arc. It shrinks on the way, arriving at the
 * size of the star already on the pill.
 */
.star-flight__lift {
  display: block;
  width: 100%;
  height: 100%;
  transition: transform var(--star-travel) cubic-bezier(0.25, 0.9, 0.45, 1);
}

/*
 * Belt and braces. The reducer schedules no flight when the preference is set,
 * so this only matters if it changes between a finish and the world returning.
 */
@media (prefers-reduced-motion: reduce) {
  .star-flight {
    display: none;
  }
}
```

- [ ] **Step 5: Run the tests**

```bash
pnpm --filter @lectoemocion/player-web test -- src/app/PrizeReadout.test.tsx
```

Expected: all pass.

- [ ] **Step 6: Run the gate and commit**

```bash
pnpm check
git add apps/player-web/src/app/PrizeReadout.tsx \
        apps/player-web/src/app/PrizeReadout.test.tsx \
        apps/player-web/src/styles.css
git commit -m "feat(player): fly the letriestrellas to the counter"
```

---

### Task 4: wire it into the world

**Files:**
- Modify: `apps/player-web/src/test/setupTests.ts` — a `matchMedia` for jsdom
- Modify: `apps/player-web/src/app/App.tsx` — the reducer, the effects, the
  call sites
- Modify: `apps/player-web/src/app/App.test.tsx` — one new case

**Interfaces:**
- Consumes: `NO_ARRIVAL`, `nextArrival`, `type Motion` from
  `../world/starArrival`; `PrizeCount`, `PrizeRing`, `StarFlight` from
  `./PrizeReadout`.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Give jsdom a motion preference**

jsdom answers every media query `false`, which would put every existing `App`
test into a race with a 740ms flight it is not testing. A headless DOM has no
compositor, so `reduce` is the truthful answer, and the one test that is about
the flight says otherwise for itself.

Add to `apps/player-web/src/test/setupTests.ts`:

```ts
/**
 * jsdom has no compositor, so `reduce` is the honest answer to every motion
 * query: nothing here can draw a transition, and a test that waited for one
 * would be waiting on a wall clock rather than on the app. A test that is
 * *about* an animation calls `preferMotion("full")` and drives it with fake
 * timers, which is the only way any of this is deterministic.
 */
export function preferMotion(motion: "full" | "reduced"): void {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches:
        motion === "reduced" && query.includes("prefers-reduced-motion: reduce"),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false
    }) as MediaQueryList;
}

beforeEach(() => preferMotion("reduced"));
```

Import `beforeEach` from `vitest` alongside `afterEach`.

- [ ] **Step 2: Write the failing test**

Add to `apps/player-web/src/app/App.test.tsx`, inside the
`describe("the letriestrellas every finish is worth")` block:

```tsx
/*
 * The counter is the child's record of what they just did, so it has to still
 * be showing the old number when they get back to the world to watch it
 * change. Three stars, three steps.
 */
it("counts the letriestrellas up one at a time on the way back", async () => {
  preferMotion("full");
  bankStars(3);
  await renderApp();
  await waitFor(() => expect(meterTotal()).toBe("3"));

  finish("El encuentro");
  await collectStars();
  await openChest();

  /* Back on the world, and the corner has not moved yet. */
  await waitFor(() =>
    expect(document.querySelectorAll(".star-flight__star")).toHaveLength(3)
  );
  expect(meterTotal()).toBe("3");

  await waitFor(() => expect(meterTotal()).toBe("4"));
  await waitFor(() => expect(meterTotal()).toBe("5"));
  await waitFor(() => expect(meterTotal()).toBe("6"));
  await waitFor(() =>
    expect(document.querySelector(".star-flight")).toBeNull()
  );
});
```

Import `preferMotion` from `../test/setupTests`.

- [ ] **Step 3: Run it and watch it fail**

```bash
pnpm --filter @lectoemocion/player-web test -- src/app/App.test.tsx -t "one at a time"
```

Expected: FAIL — no `.star-flight__star` is ever rendered, and `meterTotal()` is
`"6"` immediately.

- [ ] **Step 4: Wire the reducer into `App`**

Add to the React import: `useReducer`. Add the imports:

```tsx
import {
  NO_ARRIVAL,
  nextArrival,
  type Motion
} from "../world/starArrival";
import { PrizeCount, PrizeRing, StarFlight } from "./PrizeReadout";
```

Inside `App`, beside the other state:

```tsx
/*
 * What the corner is drawing, which is behind what the child has earned for
 * about a second after every finish. It lives here rather than on the world
 * screen because the world is unmounted for the whole ceremony — the stars,
 * the chests, the reveal, the regalo — and state inside it would be rebuilt
 * from the new truth before anyone could see the old one.
 */
const [arrival, dispatchArrival] = useReducer(nextArrival, NO_ARRIVAL);

/* Where the stars are flying to. Measured, never derived from the stylesheet. */
const pill = useRef<HTMLParagraphElement>(null);

/* Read once: a preference that changes mid-session changes nothing in flight. */
const motion: Motion = useMemo(
  () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "reduced"
      : "full",
  []
);

/*
 * Declared before the reading below, and the reading depends on `selectedId`
 * as well as on the number itself. Effects run in the order they are written,
 * so the reset lands first — and the reading that follows it is what re-seeds
 * the new child's count, including when their total happens to equal the last
 * child's and the number alone would not have changed.
 */
useEffect(() => {
  dispatchArrival({ type: "reset" });
}, [selectedId]);

useEffect(() => {
  dispatchArrival({ type: "reading", filled: prizeView.filled, motion });
}, [prizeView.filled, motion, selectedId]);

const arrive = useCallback(() => dispatchArrival({ type: "arrived" }), []);
const land = useCallback(() => dispatchArrival({ type: "landed" }), []);
```

Replace the two call sites in the world's JSX:

```tsx
<PrizeCount
  shown={arrival.shown}
  arriving={arrival.flight !== null}
  landings={arrival.landings}
  pill={pill}
/>
<StarFlight
  flight={arrival.flight}
  pill={pill}
  onArrive={arrive}
  onLanded={land}
/>
```

and inside `.world__gifts`:

```tsx
<PrizeRing
  shown={arrival.shown}
  goal={prizeView.goal}
  landings={arrival.landings}
/>
```

- [ ] **Step 5: Run the whole player suite**

```bash
pnpm --filter @lectoemocion/player-web test
```

Expected: all pass, including every pre-existing `App.test.tsx` case — they run
under `reduce`, where `shown` tracks `filled` exactly as `filled` used to.

If any fails, do not reach for a timeout: read what it asserts. A case that
observes the readout immediately after a finish and now sees the old number is
telling you `preferMotion("reduced")` did not take effect for it.

- [ ] **Step 6: Run the gate and commit**

```bash
pnpm check
git add apps/player-web/src/app/App.tsx \
        apps/player-web/src/app/App.test.tsx \
        apps/player-web/src/test/setupTests.ts
git commit -m "feat(player): land the flying letriestrellas on the counter"
```

---

### Task 5: prove it on a real browser

**Files:**
- Modify: `apps/player-web/e2e/world.spec.ts` (or whichever spec already plays a
  chapter to its end — find it with
  `grep -rln "Seguir" apps/player-web/e2e/`)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new.

- [ ] **Step 1: Write the failing test**

jsdom cannot lay anything out, so this is the only place the flight is proven
to actually reach the pill.

Read the spec first and reuse whatever it already has for starting a chapter
and finishing it — the helper names below are stand-ins for that file's own,
and inventing a second way to play a chapter is the one thing this step must
not do. The assertions are the content:

```ts
/*
 * The one place the flight is measured against a real layout: jsdom reports
 * every box as zero, so "the stars land on the pill" is a claim only a browser
 * can check.
 */
test("flies the letriestrellas into the counter", async ({ page }) => {
  await startFirstChapter(page);
  await finishActiveResource(page);
  await page.getByRole("button", { name: "Seguir" }).click();
  await page.getByRole("button", { name: "Abrir el cofre 1" }).click();
  await page.getByRole("button", { name: "Seguir" }).click();

  /* Three in the air before any of them has arrived. */
  await expect(page.locator(".star-flight__star")).toHaveCount(3);

  /* And gone again, with the corner holding what they carried. */
  await expect(page.locator(".star-flight")).toHaveCount(0);
  await expect(page.locator(".prize-count")).toHaveText(/^3/);
});
```

- [ ] **Step 2: Run it and watch it pass**

```bash
pnpm test:e2e -- --grep "flies the letriestrellas"
```

Expected: PASS on both the phone and classroom projects. The implementation is
already in place — this task exists because a browser is the only witness for
the geometry.

If it fails on the count of three, the assertion is racing the first landing:
`toHaveCount(3)` is auto-retrying, so it can only fail if the stars are never
drawn. Check that `.prize-count` exists to be measured.

- [ ] **Step 3: Run the whole e2e suite**

```bash
pnpm test:e2e
```

Expected: green, bar the known pointer-test flake recorded in
`docs/plans/ongoing/animal-book.md`. If a Phaser pointer test times out at the
120s poll, re-run that spec alone to confirm it is the flake and not this work.

- [ ] **Step 4: Commit**

```bash
git add apps/player-web/e2e
git commit -m "test(player): check the stars reach the counter in a browser"
```

---

### Task 6: leave the documentation true

**Files:**
- Modify: `apps/player-web/AGENTS.md`
- Modify: `docs/plans/ongoing/star-flight-to-the-counter.md` — the Status block

- [ ] **Step 1: Record the rule where someone will meet it**

Add to the "The world" list in `apps/player-web/AGENTS.md`, after the bullet
about ceremonies:

```markdown
- **The counter draws `shown`, not what the child has earned.** For about a
  second after a finish the two differ: the letriestrellas are still flying
  from the middle of the screen to the corner, and the number climbs as each
  one lands. `src/world/starArrival.ts` is the one place that gap is decided —
  it holds an increase until the world is back on screen, snaps rather than
  counting down when a regalo has just spent the meter, and never flies on a
  cold start or a change of player. A screen that wants the true figure reads
  `PrizeView.filled`; nothing else may grow a second opinion about what the
  corner says.
```

- [ ] **Step 2: Update the Status block**

Set **Stage** to `built and verified; merging`, **Done** to a one-paragraph
summary of what shipped, and **Next** to `merge to main, distil into ADR 0012,
delete this file`.

- [ ] **Step 3: Run the gate and commit**

```bash
pnpm check
git add apps/player-web/AGENTS.md docs/plans/ongoing/star-flight-to-the-counter.md
git commit -m "docs(player): record how the counter lags the truth"
```

---

## Finishing

From the repository root, which is already on `main`:

```bash
git merge --ff-only feat/star-flight
git worktree remove .worktrees/star-flight
git branch -d feat/star-flight
```

Then distil the rationale above into `docs/decisions/0012-prizes-and-the-star-meter.md`
— the durable part is the three rules in the table, not the task list — and
delete this file.
