declare const brand: unique symbol;

/**
 * A nominal type. Two `Branded<string, ...>` types are mutually unassignable
 * even though both are strings at runtime, so an identifier cannot be passed
 * where a different kind of identifier is expected.
 */
export type Branded<Value, Name extends string> = Value & {
  readonly [brand]: Name;
};

export type AccountId = Branded<string, "AccountId">;
export type ChildRecordId = Branded<string, "ChildRecordId">;
export type GroupId = Branded<string, "GroupId">;
export type MediaAssetId = Branded<string, "MediaAssetId">;
export type PrizeId = Branded<string, "PrizeId">;
export type PrizeImageId = Branded<string, "PrizeImageId">;
export type ResourceId = Branded<string, "ResourceId">;
export type TemplateId = Branded<string, "TemplateId">;
export type VocabularyItemId = Branded<string, "VocabularyItemId">;
export type PlayerProfileId = Branded<string, "PlayerProfileId">;
export type AvatarId = Branded<string, "AvatarId">;

function requireNonEmpty(kind: string, value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${kind} must not be empty`);
  }
  if (trimmed !== value) {
    throw new Error(`${kind} must not have surrounding whitespace`);
  }
  return value;
}

export function accountId(value: string): AccountId {
  return requireNonEmpty("AccountId", value) as AccountId;
}

export function childRecordId(value: string): ChildRecordId {
  return requireNonEmpty("ChildRecordId", value) as ChildRecordId;
}

export function groupId(value: string): GroupId {
  return requireNonEmpty("GroupId", value) as GroupId;
}

export function mediaAssetId(value: string): MediaAssetId {
  return requireNonEmpty("MediaAssetId", value) as MediaAssetId;
}

export function prizeId(value: string): PrizeId {
  return requireNonEmpty("PrizeId", value) as PrizeId;
}

export function prizeImageId(value: string): PrizeImageId {
  return requireNonEmpty("PrizeImageId", value) as PrizeImageId;
}

export function resourceId(value: string): ResourceId {
  return requireNonEmpty("ResourceId", value) as ResourceId;
}

export function templateId(value: string): TemplateId {
  return requireNonEmpty("TemplateId", value) as TemplateId;
}

export function vocabularyItemId(value: string): VocabularyItemId {
  return requireNonEmpty("VocabularyItemId", value) as VocabularyItemId;
}

export function playerProfileId(value: string): PlayerProfileId {
  return requireNonEmpty("PlayerProfileId", value) as PlayerProfileId;
}

export function avatarId(value: string): AvatarId {
  return requireNonEmpty("AvatarId", value) as AvatarId;
}
