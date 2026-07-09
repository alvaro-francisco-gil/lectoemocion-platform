export type ChildRecordId = string;

export interface ChildRecord {
  id: ChildRecordId;
  displayName: string;
  verifiedInitial: string;
  photoAssetId: string;
  pronunciationAssetId: string;
}
