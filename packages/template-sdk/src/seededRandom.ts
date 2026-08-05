/**
 * Deterministic ordering primitives.
 *
 * Preview and classroom playback must agree, so nothing here reads
 * `Math.random`, the clock, or ambient state: the same items and seed always
 * produce the same order.
 */

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (const character of seed) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function nextRandom(state: number): [number, number] {
  const next = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return [next / 2 ** 32, next];
}

export function seededShuffle<Item>(
  items: readonly Item[],
  seed: string
): Item[] {
  let state = hashSeed(seed);
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const [random, nextState] = nextRandom(state);
    state = nextState;
    const target = Math.floor(random * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target]!, shuffled[index]!];
  }
  return shuffled;
}

/**
 * Reorders so that no item keeps its original index.
 *
 * Sattolo's algorithm produces a single cycle, which has no fixed point by
 * construction. Rejection sampling — reshuffling until nothing sits in its own
 * place — would never terminate when items repeat, which is exactly the case a
 * word like `ca-ca` presents.
 */
export function seededDerangement<Item>(
  items: readonly Item[],
  seed: string
): Item[] {
  if (items.length < 2) {
    throw new Error("A derangement requires at least two items");
  }

  let state = hashSeed(seed);
  const deranged = [...items];
  for (let index = deranged.length - 1; index > 0; index -= 1) {
    const [random, nextState] = nextRandom(state);
    state = nextState;
    const target = Math.floor(random * index);
    [deranged[index], deranged[target]] = [deranged[target]!, deranged[index]!];
  }
  return deranged;
}
