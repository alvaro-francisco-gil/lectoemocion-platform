import type { ChildRecordId, MediaAssetId } from "./ids";

export interface ChildRecord {
  id: ChildRecordId;
  displayName: string;
  verifiedInitial: string;
  photoAssetId: MediaAssetId;
  pronunciationAssetId: MediaAssetId;
}
