import { Type, type Static } from "@sinclair/typebox";

const page = {
  pageId: Type.String({ minLength: 1 }),
  imageUrl: Type.String({ minLength: 1 }),
  /** The page read aloud. A story page without its voice is a blank page. */
  audioUrl: Type.String({ minLength: 1 })
};

/**
 * A page of an illustrated story, as one of two kinds.
 *
 * A union rather than one object with optional letter fields, so "a cover that
 * teaches Ñ" and "a letter page that teaches nothing" have no representation.
 * The alternative — `grapheme?: string` — would push that check to a runtime
 * test somebody has to remember to write.
 */
export const StoryPageSchema = Type.Union([
  Type.Object({ ...page, kind: Type.Literal("cover") }, { additionalProperties: false }),
  Type.Object(
    {
      ...page,
      kind: Type.Literal("letter"),
      /** One letter or a digraph: `C`, but also `CH` and `LL`. */
      grapheme: Type.String({ minLength: 1, maxLength: 2 }),
      /**
       * Which sound, where the grapheme alone does not say.
       *
       * Spanish `C` gets two pages — /K/ in *casa* and /Z/ in *cielo* — and
       * they are different lessons on different pages. Absent wherever the
       * letter has only one sound, so a page never carries a distinction
       * there is nothing to distinguish from.
       */
      sound: Type.Optional(Type.String({ minLength: 1, maxLength: 8 }))
    },
    { additionalProperties: false }
  )
]);

export type StoryPage = Static<typeof StoryPageSchema>;

/**
 * What a page is called, for an adult reading a page list or a screen reader.
 *
 * Derived rather than stored, like `vocabularyWord`: a label that disagreed
 * with the letter its page teaches is not expressible, so it cannot become a
 * defect.
 */
export function pageLabel(page: StoryPage): string {
  if (page.kind === "cover") return "Portada";
  return page.sound === undefined
    ? `Letra ${page.grapheme}`
    : `Letra ${page.grapheme} (sonido /${page.sound}/)`;
}
