import { Type, type Static } from "@sinclair/typebox";
import Ajv from "ajv";
import { ParticipantSlotSchema } from "./participantSlot";
import { StoryPageSchema } from "./storyPage";

/**
 * A picture and the syllable sequence that spells its word.
 *
 * The word is derived (`vocabularyWord`), never stored: a word that disagrees
 * with its own syllabification is not expressible, so it cannot become a
 * defect.
 */
const vocabularyItem = (minimumSyllables: number) =>
  Type.Object(
    {
      vocabularyItemId: Type.String({ minLength: 1 }),
      syllables: Type.Array(Type.String({ minLength: 1 }), {
        minItems: minimumSyllables
      }),
      imageUrl: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
  );

export const VocabularyItemSchema = vocabularyItem(1);

/** A syllables round needs something to segment, so one syllable is invalid. */
export const MultiSyllableVocabularyItemSchema = vocabularyItem(2);

export type VocabularyItem = Static<typeof VocabularyItemSchema>;

export function vocabularyWord(item: VocabularyItem): string {
  return item.syllables.join("");
}

const envelope = {
  schemaVersion: Type.Literal(1),
  resourceId: Type.String({ minLength: 1 }),
  seed: Type.String({ minLength: 1 })
};

/**
 * Roster templates carry slots, not children. Every slot has product-authored
 * default content, so these templates play with no uploads and personalisation
 * overrides slot by slot.
 */
const slots = Type.Array(ParticipantSlotSchema, {
  minItems: 1,
  maxItems: 30
});

/**
 * Each template is its own manifest branch carrying exactly the content it
 * plays. A roster resource cannot hold vocabulary and a vocabulary resource
 * cannot hold participants — those states are unrepresentable rather than
 * rejected by a runtime check.
 */
export const NameStoryManifestSchema = Type.Object(
  {
    ...envelope,
    template: Type.Object(
      { id: Type.Literal("name-story"), version: Type.Literal(2) },
      { additionalProperties: false }
    ),
    slots
  },
  { additionalProperties: false }
);

export const InitialsGameManifestSchema = Type.Object(
  {
    ...envelope,
    template: Type.Object(
      {
        id: Type.Literal("initials-game"),
        version: Type.Literal(2),
        targetInitial: Type.String({ minLength: 1, maxLength: 2 })
      },
      { additionalProperties: false }
    ),
    slots
  },
  { additionalProperties: false }
);

/**
 * The non-interactive kind (platform-design.md §6.3): a fixed timeline that
 * shows each slot in turn. It is rendered at playback time rather than encoded
 * as a video, and it is deliberately not exportable, downloadable, or
 * shareable — it plays inside the application only.
 */
export const MemoryAlbumManifestSchema = Type.Object(
  {
    ...envelope,
    template: Type.Object(
      { id: Type.Literal("memory-album"), version: Type.Literal(1) },
      { additionalProperties: false }
    ),
    slots
  },
  { additionalProperties: false }
);

export const PairsGameManifestSchema = Type.Object(
  {
    ...envelope,
    template: Type.Object(
      { id: Type.Literal("pairs-game"), version: Type.Literal(1) },
      { additionalProperties: false }
    ),
    vocabulary: Type.Array(VocabularyItemSchema, { minItems: 2, maxItems: 8 })
  },
  { additionalProperties: false }
);

export const WordPictureGameManifestSchema = Type.Object(
  {
    ...envelope,
    template: Type.Object(
      {
        id: Type.Literal("word-picture-game"),
        version: Type.Literal(1),
        targetVocabularyItemId: Type.String({ minLength: 1 })
      },
      { additionalProperties: false }
    ),
    vocabulary: Type.Array(VocabularyItemSchema, { minItems: 2, maxItems: 6 })
  },
  { additionalProperties: false }
);

/**
 * Match each picture to the letter its word begins with.
 *
 * Three or four pictures: the whole board has to be readable at once by a
 * child who is still learning that a word *has* a first letter, and a fifth
 * column turns that into a search. Which pictures may sit together is a rules
 * question rather than a schema one — two words sharing an initial would make
 * a letter card match two pictures — so `assertDistinctInitials` in
 * `@lectoemocion/template-sdk` is what refuses that, on the derived word.
 */
export const InitialLetterGameManifestSchema = Type.Object(
  {
    ...envelope,
    template: Type.Object(
      { id: Type.Literal("initial-letter-game"), version: Type.Literal(1) },
      { additionalProperties: false }
    ),
    vocabulary: Type.Array(VocabularyItemSchema, { minItems: 3, maxItems: 4 })
  },
  { additionalProperties: false }
);

export const SyllablesGameManifestSchema = Type.Object(
  {
    ...envelope,
    template: Type.Object(
      { id: Type.Literal("syllables-game"), version: Type.Literal(1) },
      { additionalProperties: false }
    ),
    vocabulary: Type.Array(MultiSyllableVocabularyItemSchema, {
      minItems: 1,
      maxItems: 1
    })
  },
  { additionalProperties: false }
);

/**
 * Find the picture whose word opens with the same syllable as the target's.
 *
 * Four items: the target and the three choices among which it is matched. The
 * count is pinned by the schema rather than passed by a caller, so a round with
 * two pictures below or with five is not expressible.
 *
 * Which choice is right is *named*, never positional — the vocabulary is
 * shuffled by seed and its order carries no meaning. What the schema cannot
 * state, that the match shares the target's opening syllable and the
 * distractors do not, is asserted by the rules
 * (`createInitialSyllableRound`), which run both while a world is authored and
 * when a round is built.
 */
export const InitialSyllableGameManifestSchema = Type.Object(
  {
    ...envelope,
    template: Type.Object(
      {
        id: Type.Literal("initial-syllable-game"),
        version: Type.Literal(1),
        targetVocabularyItemId: Type.String({ minLength: 1 }),
        matchVocabularyItemId: Type.String({ minLength: 1 })
      },
      { additionalProperties: false }
    ),
    vocabulary: Type.Array(VocabularyItemSchema, { minItems: 4, maxItems: 4 })
  },
  { additionalProperties: false }
);

/**
 * Spell a pictured word from its letters.
 *
 * One target, like the syllables game. The letters are derived from the word,
 * which is itself derived from the syllables, so the manifest cannot carry a
 * spelling that disagrees with the word it spells. How long a word this game
 * will accept is therefore a rules check rather than a schema one — see
 * `assertSpellable` in `@lectoemocion/template-sdk`.
 */
export const LettersGameManifestSchema = Type.Object(
  {
    ...envelope,
    template: Type.Object(
      { id: Type.Literal("letters-game"), version: Type.Literal(1) },
      { additionalProperties: false }
    ),
    vocabulary: Type.Array(VocabularyItemSchema, { minItems: 1, maxItems: 1 })
  },
  { additionalProperties: false }
);

/**
 * An illustrated story, read aloud page by page.
 *
 * The cinematic kind, and the first template whose content is a *book* rather
 * than a cast or a word list: it carries neither slots nor vocabulary, because
 * its pages are the whole resource. `El gallo Rayo` is the one that ships
 * (docs/migration/gallo-rayo-app.md), but nothing here is about that book —
 * a second title is another manifest, not another template.
 *
 * Deliberately not exportable, downloadable, or shareable: like the memory
 * album, it plays inside the application only.
 */
export const IllustratedStoryManifestSchema = Type.Object(
  {
    ...envelope,
    template: Type.Object(
      { id: Type.Literal("illustrated-story"), version: Type.Literal(1) },
      { additionalProperties: false }
    ),
    pages: Type.Array(StoryPageSchema, { minItems: 1, maxItems: 60 })
  },
  { additionalProperties: false }
);

export const ResourceManifestSchema = Type.Union([
  NameStoryManifestSchema,
  IllustratedStoryManifestSchema,
  InitialsGameManifestSchema,
  MemoryAlbumManifestSchema,
  PairsGameManifestSchema,
  WordPictureGameManifestSchema,
  InitialLetterGameManifestSchema,
  SyllablesGameManifestSchema,
  InitialSyllableGameManifestSchema,
  LettersGameManifestSchema
]);

export type ResourceManifest = Static<typeof ResourceManifestSchema>;

export type TemplateIdentifier = ResourceManifest["template"]["id"];

export type ManifestFor<Id extends TemplateIdentifier> = Extract<
  ResourceManifest,
  { template: { id: Id } }
>;

/**
 * Narrows a manifest to one template.
 *
 * TypeScript does not narrow a union through a nested discriminant, so
 * `manifest.template.id === "pairs-game"` alone leaves `manifest` unnarrowed.
 * This guard restores that, and its false branch narrows to the remaining
 * templates — so a chain of guards ends at `never`, and `assertNever` there
 * proves every template is handled.
 */
export function isTemplate<Id extends TemplateIdentifier>(
  manifest: ResourceManifest,
  id: Id
): manifest is ManifestFor<Id> {
  return manifest.template.id === id;
}

const validate = new Ajv({ allErrors: true }).compile(ResourceManifestSchema);

export function parseResourceManifest(value: unknown): ResourceManifest {
  if (!validate(value)) {
    throw new Error(
      `Invalid resource manifest: ${JSON.stringify(validate.errors)}`
    );
  }
  return value as ResourceManifest;
}
