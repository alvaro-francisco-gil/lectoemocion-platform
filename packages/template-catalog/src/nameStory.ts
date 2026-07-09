import type { ChildRecord } from "@lectoemocion/domain";
import type { ResourceManifest } from "@lectoemocion/resource-schema";
import { selectParticipants } from "@lectoemocion/template-sdk";

function toParticipant(child: ChildRecord) {
  return {
    childRecordId: child.id,
    displayName: child.displayName,
    verifiedInitial: child.verifiedInitial,
    photoUrl: `/synthetic/${child.photoAssetId}.svg`,
    pronunciationUrl: `/synthetic/${child.pronunciationAssetId}.mp3`
  };
}

export function createNameStoryResource(
  roster: readonly ChildRecord[],
  seed: string
): ResourceManifest {
  return {
    schemaVersion: 1,
    resourceId: `name-story-${seed}`,
    template: { id: "name-story", version: 1 },
    seed,
    participants: selectParticipants(roster, { kind: "whole-class" }, seed)
      .map(toParticipant)
  };
}
