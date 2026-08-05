import type { ChildRecord } from "@lectoemocion/domain";
import type { ManifestFor } from "@lectoemocion/resource-schema";
import { defaultCharacters } from "./fixtures/defaultCharacters";
import { personaliseSlots, toSlots } from "./slots";

/**
 * A keepsake reel: each character in turn, with no interaction.
 *
 * This is the kind personalisation flatters most — an album of the class — and
 * it must still be a complete resource with nobody in it, so it plays the
 * default cast like every other template.
 */
export function createMemoryAlbumResource(
  seed: string,
  roster: readonly ChildRecord[] = []
): ManifestFor<"memory-album"> {
  return {
    schemaVersion: 1,
    resourceId: `memory-album-${seed}`,
    template: { id: "memory-album", version: 1 },
    seed,
    slots: personaliseSlots(toSlots(defaultCharacters), roster)
  };
}
