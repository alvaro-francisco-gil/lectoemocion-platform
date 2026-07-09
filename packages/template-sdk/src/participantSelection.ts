import type { ChildRecord } from "@lectoemocion/domain";
import type { SelectionStrategy } from "./templateDefinition";

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

export function selectParticipants(
  roster: readonly ChildRecord[],
  strategy: SelectionStrategy,
  seed: string
): ChildRecord[] {
  if (strategy.kind === "whole-class") {
    return [...roster];
  }

  if (strategy.kind === "matching-initial") {
    return roster.filter(
      (child) => child.verifiedInitial === strategy.initial
    );
  }

  if (strategy.count > roster.length) {
    throw new Error(
      `Template requires ${strategy.count} participants but only ${roster.length} are available`
    );
  }

  let state = hashSeed(seed);
  const shuffled = [...roster];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const [random, nextState] = nextRandom(state);
    state = nextState;
    const target = Math.floor(random * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target]!, shuffled[index]!];
  }
  return shuffled.slice(0, strategy.count);
}
