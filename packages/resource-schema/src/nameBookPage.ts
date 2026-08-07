import { Type, type Static } from "@sinclair/typebox";
import { PersonalisedCharacterSchema } from "./participantSlot";

/**
 * A page of the book of names: one letter, and the children called by it.
 *
 * `names` requires at least one, which is the whole design decision made
 * unrepresentable. The book has a page only for letters somebody is actually
 * named after, so "an empty letter page" cannot be written down and then
 * filtered out later by code somebody has to remember to write.
 *
 * The names are `PersonalisedCharacter` rather than `ParticipantSlot`. A slot
 * pairs personalised content with a required default, and this template has no
 * defaults by design — a slot here would carry an invented child as the thing a
 * real one overrides.
 */
export const NameBookPageSchema = Type.Object(
  {
    pageId: Type.String({ minLength: 1 }),
    /** One letter or a digraph, exactly as `verifiedInitial` is: `A`, but also `CH`. */
    grapheme: Type.String({ minLength: 1, maxLength: 2 }),
    names: Type.Array(PersonalisedCharacterSchema, { minItems: 1, maxItems: 30 })
  },
  { additionalProperties: false }
);

export type NameBookPage = Static<typeof NameBookPageSchema>;

/**
 * What a page is called, for an adult reading a page list or a screen reader.
 *
 * Derived rather than stored, like `pageLabel` for a story page: a label that
 * disagreed with the letter its page holds is not expressible, so it cannot
 * become a defect.
 */
export function pageLetterLabel(page: NameBookPage): string {
  return `Letra ${page.grapheme}`;
}
