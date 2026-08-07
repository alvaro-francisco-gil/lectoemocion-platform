import {
  EMPTY_PROGRESS,
  STARS_PER_COMPLETION,
  type ClaimedReward,
  type Progress
} from "./worldView";

/**
 * Where progress lives.
 *
 * Async because stage 4 puts Firestore behind this interface without changing
 * a single caller. `owner` is already a parameter for the same reason: today
 * it is one implicit local profile, and it becomes an account id when accounts
 * exist.
 */
export interface ProgressStore {
  read(): Promise<Progress>;
  /** Records a finish and pays its letriestrellas. Every finish is paid. */
  recordCompletion(nodeId: string): Promise<Progress>;
  /** Records the animal the child chose. The first claim for a node wins. */
  claimReward(nodeId: string, animalId: string): Promise<Progress>;
}

/** The single implicit profile that exists before accounts do. */
export const LOCAL_OWNER = "local";

export function storageKey(owner: string): string {
  return `lectoemocion.progress.${owner}`;
}

type MinimalStorage = Pick<Storage, "getItem" | "setItem">;

/**
 * Reads progress back defensively.
 *
 * Anything unrecognised degrades to what *is* recognisable rather than
 * throwing. This is not a silent fallback around a broken invariant: stored
 * client state is untrusted input that a browser, a content update, or another
 * tab can corrupt, and the honest response is to start the world again rather
 * than to lock a child out of it.
 */
function parseProgress(raw: string | null): Progress {
  if (raw === null) return EMPTY_PROGRESS;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return EMPTY_PROGRESS;
  }

  if (typeof value !== "object" || value === null) return EMPTY_PROGRESS;
  const candidate = value as Record<string, unknown>;

  const completed = candidate["completedNodes"];
  if (!Array.isArray(completed)) return EMPTY_PROGRESS;

  const lastPlayed = candidate["lastPlayedNode"];
  return {
    completedNodes: completed.filter(
      (entry): entry is string => typeof entry === "string"
    ),
    lastPlayedNode: typeof lastPlayed === "string" ? lastPlayed : null,
    rewards: parseRewards(candidate["rewards"]),
    stars: parseStars(candidate["stars"])
  };
}

/**
 * A count, or none.
 *
 * Anything else — a fraction, a negative, a number written by a tampered tab —
 * reads as no stars rather than as a total nobody can explain to a child. A
 * profile saved before letriestrellas existed lands here too, and starts at
 * zero.
 */
function parseStars(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    return 0;
  }
  return value;
}

/**
 * Same defensive stance as the rest of this file, one level deeper.
 *
 * A malformed entry is dropped rather than throwing, and dropping it simply
 * means the node's chests are offered again — the recoverable outcome.
 */
function parseRewards(value: unknown): readonly ClaimedReward[] {
  if (!Array.isArray(value)) return [];

  const rewards: ClaimedReward[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const nodeId = record["nodeId"];
    const animalId = record["animalId"];
    if (typeof nodeId !== "string" || typeof animalId !== "string") continue;
    if (rewards.some((claimed) => claimed.nodeId === nodeId)) continue;
    rewards.push({ nodeId, animalId });
  }
  return rewards;
}

export class LocalProgressStore implements ProgressStore {
  private fallback: Progress = EMPTY_PROGRESS;

  constructor(
    private readonly storage: MinimalStorage,
    private readonly owner: string
  ) {}

  async read(): Promise<Progress> {
    try {
      return parseProgress(this.storage.getItem(storageKey(this.owner)));
    } catch {
      /*
       * Private browsing and locked-down panel browsers can deny storage
       * entirely. The session still plays; it just does not persist.
       */
      return this.fallback;
    }
  }

  async recordCompletion(nodeId: string): Promise<Progress> {
    const current = await this.read();
    return this.write({
      ...current,
      completedNodes: current.completedNodes.includes(nodeId)
        ? current.completedNodes
        : [...current.completedNodes, nodeId],
      lastPlayedNode: nodeId,
      /*
       * Paid on the replay too. The node list stays a set — where a child has
       * been is not the same fact as how much they have played — so this
       * counter is the only place a second finish is recorded at all.
       */
      stars: current.stars + STARS_PER_COMPLETION
    });
  }

  /**
   * One claim per node, naming the animal the chapter grants now.
   *
   * Opening a chest is a one-off: a second claim — a double tap, a stale tab —
   * must not pay the chapter twice. A chapter grants exactly one animal, so a
   * repeat names the same one and this is simply idempotent.
   *
   * A claim naming a *different* animal is not a double tap: it can only mean a
   * content update has retired what the chapter used to grant, which is the
   * case `deriveWorldView` re-offers the chests for. Keeping the stale entry
   * would make that offer unpayable, and because the ceremony is derived from
   * storage the child would meet it again on every visit with the world
   * unreachable behind it. The stored claim follows the world.
   */
  async claimReward(nodeId: string, animalId: string): Promise<Progress> {
    const current = await this.read();
    const claimed = current.rewards.find((reward) => reward.nodeId === nodeId);
    if (claimed?.animalId === animalId) return current;

    return this.write({
      ...current,
      rewards: [
        ...current.rewards.filter((reward) => reward.nodeId !== nodeId),
        { nodeId, animalId }
      ]
    });
  }

  private write(next: Progress): Progress {
    this.fallback = next;
    try {
      this.storage.setItem(storageKey(this.owner), JSON.stringify(next));
    } catch {
      /* Same as above: an unwritable store must not break playback. */
    }
    return next;
  }
}
