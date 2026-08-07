import { beforeEach, describe, expect, it } from "vitest";
import { couponId, purchaseId } from "@lectoemocion/domain";
import { EMPTY_INCENTIVES } from "./incentives";
import {
  incentiveStorageKey,
  LocalIncentiveStore,
  type Minter
} from "./incentiveStore";
import { LOCAL_OWNER } from "./progressStore";

/** Deterministic identities, so a test can name what it expects to read back. */
function testMinter(): Minter {
  let coupons = 0;
  let purchases = 0;
  return {
    couponId: () => couponId(`coupon-${++coupons}`),
    purchaseId: () => purchaseId(`purchase-${++purchases}`),
    now: () => "2026-08-06T10:00:00.000Z"
  };
}

function store(): LocalIncentiveStore {
  return new LocalIncentiveStore(localStorage, LOCAL_OWNER, testMinter());
}

const KEY = incentiveStorageKey(LOCAL_OWNER);

describe("the incentive store", () => {
  beforeEach(() => localStorage.clear());

  it("starts with nothing promised", async () => {
    await expect(store().read()).resolves.toEqual(EMPTY_INCENTIVES);
  });

  it("keeps a coupon across sessions", async () => {
    await store().addCoupon({ label: "30 minutos de fútbol", cost: 12 });

    const reopened = await store().read();
    expect(reopened.coupons).toEqual([
      { id: "coupon-1", label: "30 minutos de fútbol", cost: 12 }
    ]);
  });

  it("edits and deletes the coupon it stored", async () => {
    const kept = store();
    const added = await kept.addCoupon({ label: "Fútbol", cost: 12 });
    const id = added.coupons[0]?.id;
    expect(id).toBeDefined();
    if (id === undefined) return;

    await kept.editCoupon(id, { label: "Fútbol el sábado", cost: 8 });
    expect((await store().read()).coupons[0]).toEqual({
      id,
      label: "Fútbol el sábado",
      cost: 8
    });

    await kept.removeCoupon(id);
    expect((await store().read()).coupons).toEqual([]);
  });

  it("charges a purchase and keeps it in the history", async () => {
    const kept = store();
    const added = await kept.addCoupon({ label: "Fútbol", cost: 12 });
    const id = added.coupons[0]?.id;
    if (id === undefined) throw new Error("the coupon was not stored");

    const outcome = await kept.buy(id, 20);
    expect(outcome.ok).toBe(true);

    const reopened = await store().read();
    expect(reopened.purchases).toEqual([
      {
        id: "purchase-1",
        couponId: id,
        label: "Fútbol",
        cost: 12,
        purchasedAt: "2026-08-06T10:00:00.000Z"
      }
    ]);
  });

  it("writes nothing when a purchase is refused", async () => {
    const kept = store();
    const added = await kept.addCoupon({ label: "Fútbol", cost: 12 });
    const id = added.coupons[0]?.id;
    if (id === undefined) throw new Error("the coupon was not stored");

    expect(await kept.buy(id, 5)).toEqual({
      ok: false,
      refused: "not-enough-stars"
    });
    expect((await store().read()).purchases).toEqual([]);
  });

  it("reads an unparseable store as nothing promised", async () => {
    localStorage.setItem(KEY, "{not json");

    await expect(store().read()).resolves.toEqual(EMPTY_INCENTIVES);
  });

  it("drops malformed coupons and keeps the sound ones", async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        coupons: [
          { id: "ok", label: "Fútbol", cost: 12 },
          { id: "no-cost", label: "Sin precio" },
          { id: 7, label: "Id numérico", cost: 3 },
          { id: "fractional", label: "Media estrella", cost: 1.5 },
          { id: "negative", label: "Negativo", cost: -4 },
          "not an object"
        ],
        purchases: []
      })
    );

    expect((await store().read()).coupons).toEqual([
      { id: "ok", label: "Fútbol", cost: 12 }
    ]);
  });

  it("drops malformed purchases and keeps the sound ones", async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        coupons: [],
        purchases: [
          {
            id: "p1",
            couponId: "ok",
            label: "Fútbol",
            cost: 12,
            purchasedAt: "2026-08-06T10:00:00.000Z"
          },
          { id: "p2", couponId: "ok", label: "Sin fecha", cost: 3 }
        ]
      })
    );

    const read = await store().read();
    expect(read.purchases.map((entry) => entry.id)).toEqual(["p1"]);
  });

  it("keeps playing when storage is denied", async () => {
    const denied = new LocalIncentiveStore(
      {
        getItem: () => {
          throw new Error("denied");
        },
        setItem: () => {
          throw new Error("denied");
        }
      },
      LOCAL_OWNER,
      testMinter()
    );

    const added = await denied.addCoupon({ label: "Fútbol", cost: 12 });
    expect(added.coupons).toHaveLength(1);
    /* Unpersisted, but the session it was created in still sees it. */
    await expect(denied.read()).resolves.toEqual(added);
  });
});
