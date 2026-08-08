import {
  checkPrizeGoal,
  DEFAULT_PRIZE_GOAL,
  isPrizePresetKey,
  prizeId,
  prizeImageId,
  type Prize,
  type PrizeContent,
  type PrizeId,
  type PrizeImageId
} from "@lectoemocion/domain";
import {
  awardDue,
  composePrizes,
  configurePrize,
  DEFAULT_GOAL,
  NO_GIFTS,
  openPrize,
  prizesDue,
  setGoal,
  type ChildGifts,
  type PrizeGoal,
  type PrizeMint,
  type Prizes
} from "./prizes";

/**
 * Where the prizes live.
 *
 * Async and owner-keyed for exactly the reasons `ProgressStore` is: stage 4
 * puts these in Firestore behind this interface, and the owners become real
 * ids, without a caller changing.
 */
export interface PrizeStore {
  read(): Promise<Prizes>;
  /**
   * Awards every prize the child has earned and not been given.
   *
   * `starsEarned` is a parameter rather than a second store read, because the
   * two totals live apart on purpose: stars are what a child did, prizes are
   * what adults promised, and only the caller holding both may award one.
   */
  awardDue(starsEarned: number): Promise<Prizes>;
  configure(id: PrizeId, content: PrizeContent): Promise<Prizes>;
  open(id: PrizeId): Promise<Prizes>;
  /** A goal outside the typo guard is refused and the old one stands. */
  setGoal(goal: number): Promise<Prizes>;
}

/** Where new identities and timestamps come from, so tests can name them. */
export interface Minter {
  prizeId(): PrizeId;
  /** ISO 8601, in UTC. */
  now(): string;
}

/**
 * Who a prize record belongs to.
 *
 * Two owners rather than one, because the two halves belong to different
 * people. An adult sets one goal for a family or a class; each child fills
 * their own meter against it and owns the gifts they earn — so a sibling
 * cannot see a regalo they did not earn, just as they cannot see the stars.
 *
 * Both are plain strings for the same reason `ProgressStore`'s `owner` is:
 * today `group` is the one implicit group and `child` is the playing profile's
 * id, and at the Firestore stage they become a real `GroupId` and a real child
 * id without a caller changing.
 */
export interface PrizeOwners {
  /** The family or the class the goal is set for. */
  readonly group: string;
  /** The profile whose gifts these are — the same id progress is keyed by. */
  readonly child: string;
}

/**
 * The single implicit group, as `LOCAL_OWNER` is the single implicit profile.
 *
 * A device with no account still has exactly one family or one class on it, and
 * naming that seam is what lets the goal become a real group id later without
 * every caller learning a new concept.
 */
export const LOCAL_GROUP = "local";

/** Where the group's goal lives. One line, for every child in the group. */
export function prizeGoalKey(group: string): string {
  return `lectoemocion.prizeGoal.${group}`;
}

/**
 * Where one child's gifts live, namespaced by their profile id.
 *
 * The same derivation `storageKey` makes for progress and for the same reason:
 * a gift belongs to the child who earned it, and a namespace built from
 * anything but a profile id hands it silently to a sibling.
 */
export function giftsKey(child: string): string {
  return `lectoemocion.gifts.${child}`;
}

/**
 * Identities that hold on the hardware this actually runs on.
 *
 * Not `crypto.randomUUID`: the classroom panel may be an old vendor Chromium
 * served over plain HTTP, where it is simply absent. A monotonic counter behind
 * the clock is unique on one device, which is the whole scope of this store —
 * when a group's prizes move to Firestore, Firestore mints the ids.
 */
export function systemMinter(): Minter {
  let minted = 0;
  return {
    prizeId: () => prizeId(`${Date.now().toString(36)}-${++minted}`),
    now: () => new Date().toISOString()
  };
}

