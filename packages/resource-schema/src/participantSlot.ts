import { Type, type Static } from "@sinclair/typebox";

/**
 * A character a template can show: a name, its verified initial, a picture, and
 * a pronunciation recording.
 *
 * Product-authored defaults and personalised children are the same shape, so a
 * template renders one path rather than branching on where the content came
 * from. Only the personalised variant carries a `childRecordId`, because only
 * it can be deleted.
 */
export const CharacterSchema = Type.Object(
  {
    displayName: Type.String({ minLength: 1, maxLength: 80 }),
    verifiedInitial: Type.String({ minLength: 1, maxLength: 2 }),
    photoUrl: Type.String({ minLength: 1 }),
    pronunciationUrl: Type.String({ minLength: 1 })
  },
  { additionalProperties: false }
);

export const PersonalisedCharacterSchema = Type.Object(
  {
    childRecordId: Type.String({ minLength: 1 }),
    ...CharacterSchema.properties
  },
  { additionalProperties: false }
);

/**
 * A personalisation slot and the content it falls back to, as one object.
 *
 * `default` is required, so "a slot without a default" has no representation:
 * it is a compile error at every construction site rather than a validation
 * failure discovered at runtime. This is the shape AGENTS.md "Make illegal
 * states unrepresentable" names explicitly.
 */
export const ParticipantSlotSchema = Type.Object(
  {
    slotId: Type.String({ minLength: 1 }),
    default: CharacterSchema,
    personalised: Type.Optional(PersonalisedCharacterSchema)
  },
  { additionalProperties: false }
);

export type Character = Static<typeof CharacterSchema>;
export type PersonalisedCharacter = Static<typeof PersonalisedCharacterSchema>;
export type ParticipantSlot = Static<typeof ParticipantSlotSchema>;

/**
 * Invariant 6's one declared exception, expressed as a total function.
 *
 * Missing personalised media falls back to default content and playback
 * continues. The return type is `Character`, never `Character | undefined`, so
 * a caller cannot skip the fallback: there is no code path that yields
 * nothing.
 */
export function resolveSlot(slot: ParticipantSlot): Character {
  return slot.personalised ?? slot.default;
}
