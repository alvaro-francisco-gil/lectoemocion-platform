import { describe, expect, it } from "vitest";
import { couponId, purchaseId, type Coupon } from "@lectoemocion/domain";
import {
  addCoupon,
  buyCoupon,
  deriveShopView,
  EMPTY_INCENTIVES,
  editCoupon,
  removeCoupon,
  starBalance,
  type Incentives
} from "./incentives";

const FOOTBALL = couponId("football");
const DESSERT = couponId("dessert");

function coupon(id: string, label: string, cost: number): Coupon {
  return { id: couponId(id), label, cost };
}

const CATALOGUE: Incentives = {
  coupons: [
    coupon("football", "30 minutos de fútbol", 12),
    coupon("dessert", "Elegir el postre", 5)
  ],
  purchases: []
};

const MINT = { id: purchaseId("purchase-1"), at: "2026-08-06T10:00:00.000Z" };

describe("the coupon list", () => {
  it("adds a coupon with the identity it is given", () => {
    const next = addCoupon(EMPTY_INCENTIVES, couponId("c1"), {
      label: "Un cuento extra",
      cost: 4
    });

    expect(next.coupons).toEqual([
      { id: "c1", label: "Un cuento extra", cost: 4 }
    ]);
  });

  it("keeps coupons in the order an adult added them", () => {
    const one = addCoupon(EMPTY_INCENTIVES, couponId("c1"), {
      label: "Primero",
      cost: 1
    });
    const two = addCoupon(one, couponId("c2"), { label: "Segundo", cost: 2 });

    expect(two.coupons.map((entry) => entry.label)).toEqual([
      "Primero",
      "Segundo"
    ]);
  });

  it("edits a coupon in place", () => {
    const next = editCoupon(CATALOGUE, FOOTBALL, {
      label: "45 minutos de fútbol",
      cost: 15
    });

    expect(next.coupons[0]).toEqual({
      id: "football",
      label: "45 minutos de fútbol",
      cost: 15
    });
    expect(next.coupons[1]).toEqual(CATALOGUE.coupons[1]);
  });

  it("removes a coupon", () => {
    const next = removeCoupon(CATALOGUE, FOOTBALL);

    expect(next.coupons.map((entry) => entry.id)).toEqual(["dessert"]);
  });

  it("leaves the list alone when the target is already gone", () => {
    const missing = couponId("gone");

    expect(editCoupon(CATALOGUE, missing, { label: "x", cost: 1 })).toEqual(
      CATALOGUE
    );
    expect(removeCoupon(CATALOGUE, missing)).toEqual(CATALOGUE);
  });
});

describe("buying a coupon", () => {
  it("records the purchase and charges the stars", () => {
    const outcome = buyCoupon(CATALOGUE, 20, FOOTBALL, MINT);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.purchase).toEqual({
      id: "purchase-1",
      couponId: "football",
      label: "30 minutos de fútbol",
      cost: 12,
      purchasedAt: "2026-08-06T10:00:00.000Z"
    });
    expect(starBalance(20, outcome.incentives)).toBe(8);
  });

  it("leaves the coupon on the shelf: a promise can be earned again", () => {
    const outcome = buyCoupon(CATALOGUE, 20, FOOTBALL, MINT);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.incentives.coupons).toEqual(CATALOGUE.coupons);
  });

  it("refuses a coupon the child cannot afford, and charges nothing", () => {
    const outcome = buyCoupon(CATALOGUE, 11, FOOTBALL, MINT);

    expect(outcome).toEqual({ ok: false, refused: "not-enough-stars" });
  });

  it("allows a coupon that costs exactly the balance", () => {
    expect(buyCoupon(CATALOGUE, 12, FOOTBALL, MINT).ok).toBe(true);
  });

  it("counts stars already spent against the next purchase", () => {
    const first = buyCoupon(CATALOGUE, 20, FOOTBALL, MINT);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = buyCoupon(first.incentives, 20, FOOTBALL, {
      id: purchaseId("purchase-2"),
      at: MINT.at
    });

    expect(second).toEqual({ ok: false, refused: "not-enough-stars" });
  });

  it("refuses a coupon that is no longer on the list", () => {
    expect(buyCoupon(CATALOGUE, 99, couponId("gone"), MINT)).toEqual({
      ok: false,
      refused: "unknown-coupon"
    });
  });
});

describe("the shop view", () => {
  it("marks which coupons the balance can actually reach", () => {
    const view = deriveShopView(CATALOGUE, 6);

    expect(view.balance).toBe(6);
    expect(
      view.items.map((item) => [item.coupon.label, item.affordable])
    ).toEqual([
      ["30 minutos de fútbol", false],
      ["Elegir el postre", true]
    ]);
  });

  it("puts the newest purchase at the top of the history", () => {
    const first = buyCoupon(CATALOGUE, 30, DESSERT, MINT);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = buyCoupon(first.incentives, 30, FOOTBALL, {
      id: purchaseId("purchase-2"),
      at: "2026-08-06T11:00:00.000Z"
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    const view = deriveShopView(second.incentives, 30);

    expect(view.history.map((entry) => entry.label)).toEqual([
      "30 minutos de fútbol",
      "Elegir el postre"
    ]);
    expect(view.spent).toBe(17);
    expect(view.balance).toBe(13);
  });

  it("still reads a purchase whose coupon was deleted afterwards", () => {
    const bought = buyCoupon(CATALOGUE, 30, FOOTBALL, MINT);
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;

    const view = deriveShopView(
      removeCoupon(bought.incentives, FOOTBALL),
      30
    );

    expect(view.items).toHaveLength(1);
    expect(view.history.map((entry) => entry.label)).toEqual([
      "30 minutos de fútbol"
    ]);
    expect(view.balance).toBe(18);
  });

  it("keeps history priced as it was bought when the coupon is re-priced", () => {
    const bought = buyCoupon(CATALOGUE, 30, FOOTBALL, MINT);
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;

    const view = deriveShopView(
      editCoupon(bought.incentives, FOOTBALL, { label: "Fútbol", cost: 1 }),
      30
    );

    expect(view.history[0]?.cost).toBe(12);
    expect(view.balance).toBe(18);
  });

  it("never reports a negative balance", () => {
    const bought = buyCoupon(CATALOGUE, 30, FOOTBALL, MINT);
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;

    /* A tampered or truncated store is the only way here; the child still plays. */
    expect(starBalance(0, bought.incentives)).toBe(0);
  });
});
