import type { ChildRecord } from "@lectoemocion/domain";
import type { ManifestFor } from "@lectoemocion/resource-schema";
import { selectParticipants } from "@lectoemocion/template-sdk";

export function createInitialsGameResource(
  roster: readonly ChildRecord[],
  initial: string,
  seed: string
): ManifestFor<"initials-game"> {
  const targets = selectParticipants(
    roster,
    { kind: "matching-initial", initial },
    seed
  );
  if (targets.length === 0) {
    throw new Error(`No participants match initial ${initial}`);
  }

  return {
    schemaVersion: 1,
    resourceId: `initials-game-${seed}`,
    template: { id: "initials-game", version: 1, targetInitial: initial },
    seed,
    participants: [...roster].map((child) => ({
      childRecordId: child.id,
      displayName: child.displayName,
      verifiedInitial: child.verifiedInitial,
      photoUrl: `/synthetic/${child.photoAssetId}.svg`,
      pronunciationUrl: `/synthetic/${child.pronunciationAssetId}.mp3`
    }))
  };
}
