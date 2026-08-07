import { prizeId, type PrizeContent } from "@lectoemocion/domain";
import { describe, expect, it } from "vitest";
import {
  awardDue,
  configurePrize,
  derivePrizeView,
  EMPTY_PRIZES,
  openPrize,
  prizesDue,
  setGoal,
  starsClaimed,
  type Prizes
} from "./prizes";

const PATIO: PrizeContent = { kind: "preset", preset: "patio" };

/** Names every prize and moment, so a test asserts on values it chose. */
function mints(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: prizeId(`p-${index + 1}`),
    at: `2026-08-0${index + 1}T10:00:00.000Z`
  }));
}

describe("prizesDue", () => {
  it("owes nothing below the goal", () => {
    expect(prizesDue(EMPTY_PRIZES, 29)).toBe(0);
  });

  it("owes one at exactly the goal", () => {
    expect(prizesDue(EMPTY_PRIZES, 30)).toBe(1);
  });

  it("owes two when two goals have gone by unawarded", () => {
    expect(prizesDue(EMPTY_PRIZES, 61)).toBe(2);
  });
});

describe("awardDue", () => {
  it("awards one unconfigured prize and consumes the goal", () => {
    const next = awardDue(EMPTY_PRIZES, 31, mints(1));
    expect(next.prizes).toHaveLength(1);
    expect(next.prizes[0]).toEqual({
      id: prizeId("p-1"),
      state: "unconfigured",
      awardedAt: "2026-08-01T10:00:00.000Z",
      costStars: 30
    });
    expect(starsClaimed(next)).toBe(30);
    expect(prizesDue(next, 31)).toBe(0);
  });

  it("queues a second prize rather than dropping the surplus", () => {
    const next = awardDue(EMPTY_PRIZES, 60, mints(2));
    expect(next.prizes).toHaveLength(2);
    expect(starsClaimed(next)).toBe(60);
  });

  it("keeps the meter filling while a prize waits", () => {
    const awarded = awardDue(EMPTY_PRIZES, 33, mints(1));
    expect(derivePrizeView(awarded, 33).filled).toBe(3);
  });
});

describe("setGoal", () => {
  it("owes a prize at once when the goal drops below what is filled", () => {
    const lowered = setGoal(EMPTY_PRIZES, 10);
    expect(prizesDue(lowered, 17)).toBe(1);
  });

  it("measures the same fill against a raised goal", () => {
    const raised = setGoal(EMPTY_PRIZES, 50);
    expect(derivePrizeView(raised, 17)).toMatchObject({ goal: 50, filled: 17 });
  });

  it("never rewrites what an earlier prize cost", () => {
    const awarded = awardDue(EMPTY_PRIZES, 30, mints(1));
    const cheaper = setGoal(awarded, 10);
    expect(cheaper.prizes[0]?.costStars).toBe(30);
    expect(starsClaimed(cheaper)).toBe(30);
  });

  it("owes nothing against a goal of zero rather than dividing by it", () => {
    const zeroed = setGoal(EMPTY_PRIZES, 0);
    expect(prizesDue(zeroed, 100)).toBe(0);
    expect(derivePrizeView(zeroed, 100)).toMatchObject({ filled: 0, due: 0 });
  });

  it("owes nothing against a negative goal and never shows a negative fill", () => {
    const negative = setGoal(EMPTY_PRIZES, -10);
    expect(prizesDue(negative, 100)).toBe(0);
    expect(derivePrizeView(negative, 100)).toMatchObject({ filled: 0, due: 0 });
  });

  it("owes nothing against a fractional goal", () => {
    const fractional = setGoal(EMPTY_PRIZES, 2.5);
    expect(prizesDue(fractional, 100)).toBe(0);
    expect(derivePrizeView(fractional, 100)).toMatchObject({ filled: 0, due: 0 });
  });
});

describe("configurePrize and openPrize", () => {
  const awarded: Prizes = awardDue(EMPTY_PRIZES, 30, mints(1));

  it("makes an unconfigured prize ready", () => {
    const ready = configurePrize(awarded, prizeId("p-1"), PATIO);
    expect(ready.prizes[0]).toMatchObject({ state: "ready", content: PATIO });
  });

  it("refuses to open a prize nobody has configured", () => {
    const untouched = openPrize(awarded, prizeId("p-1"), "2026-08-02T10:00:00.000Z");
    expect(untouched.prizes[0]?.state).toBe("unconfigured");
  });

  it("opens a ready prize once and keeps its content", () => {
    const ready = configurePrize(awarded, prizeId("p-1"), PATIO);
    const opened = openPrize(ready, prizeId("p-1"), "2026-08-02T10:00:00.000Z");
    expect(opened.prizes[0]).toMatchObject({
      state: "opened",
      content: PATIO,
      openedAt: "2026-08-02T10:00:00.000Z"
    });
  });

  it("changes nothing for an id the list no longer holds", () => {
    expect(configurePrize(awarded, prizeId("gone"), PATIO)).toBe(awarded);
  });
});

describe("derivePrizeView", () => {
  it("holds the meter at the goal rather than showing more than full", () => {
    expect(derivePrizeView(EMPTY_PRIZES, 44).filled).toBe(30);
  });

  it("lists what is waiting oldest first and what is done newest first", () => {
    const two = awardDue(EMPTY_PRIZES, 60, mints(2));
    const ready = configurePrize(two, prizeId("p-1"), PATIO);
    const opened = openPrize(ready, prizeId("p-1"), "2026-08-03T10:00:00.000Z");
    const view = derivePrizeView(opened, 60);
    expect(view.pending.map((prize) => prize.id)).toEqual([prizeId("p-2")]);
    expect(view.history.map((prize) => prize.id)).toEqual([prizeId("p-1")]);
  });

  /*
   * The map asks "is a gift waiting?" and an adult asks "which of these have I
   * still to fill in?". Those are different questions about the same prize, so
   * the view answers both rather than letting a screen re-derive one from the
   * other.
   */
  it("tells a gift still to prepare apart from one already prepared", () => {
    const two = awardDue(EMPTY_PRIZES, 60, mints(2));
    const ready = configurePrize(two, prizeId("p-1"), PATIO);
    const view = derivePrizeView(ready, 60);

    expect(view.unprepared.map((prize) => prize.id)).toEqual([prizeId("p-2")]);
    expect(view.prepared.map((prize) => prize.id)).toEqual([prizeId("p-1")]);
    expect(view.pending.map((prize) => prize.id)).toEqual([
      prizeId("p-1"),
      prizeId("p-2")
    ]);
  });

  it("counts an opened gift in none of the three waiting lists", () => {
    const one = awardDue(EMPTY_PRIZES, 30, mints(1));
    const ready = configurePrize(one, prizeId("p-1"), PATIO);
    const view = derivePrizeView(
      openPrize(ready, prizeId("p-1"), "2026-08-03T10:00:00.000Z"),
      30
    );

    expect(view.unprepared).toEqual([]);
    expect(view.prepared).toEqual([]);
    expect(view.pending).toEqual([]);
  });
});
