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
  configurePrize,
  EMPTY_PRIZES,
  openPrize,
  prizesDue,
  setGoal,
  type PrizeMint,
  type Prizes
} from "./prizes";

/**
 * Where the prizes live.
 *
 * Async and owner-keyed for exactly the reasons `ProgressStore` is: stage 4
 * puts a group's prizes in Firestore behind this interface, and `owner` becomes
 * the group id, without a caller changing.
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

export function prizeStorageKey(owner: string): string {
  return `lectoemocion.prizes.${owner}`;
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

/**
 * Reads the list back defensively, on the same terms as stored progress: this
 * is untrusted client state, and a corrupt entry costs one prize rather than
 * the screen. A dropped prize is one an adult can hand over anyway; a thrown
 * error is a child who cannot see any of them.
 */
function parsePrizes(raw: string | null): Prizes {
  if (raw === null) return EMPTY_PRIZES;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return EMPTY_PRIZES;
  }

  if (typeof value !== "object" || value === null) return EMPTY_PRIZES;
  const candidate = value as Record<string, unknown>;
  return {
    goal: parseGoal(candidate["goal"]),
    prizes: parsePrizeList(candidate["prizes"])
  };
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

export class LocalPrizeStore implements PrizeStore {
  private fallback: Prizes = EMPTY_PRIZES;

  constructor(
    private readonly storage: MinimalStorage,
    private readonly owner: string,
    private readonly minter: Minter
  ) {}

  async read(): Promise<Prizes> {
    try {
      const raw = this.storage.getItem(prizeStorageKey(this.owner));
      /*
       * A denied write never reaches storage, so a later read sees `null`
       * rather than an exception. Preferring the in-memory fallback whenever
       * storage has nothing keeps a session self-consistent even when every
       * write this device makes is silently dropped.
       */
      return raw === null ? this.fallback : parsePrizes(raw);
    } catch {
      /* Private browsing and locked-down panel browsers can deny storage. */
      return this.fallback;
    }
  }

  async awardDue(starsEarned: number): Promise<Prizes> {
    const current = await this.read();
    const due = prizesDue(current, starsEarned);
    if (due === 0) return current;

    const mints: PrizeMint[] = Array.from({ length: due }, () => ({
      id: this.minter.prizeId(),
      at: this.minter.now()
    }));
    return this.write(awardDue(current, starsEarned, mints));
  }

  async configure(id: PrizeId, content: PrizeContent): Promise<Prizes> {
    return this.write(configurePrize(await this.read(), id, content));
  }

  async open(id: PrizeId): Promise<Prizes> {
    return this.write(openPrize(await this.read(), id, this.minter.now()));
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
    return this.write(setGoal(current, checked.goal));
  }

  private write(next: Prizes): Prizes {
    this.fallback = next;
    try {
      this.storage.setItem(prizeStorageKey(this.owner), JSON.stringify(next));
    } catch {
      /* Same as above: an unwritable store must not break the session. */
    }
    return next;
  }
}
