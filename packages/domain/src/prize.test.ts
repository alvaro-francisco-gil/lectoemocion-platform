import { describe, expect, it } from "vitest";
import {
  checkCustomPrize,
  checkPrizeGoal,
  DEFAULT_PRIZE_GOAL,
  isPrizePresetKey,
  MAX_PRIZE_GOAL,
  MAX_PRIZE_TEXT_LENGTH,
  MIN_PRIZE_GOAL
} from "./prize";

describe("checkPrizeGoal", () => {
  it("accepts the default", () => {
    expect(checkPrizeGoal(DEFAULT_PRIZE_GOAL)).toEqual({
      ok: true,
      goal: DEFAULT_PRIZE_GOAL
    });
  });

  it("accepts both ends of the range", () => {
    expect(checkPrizeGoal(MIN_PRIZE_GOAL).ok).toBe(true);
    expect(checkPrizeGoal(MAX_PRIZE_GOAL).ok).toBe(true);
  });

  it("refuses a fraction, because a child counts whole stars", () => {
    expect(checkPrizeGoal(12.5)).toEqual({
      ok: false,
      problem: "not-a-whole-number"
    });
  });

  it("refuses a goal outside the typo guard", () => {
    expect(checkPrizeGoal(MIN_PRIZE_GOAL - 1)).toEqual({
      ok: false,
      problem: "out-of-range"
    });
    expect(checkPrizeGoal(MAX_PRIZE_GOAL + 1)).toEqual({
      ok: false,
      problem: "out-of-range"
    });
  });
});

describe("checkCustomPrize", () => {
  it("trims what an adult typed", () => {
    expect(checkCustomPrize("  un helado  ")).toEqual({
      ok: true,
      text: "un helado"
    });
  });

  it("refuses text that is only whitespace", () => {
    expect(checkCustomPrize("   ")).toEqual({ ok: false, problem: "empty-text" });
  });

  it("refuses text past the one-line limit", () => {
    expect(checkCustomPrize("a".repeat(MAX_PRIZE_TEXT_LENGTH + 1))).toEqual({
      ok: false,
      problem: "text-too-long"
    });
  });
});

describe("isPrizePresetKey", () => {
  it("recognises a shipped preset", () => {
    expect(isPrizePresetKey("patio")).toBe(true);
  });

  it("rejects anything else, including a non-string", () => {
    expect(isPrizePresetKey("garaje")).toBe(false);
    expect(isPrizePresetKey(7)).toBe(false);
  });
});
