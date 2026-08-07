import type { ChildRecord, MediaAssetId } from "@lectoemocion/domain";
import type { PersonalisedCharacter } from "@lectoemocion/resource-schema";

/**
 * Where a child's media is served from — the one place that decides.
 *
 * Today every asset is synthetic and committed under
 * `apps/player-web/public/synthetic/`, written by
 * `scripts/generate-synthetic-cast.mjs`. When adults can upload a photo and a
 * recording, these two functions are what changes, and nothing else: every
 * template reaches a child's media through `toPersonalisedCharacter` below.
 *
 * Ids are escaped rather than interpolated raw. A media asset id is a path
 * segment, and a path segment that can contain a slash can leave the directory
 * it was meant to name.
 */
const SYNTHETIC_MEDIA = "/synthetic";

export function photoUrl(assetId: MediaAssetId): string {
  return `${SYNTHETIC_MEDIA}/${encodeURIComponent(assetId)}.svg`;
}

export function pronunciationUrl(assetId: MediaAssetId): string {
  return `${SYNTHETIC_MEDIA}/${encodeURIComponent(assetId)}.mp3`;
}

/**
 * A child record as a template sees them.
 *
 * `verifiedInitial` is copied, never derived. It is the letter an adult
 * confirmed, and for `Chema` under `CH` — or for a name whose spelling and
 * sound disagree — deriving it here would silently overrule that adult in the
 * one place a child is being taught their own letter.
 */
export function toPersonalisedCharacter(child: ChildRecord): PersonalisedCharacter {
  return {
    childRecordId: child.id,
    displayName: child.displayName,
    verifiedInitial: child.verifiedInitial,
    photoUrl: photoUrl(child.photoAssetId),
    pronunciationUrl: pronunciationUrl(child.pronunciationAssetId)
  };
}
