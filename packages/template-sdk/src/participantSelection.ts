import { assertNever, type ChildRecord } from "@lectoemocion/domain";
import { seededShuffle } from "./seededRandom";
import type { SelectionStrategy } from "./templateDefinition";

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

  return seededShuffle(roster, seed).slice(0, count);
}
