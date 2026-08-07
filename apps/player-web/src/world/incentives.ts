import type {
  Coupon,
  CouponDraft,
  CouponId,
  Purchase,
  PurchaseId
} from "@lectoemocion/domain";

/**
 * What an adult has promised and what a child has already spent.
 *
 * Separate from `Progress` on purpose. Progress is what a child did; this is
 * what the adults around them decided a star is worth, and the two change for
 * entirely different reasons — a content update rewrites neither, an adult
 * re-pricing a coupon must not touch a single chapter.
 */
export interface Incentives {
  readonly coupons: readonly Coupon[];
  readonly purchases: readonly Purchase[];
}

export const EMPTY_INCENTIVES: Incentives = { coupons: [], purchases: [] };

/** The identity and the moment a purchase is about to be given. */
export interface PurchaseMint {
  readonly id: PurchaseId;
  /** ISO 8601, in UTC. */
  readonly at: string;
}

export function addCoupon(
  incentives: Incentives,
  id: CouponId,
  draft: CouponDraft
): Incentives {
  return {
    ...incentives,
    coupons: [...incentives.coupons, { id, ...draft }]
  };
}

/**
 * Re-writes a coupon, keeping its place in the list.
 *
 * An id the list no longer holds changes nothing. That is not a swallowed
 * failure: the only way to reach it is a screen that has gone stale — another
 * tab, or a second adult on the same account — and the honest recovery is the
 * re-read that follows, not an error about a coupon that is already gone.
 */
export function editCoupon(
  incentives: Incentives,
  id: CouponId,
  draft: CouponDraft
): Incentives {
  if (!incentives.coupons.some((coupon) => coupon.id === id)) {
    return incentives;
  }
  return {
    ...incentives,
    coupons: incentives.coupons.map((coupon) =>
      coupon.id === id ? { id, ...draft } : coupon
    )
  };
}

/**
 * Takes a coupon off the shelf.
 *
 * History is untouched, and that is the point of the snapshot inside
 * `Purchase`: a reward a child already earned is not undone by an adult
 * tidying the list.
 */
export function removeCoupon(
  incentives: Incentives,
  id: CouponId
): Incentives {
  return {
    ...incentives,
    coupons: incentives.coupons.filter((coupon) => coupon.id !== id)
  };
}

/** Every letriestrella already spent, across every purchase. */
export function starsSpent(incentives: Incentives): number {
  return incentives.purchases.reduce((total, entry) => total + entry.cost, 0);
}

/**
 * What is left to spend.
 *
 * Earned and spent are kept as two facts and the balance is derived from them,
 * so a total that only ever rises stays true — a child is never shown their
 * effort being taken away — and the history always reconciles against it.
 *
 * Floored at zero. Only a tampered or truncated store can get here, and a
 * negative number in the corner of the map is not something an adult can
 * explain to a child.
 */
export function starBalance(
  starsEarned: number,
  incentives: Incentives
): number {
  return Math.max(0, starsEarned - starsSpent(incentives));
}

export type PurchaseRefusal = "unknown-coupon" | "not-enough-stars";

export type PurchaseOutcome =
  | {
      readonly ok: true;
      readonly incentives: Incentives;
      readonly purchase: Purchase;
    }
  | { readonly ok: false; readonly refused: PurchaseRefusal };

/**
 * Spends stars on a coupon.
 *
 * Buying *is* redeeming: one entry lands in the history and the promise is
 * owed from that moment. There is no basket and no pending state, because a
 * coupon a child holds but has not used is a thing an adult has to remember,
 * and this list is the reminder.
 *
 * The coupon stays on the shelf afterwards. It is a standing offer — a child
 * who earns another twelve letriestrellas gets another half hour of football.
 *
 * Refusal is a result rather than a throw for the same reason as
 * `checkCouponDraft`: the caller is a screen a child is looking at, and it has
 * to say "todavía no" rather than fail.
 */
export function buyCoupon(
  incentives: Incentives,
  starsEarned: number,
  id: CouponId,
  mint: PurchaseMint
): PurchaseOutcome {
  const coupon = incentives.coupons.find((entry) => entry.id === id);
  if (coupon === undefined) return { ok: false, refused: "unknown-coupon" };
  if (coupon.cost > starBalance(starsEarned, incentives)) {
    return { ok: false, refused: "not-enough-stars" };
  }

  const purchase: Purchase = {
    id: mint.id,
    couponId: coupon.id,
    label: coupon.label,
    cost: coupon.cost,
    purchasedAt: mint.at
  };
  return {
    ok: true,
    purchase,
    incentives: {
      ...incentives,
      purchases: [...incentives.purchases, purchase]
    }
  };
}

export interface ShopItemView {
  readonly coupon: Coupon;
  /** Whether the balance reaches it. Refusing the tap is the rule; dimming is presentation. */
  readonly affordable: boolean;
}

export interface ShopView {
  readonly balance: number;
  readonly spent: number;
  readonly items: readonly ShopItemView[];
  /** Newest first: what a child asks about is what they just bought. */
  readonly history: readonly Purchase[];
}

/**
 * Projects the coupon list onto what a child has earned.
 *
 * Pure, and the only place that decides what is reachable — the same division
 * `deriveMapView` draws, so no screen grows its own opinion about affordability.
 */
export function deriveShopView(
  incentives: Incentives,
  starsEarned: number
): ShopView {
  const balance = starBalance(starsEarned, incentives);
  return {
    balance,
    spent: starsSpent(incentives),
    items: incentives.coupons.map((coupon) => ({
      coupon,
      affordable: coupon.cost <= balance
    })),
    history: [...incentives.purchases].reverse()
  };
}