/** The same counter, for images, which are stored under keys of their own. */
export function systemImageId(): PrizeImageId {
  return prizeImageId(
    `${Date.now().toString(36)}-${Math.trunc(performance.now())}`
  );
}

type MinimalStorage = Pick<Storage, "getItem" | "setItem">;

/** Anything that is not an object is not a record. */
function parseRecord(raw: string | null): Record<string, unknown> | null {
  if (raw === null) return null;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof value !== "object" || value === null) return null;
  return value as Record<string, unknown>;
}

/** The group's goal, or the default. A goal is one number and nothing else. */
function parseStoredGoal(raw: string | null): PrizeGoal {
  const record = parseRecord(raw);
  return record === null
    ? DEFAULT_GOAL
    : { goal: parseGoal(record["goal"]) };
}

/**
 * Reads one child's gifts back defensively, on the same terms as stored
 * progress: this is untrusted client state, and a corrupt entry costs one
 * prize rather than the screen. A dropped prize is one an adult can hand over
 * anyway; a thrown error is a child who cannot see any of them.
 */
function parseStoredGifts(raw: string | null): ChildGifts {
  const record = parseRecord(raw);
  return record === null ? NO_GIFTS : { prizes: parsePrizeList(record["prizes"]) };
}

/*
 * The identifier constructors throw on a string that is not an identifier —
 * empty, or padded with whitespace. Storage is untrusted, so `typeof` is not
 * enough: an unguarded call escapes the whole parse, the read falls back to an
 * empty ledger, and the next write erases every prize an adult promised.
 * Guarded, a corrupt id costs exactly what the file's contract says it costs.
 */
function parsePrizeId(value: unknown): PrizeId | null {
  if (typeof value !== "string") return null;
  try {
    return prizeId(value);
  } catch {
    return null;
  }
}

function parsePrizeImageId(value: unknown): PrizeImageId | null {
  if (typeof value !== "string") return null;
  try {
    return prizeImageId(value);
  } catch {
    return null;
  }
}

/** A goal nobody can explain reads as the default rather than as a broken meter. */
function parseGoal(value: unknown): number {
  if (typeof value !== "number") return DEFAULT_PRIZE_GOAL;
  const checked = checkPrizeGoal(value);
  return checked.ok ? checked.goal : DEFAULT_PRIZE_GOAL;
}

function parseCost(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    return null;
  }
  return value;
}

/** Content that does not name a shipped preset, or has no words, is not content. */
function parseContent(value: unknown): PrizeContent | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;

  if (record["kind"] === "preset") {
    const preset = record["preset"];
    return isPrizePresetKey(preset) ? { kind: "preset", preset } : null;
  }

  if (record["kind"] === "custom") {
    const text = record["text"];
    if (typeof text !== "string" || text.trim().length === 0) return null;
    /*
     * A corrupt image id costs the picture, not the prize: the picture is the
     * optional half, and the words are what an adult reads aloud.
     */
    return {
      kind: "custom",
      text,
      imageId: parsePrizeImageId(record["imageId"])
    };
  }

  return null;
}

function parsePrizeList(value: unknown): readonly Prize[] {
  if (!Array.isArray(value)) return [];

  const prizes: Prize[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const id = parsePrizeId(record["id"]);
    const awardedAt = record["awardedAt"];
    const costStars = parseCost(record["costStars"]);
    if (id === null || typeof awardedAt !== "string") continue;
    if (costStars === null) continue;

    const state = record["state"];
    if (state === "unconfigured") {
      prizes.push({ id, state, awardedAt, costStars });
      continue;
    }

    const content = parseContent(record["content"]);
    if (content === null) continue;

    if (state === "ready") {
      prizes.push({ id, state, awardedAt, costStars, content });
      continue;
    }

    const openedAt = record["openedAt"];
    if (state === "opened" && typeof openedAt === "string") {
      prizes.push({
        id,
        state,
        awardedAt,
        costStars,
        content,
        openedAt
      });
    }
  }
  return prizes;
}

