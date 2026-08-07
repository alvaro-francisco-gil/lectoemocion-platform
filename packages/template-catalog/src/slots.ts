import type { ChildRecord } from "@lectoemocion/domain";
import type { Character, ParticipantSlot } from "@lectoemocion/resource-schema";
import { toPersonalisedCharacter } from "./mediaUrl";

/**
 * Turns product-authored characters into slots.
 *
 * Slot identifiers are positional and stable, so a personalisation assigned to
 * `character-3` survives the cast being re-ordered in a later content update
 * only if that position keeps its meaning. Renaming a slot is therefore a
 * template version change, like any other published shape.
 */
export function toSlots(cast: readonly Character[]): ParticipantSlot[] {
  return cast.map((character, index) => ({
    slotId: `character-${index + 1}`,
    default: character
  }));
}

/**
 * Overlays a roster onto slots, slot by slot, in order.
 *
 * A roster longer than the cast simply does not fit: the resource has as many
 * slots as the product authored defaults for, and personalisation never
 * changes a resource's shape. A shorter roster leaves the remaining slots on
 * their defaults, which is the ordinary case for a half-populated class.
 */
export function personaliseSlots(
  slots: readonly ParticipantSlot[],
  roster: readonly ChildRecord[]
): ParticipantSlot[] {
  return slots.map((slot, index) => {
    const child = roster[index];
    return child
      ? { ...slot, personalised: toPersonalisedCharacter(child) }
      : slot;
  });
}
