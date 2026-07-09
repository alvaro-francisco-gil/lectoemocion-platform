import { Type, type Static } from "@sinclair/typebox";
import Ajv from "ajv";

export const ParticipantSchema = Type.Object(
  {
    childRecordId: Type.String({ minLength: 1 }),
    displayName: Type.String({ minLength: 1, maxLength: 80 }),
    verifiedInitial: Type.String({ minLength: 1, maxLength: 2 }),
    photoUrl: Type.String({ minLength: 1 }),
    pronunciationUrl: Type.String({ minLength: 1 })
  },
  { additionalProperties: false }
);

export const ResourceManifestSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    resourceId: Type.String({ minLength: 1 }),
    template: Type.Union([
      Type.Object(
        {
          id: Type.Literal("name-story"),
          version: Type.Literal(1)
        },
        { additionalProperties: false }
      ),
      Type.Object(
        {
          id: Type.Literal("initials-game"),
          version: Type.Literal(1),
          targetInitial: Type.String({ minLength: 1, maxLength: 2 })
        },
        { additionalProperties: false }
      )
    ]),
    seed: Type.String({ minLength: 1 }),
    participants: Type.Array(ParticipantSchema, {
      minItems: 1,
      maxItems: 30
    })
  },
  { additionalProperties: false }
);

export type ResourceManifest = Static<typeof ResourceManifestSchema>;

const validate = new Ajv({ allErrors: true }).compile(ResourceManifestSchema);

export function parseResourceManifest(value: unknown): ResourceManifest {
  if (!validate(value)) {
    throw new Error(
      `Invalid resource manifest: ${JSON.stringify(validate.errors)}`
    );
  }
  return value as ResourceManifest;
}
