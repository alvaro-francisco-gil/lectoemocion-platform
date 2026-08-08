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
   * A second arrival mid-flight — the animal book covering the world and going
   * away again, or a chapter or the adult area taking the screen and handing it
   * back — must not launch the same stars twice.
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
