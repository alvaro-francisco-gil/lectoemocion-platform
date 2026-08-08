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
