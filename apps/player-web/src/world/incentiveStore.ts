import {
  couponId,
  purchaseId,
  type Coupon,
  type CouponDraft,
  type CouponId,
  type Purchase,
  type PurchaseId
} from "@lectoemocion/domain";
import {
  addCoupon,
  buyCoupon,
  editCoupon,
  EMPTY_INCENTIVES,
  removeCoupon,
  type Incentives,
  type PurchaseOutcome
} from "./incentives";

/**
 * Where the coupons live.
 *
 * Async and owner-keyed for exactly the reasons `ProgressStore` is: stage 4
 * puts a group's coupon list in Firestore behind this interface, and `owner`
 * becomes the group id, without a caller changing.
 */
export interface IncentiveStore {
  read(): Promise<Incentives>;
  addCoupon(draft: CouponDraft): Promise<Incentives>;
  editCoupon(id: CouponId, draft: CouponDraft): Promise<Incentives>;
  removeCoupon(id: CouponId): Promise<Incentives>;
  /**
   * Spends the child's balance on a coupon.
   *
   * `starsEarned` is a parameter rather than a second store read, because the
   * two totals live apart on purpose: stars are what a child did, coupons are
   * what adults promised, and only the caller holding both may price a
   * purchase.
   */
  buy(id: CouponId, starsEarned: number): Promise<PurchaseOutcome>;
}

/** Where new identities and timestamps come from, so tests can name them. */
export interface Minter {
  couponId(): CouponId;
  purchaseId(): PurchaseId;
  /** ISO 8601, in UTC. */
  now(): string;
}

export function incentiveStorageKey(owner: string): string {
  return `lectoemocion.incentives.${owner}`;
}

/**
 * Identities that hold on the hardware this actually runs on.
 *
 * Not `crypto.randomUUID`: the classroom panel may be an old vendor Chromium
 * served over plain HTTP, where it is simply absent. A monotonic counter behind
 * the clock is unique on one device, which is the whole scope of this store —
 * when a group's coupons move to Firestore, Firestore mints the ids.
 */
export function systemMinter(): Minter {
  let minted = 0;
  const next = (): string => `${Date.now().toString(36)}-${++minted}`;
  return {
    couponId: () => couponId(next()),
    purchaseId: () => purchaseId(next()),
    now: () => new Date().toISOString()
  };
}

type MinimalStorage = Pick<Storage, "getItem" | "setItem">;

/**
 * Reads the list back defensively, on the same terms as stored progress: this
 * is untrusted client state, and a corrupt entry costs a coupon rather than the
 * screen. A dropped coupon is one an adult can write again; a thrown error is a
 * child who cannot see any of them.
 */
function parseIncentives(raw: string | null): Incentives {
  if (raw === null) return EMPTY_INCENTIVES;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return EMPTY_INCENTIVES;
  }

  if (typeof value !== "object" || value === null) return EMPTY_INCENTIVES;
  const candidate = value as Record<string, unknown>;
  return {
    coupons: parseCoupons(candidate["coupons"]),
    purchases: parsePurchases(candidate["purchases"])
  };
}

/** A price a child can count: a whole number of letriestrellas, at least one. */
function parseCost(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    return null;
  }
  return value;
}

function parseCoupons(value: unknown): readonly Coupon[] {
  if (!Array.isArray(value)) return [];

  const coupons: Coupon[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const id = record["id"];
    const label = record["label"];
    const cost = parseCost(record["cost"]);
    if (typeof id !== "string" || typeof label !== "string") continue;
    if (cost === null) continue;
    coupons.push({ id: couponId(id), label, cost });
  }
  return coupons;
}

function parsePurchases(value: unknown): readonly Purchase[] {
  if (!Array.isArray(value)) return [];

  const purchases: Purchase[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const id = record["id"];
    const coupon = record["couponId"];
    const label = record["label"];
    const purchasedAt = record["purchasedAt"];
    const cost = parseCost(record["cost"]);
    if (typeof id !== "string" || typeof coupon !== "string") continue;
    if (typeof label !== "string" || typeof purchasedAt !== "string") continue;
    if (cost === null) continue;
    purchases.push({
      id: purchaseId(id),
      couponId: couponId(coupon),
      label,
      cost,
      purchasedAt
    });
  }
  return purchases;
}

export class LocalIncentiveStore implements IncentiveStore {
  private fallback: Incentives = EMPTY_INCENTIVES;

  constructor(
    private readonly storage: MinimalStorage,
    private readonly owner: string,
    private readonly minter: Minter
  ) {}

  async read(): Promise<Incentives> {
    try {
      return parseIncentives(
        this.storage.getItem(incentiveStorageKey(this.owner))
      );
    } catch {
      /* Private browsing and locked-down panel browsers can deny storage. */
      return this.fallback;
    }
  }

  async addCoupon(draft: CouponDraft): Promise<Incentives> {
    return this.write(
      addCoupon(await this.read(), this.minter.couponId(), draft)
    );
  }

  async editCoupon(id: CouponId, draft: CouponDraft): Promise<Incentives> {
    return this.write(editCoupon(await this.read(), id, draft));
  }

  async removeCoupon(id: CouponId): Promise<Incentives> {
    return this.write(removeCoupon(await this.read(), id));
  }

  /** A refused purchase writes nothing: nothing about the list changed. */
  async buy(id: CouponId, starsEarned: number): Promise<PurchaseOutcome> {
    const outcome = buyCoupon(await this.read(), starsEarned, id, {
      id: this.minter.purchaseId(),
      at: this.minter.now()
    });
    if (!outcome.ok) return outcome;
    return { ...outcome, incentives: this.write(outcome.incentives) };
  }

  private write(next: Incentives): Incentives {
    this.fallback = next;
    try {
      this.storage.setItem(
        incentiveStorageKey(this.owner),
        JSON.stringify(next)
      );
    } catch {
      /* Same as above: an unwritable store must not break the session. */
    }
    return next;
  }
}
