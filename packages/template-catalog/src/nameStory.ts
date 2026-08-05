import type { ChildRecord } from "@lectoemocion/domain";
import type { ManifestFor } from "@lectoemocion/resource-schema";
import { defaultCharacters } from "./fixtures/defaultCharacters";
import { personaliseSlots, toSlots } from "./slots";

/**
 * A story chapter built on the default cast.
 *
 * The roster is optional because personalisation is an enhancement, never a
 * prerequisite: with no roster this plays the product-authored characters, and
 * each child record supplied overrides one slot.
 */
export function createNameStoryResource(
  seed: string,
  roster: readonly ChildRecord[] = []
): ManifestFor<"name-story"> {
  return {
    schemaVersion: 1,
    resourceId: `name-story-${seed}`,
    template: { id: "name-story", version: 2 },
    seed,
    slots: personaliseSlots(toSlots(defaultCharacters), roster)
  };
}
