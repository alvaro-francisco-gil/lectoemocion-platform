import type { ChildRecord } from "@lectoemocion/domain";
import { resolveSlot, type ManifestFor } from "@lectoemocion/resource-schema";
import { defaultCharacters } from "./fixtures/defaultCharacters";
import { personaliseSlots, toSlots } from "./slots";

/**
 * A round where the child finds every name starting with one letter.
 *
 * The cast is the whole board; `targetInitial` marks which of them to touch.
 * Personalisation overrides slots, so a personalised round may match on a
 * different set of cards than the default one — which is the point.
 */
export function createInitialsGameResource(
  initial: string,
  seed: string,
  roster: readonly ChildRecord[] = []
): ManifestFor<"initials-game"> {
  const slots = personaliseSlots(toSlots(defaultCharacters), roster);

  /*
   * Invariant 6: missing default content fails closed. A round nobody can win
   * is a content defect, not a playable resource, so it must not be built.
   */
  const matches = slots.filter(
    (slot) => resolveSlot(slot).verifiedInitial === initial
  );
  if (matches.length === 0) {
    throw new Error(`No character in this round has the initial ${initial}`);
  }

  return {
    schemaVersion: 1,
    resourceId: `initials-game-${seed}`,
    template: { id: "initials-game", version: 2, targetInitial: initial },
    seed,
    slots
  };
}
