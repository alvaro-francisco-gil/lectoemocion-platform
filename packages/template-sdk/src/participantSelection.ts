import { assertNever, type ChildRecord } from "@lectoemocion/domain";
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
  switch (strategy.kind) {
    case "whole-class":
      return [...roster];
    case "matching-initial":
      return roster.filter((child) => child.verifiedInitial === strategy.initial);
    case "seeded-subset":
      return seededSubset(roster, strategy.count, seed);
    default:
      return assertNever(strategy, "selection strategy");
  }
}

function seededSubset(
  roster: readonly ChildRecord[],
  count: number,
  seed: string
): ChildRecord[] {
  if (count > roster.length) {
    throw new Error(
      `Template requires ${count} participants but only ${roster.length} are available`
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
  return shuffled.slice(0, count);
}