/**
 * The two records, read and written apart, handed out composed.
 *
 * A record written before the goal and the gifts were split — one object under
 * `lectoemocion.prizes.<owner>`, belonging to the device rather than to anyone
 * on it — is read by nothing here and written by nothing. Which child earned
 * those gifts is not recorded anywhere and cannot be inferred, and a regalo
 * surfacing under the wrong child's name is the one outcome nobody can undo. It
 * is left where it is rather than deleted: a gift an adult already promised is
 * one they can still hand over, and throwing away an adult's own words and
 * photo on their behalf is not this store's call.
 */
export class LocalPrizeStore implements PrizeStore {
  private goalFallback: PrizeGoal = DEFAULT_GOAL;
  private giftsFallback: ChildGifts = NO_GIFTS;

  constructor(
    private readonly storage: MinimalStorage,
    private readonly owners: PrizeOwners,
    private readonly minter: Minter
  ) {}

  async read(): Promise<Prizes> {
    return composePrizes(this.readGoal(), this.readGifts());
  }

  async awardDue(starsEarned: number): Promise<Prizes> {
    const current = await this.read();
    const due = prizesDue(current, starsEarned);
    if (due === 0) return current;

    const mints: PrizeMint[] = Array.from({ length: due }, () => ({
      id: this.minter.prizeId(),
      at: this.minter.now()
    }));
    return this.writeGifts(awardDue(current, starsEarned, mints));
  }

  async configure(id: PrizeId, content: PrizeContent): Promise<Prizes> {
    return this.writeGifts(configurePrize(await this.read(), id, content));
  }

  async open(id: PrizeId): Promise<Prizes> {
    return this.writeGifts(openPrize(await this.read(), id, this.minter.now()));
  }

  /**
   * A goal the validator refuses leaves the old one standing.
   *
   * The form checks first and shows the adult what is wrong; this is the
   * boundary behind it, so a stale tab or a second adult cannot write a goal
   * no screen would have accepted.
   */
  async setGoal(goal: number): Promise<Prizes> {
    const current = await this.read();
    const checked = checkPrizeGoal(goal);
    if (!checked.ok) return current;
    return this.writeGoal(setGoal(current, checked.goal));
  }

  /*
   * A denied write never reaches storage, so a later read sees `null` rather
   * than an exception. Preferring the in-memory fallback whenever storage has
   * nothing keeps a session self-consistent even when every write this device
   * makes is silently dropped.
   */
  private readGoal(): PrizeGoal {
    try {
      const raw = this.storage.getItem(prizeGoalKey(this.owners.group));
      return raw === null ? this.goalFallback : parseStoredGoal(raw);
    } catch {
      /* Private browsing and locked-down panel browsers can deny storage. */
      return this.goalFallback;
    }
  }

  private readGifts(): ChildGifts {
    try {
      const raw = this.storage.getItem(giftsKey(this.owners.child));
      return raw === null ? this.giftsFallback : parseStoredGifts(raw);
    } catch {
      return this.giftsFallback;
    }
  }

  /*
   * Each half is written under its own key, so a change to one is never a
   * rewrite of the other: an adult moving the goal cannot touch a child's
   * gifts, and a gift awarded by one child cannot restate the group's line.
   */
  private writeGoal(next: Prizes): Prizes {
    this.goalFallback = { goal: next.goal };
    this.put(prizeGoalKey(this.owners.group), this.goalFallback);
    return next;
  }

  private writeGifts(next: Prizes): Prizes {
    this.giftsFallback = { prizes: next.prizes };
    this.put(giftsKey(this.owners.child), this.giftsFallback);
    return next;
  }

  private put(key: string, record: PrizeGoal | ChildGifts): void {
    try {
      this.storage.setItem(key, JSON.stringify(record));
    } catch {
      /* Same as above: an unwritable store must not break the session. */
    }
  }
}
