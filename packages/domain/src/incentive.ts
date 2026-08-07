import type { CouponId, PurchaseId } from "./ids";

/**
 * A reward an adult promises and a child buys with letriestrellas.
 *
 * Deliberately not content: the catalogue ships chapters, and a coupon is
 * whatever *this* family or class can actually give — "media hora de fútbol",
 * "elegir la peli del viernes". Nothing here is shown to a child until an adult
 * has written it, so there is no default list to fall back to.
 */
export interface Coupon {
  readonly id: CouponId;
  readonly label: string;
  /** In letriestrellas. Always a whole number: a child counts stars, not halves. */
  readonly cost: number;
}

/**
 * One coupon bought, kept whole.
 *
 * `label` and `cost` are copies rather than a lookup through `couponId`. A
 * coupon is an adult's promise, and adults re-price and delete them; what a
 * child spent their stars on last Tuesday is a fact about last Tuesday and must
 * not change because the price did. The id stays so a history entry can still
 * be traced to the coupon it came from where that coupon still exists.
 */
export interface Purchase {
  readonly id: PurchaseId;
  readonly couponId: CouponId;
  readonly label: string;
  readonly cost: number;
  /** ISO 8601, in UTC. */
  readonly purchasedAt: string;
}

/** A coupon as an adult typed it, before it has an identity. */
export interface CouponDraft {
  readonly label: string;
  readonly cost: number;
}

/**
 * Long enough for a real promise, short enough to stay one line on a card a
 * child recognises by shape.
 */
export const MAX_COUPON_LABEL_LENGTH = 60;

/**
 * A coupon costs something.
 *
 * A free coupon is not a reward, it is a button, and a child who can take
 * everything at once learns nothing from the stars.
 */
export const MIN_COUPON_COST = 1;

/**
 * The ceiling is a typo guard, not a design limit: at three letriestrellas a
 * chapter, a four-figure price is a slipped keystroke rather than a promise.
 */
export const MAX_COUPON_COST = 999;

export type CouponDraftProblem =
  | "empty-label"
  | "label-too-long"
  | "cost-not-a-whole-number"
  | "cost-out-of-range";

export type CouponDraftCheck =
  | { readonly ok: true; readonly draft: CouponDraft }
  | { readonly ok: false; readonly problem: CouponDraftProblem };

/**
 * Checks what an adult typed, and says which part is wrong.
 *
 * A result rather than a thrown error, because the caller is a form: an adult
 * mid-sentence needs to be told what to fix, not to have the screen fail. Every
 * other entry point into the coupon list goes through a `CouponDraft`, so a
 * coupon that has not passed this check cannot be constructed.
 */
export function checkCouponDraft(
  label: string,
  cost: number
): CouponDraftCheck {
  const trimmed = label.trim();
  if (trimmed.length === 0) return { ok: false, problem: "empty-label" };
  if (trimmed.length > MAX_COUPON_LABEL_LENGTH) {
    return { ok: false, problem: "label-too-long" };
  }
  if (!Number.isSafeInteger(cost)) {
    return { ok: false, problem: "cost-not-a-whole-number" };
  }
  if (cost < MIN_COUPON_COST || cost > MAX_COUPON_COST) {
    return { ok: false, problem: "cost-out-of-range" };
  }
  return { ok: true, draft: { label: trimmed, cost } };
}
