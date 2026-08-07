import { describe, expect, it } from "vitest";
import {
  checkCouponDraft,
  MAX_COUPON_COST,
  MAX_COUPON_LABEL_LENGTH,
  MIN_COUPON_COST
} from "./incentive";

describe("a coupon draft", () => {
  it("accepts a reward an adult would actually promise", () => {
    expect(checkCouponDraft("30 minutos de fútbol", 12)).toEqual({
      ok: true,
      draft: { label: "30 minutos de fútbol", cost: 12 }
    });
  });

  it("trims the label, because a stray space is a typo and not a decision", () => {
    const checked = checkCouponDraft("  Elegir el postre  ", 5);
    expect(checked).toEqual({
      ok: true,
      draft: { label: "Elegir el postre", cost: 5 }
    });
  });

  it("refuses a label that is only whitespace", () => {
    expect(checkCouponDraft("   ", 5)).toEqual({
      ok: false,
      problem: "empty-label"
    });
  });

  it("refuses a label longer than a coupon card can show", () => {
    expect(checkCouponDraft("a".repeat(MAX_COUPON_LABEL_LENGTH + 1), 5)).toEqual({
      ok: false,
      problem: "label-too-long"
    });
  });

  it("accepts a label of exactly the maximum length", () => {
    const label = "a".repeat(MAX_COUPON_LABEL_LENGTH);
    expect(checkCouponDraft(label, 5)).toEqual({
      ok: true,
      draft: { label, cost: 5 }
    });
  });

  it("refuses a cost that is not a whole number of letriestrellas", () => {
    expect(checkCouponDraft("Un cuento extra", 2.5)).toEqual({
      ok: false,
      problem: "cost-not-a-whole-number"
    });
    expect(checkCouponDraft("Un cuento extra", Number.NaN)).toEqual({
      ok: false,
      problem: "cost-not-a-whole-number"
    });
  });

  it("refuses a free coupon and one nobody could ever afford", () => {
    expect(checkCouponDraft("Un cuento extra", MIN_COUPON_COST - 1)).toEqual({
      ok: false,
      problem: "cost-out-of-range"
    });
    expect(checkCouponDraft("Un cuento extra", MAX_COUPON_COST + 1)).toEqual({
      ok: false,
      problem: "cost-out-of-range"
    });
  });

  it("accepts both ends of the price range", () => {
    expect(checkCouponDraft("Barato", MIN_COUPON_COST).ok).toBe(true);
    expect(checkCouponDraft("Caro", MAX_COUPON_COST).ok).toBe(true);
  });
});
