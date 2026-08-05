import { EMPTY_PROGRESS, type Progress } from "./mapView";

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
  recordCompletion(nodeId: string): Promise<Progress>;
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
    lastPlayedNode: typeof lastPlayed === "string" ? lastPlayed : null
  };
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
    const next: Progress = {
      completedNodes: current.completedNodes.includes(nodeId)
        ? current.completedNodes
        : [...current.completedNodes, nodeId],
      lastPlayedNode: nodeId
    };

    this.fallback = next;
    try {
      this.storage.setItem(storageKey(this.owner), JSON.stringify(next));
    } catch {
      /* Same as above: an unwritable store must not break playback. */
    }
    return next;
  }
}
