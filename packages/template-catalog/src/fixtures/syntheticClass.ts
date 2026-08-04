import {
  childRecordId,
  mediaAssetId,
  type ChildRecord
} from "@lectoemocion/domain";

function syntheticChild(
  id: string,
  displayName: string,
  verifiedInitial: string
): ChildRecord {
  return {
    id: childRecordId(id),
    displayName,
    verifiedInitial,
    photoAssetId: mediaAssetId(`avatar-${id}`),
    pronunciationAssetId: mediaAssetId(`silent-${id}`)
  };
}

export const syntheticClass: readonly ChildRecord[] = [
  syntheticChild("ana", "Ana", "A"),
  syntheticChild("alex", "Álex", "A"),
  syntheticChild("bruno", "Bruno", "B"),
  syntheticChild("luna", "Luna", "L")
];
