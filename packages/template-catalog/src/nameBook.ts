import type { ChildRecord } from "@lectoemocion/domain";
import type {
  ManifestFor,
  NameBookPage,
  PersonalisedCharacter
} from "@lectoemocion/resource-schema";
import { toPersonalisedCharacter } from "./mediaUrl";

/**
 * The one alphabet in this repository.
 *
 * `Intl.Collator("es")` already knows that `Ñ` follows `N` and that `Á` sorts
 * under `A` without losing its accent on screen. Writing the letters out as a
 * list would be a second, drifting answer to a question the platform has
 * already settled — and the first name it got wrong would be a child's own.
 */
const spanish = new Intl.Collator("es", { sensitivity: "variant" });

/**
 * El libro de los nombres: the class's own names, a letter to a page.
 *
 * Pages exist only for letters somebody is named after, so a class of twenty
 * gives a book of however many letters they happen to use. Both orderings —
 * the pages, and the names within a page — go through the same collator.
 *
 * Grouping is on `verifiedInitial`, the letter an adult confirmed, and never on
 * the first character of the name. `Chema` is verified under `CH`; deriving the
 * letter here would file them under `C` and quietly overrule the adult, in the
 * one place a child is being taught their own letter.
 */
export function createNameBookResource(
  roster: readonly ChildRecord[],
  seed: string
): ManifestFor<"name-book"> {
  /*
   * There is no default cast to fall back to, by design: a book of default
   * names would be a book of invented children. So an empty roster is
   * invariant 6's fail-closed case, and the world gates the chapter
   * (`templateNeedsRoster`) rather than letting it be built and come out empty.
   */
  if (roster.length === 0) {
    throw new Error("El libro de los nombres needs a roster and was given none");
  }

  const byLetter = new Map<string, PersonalisedCharacter[]>();
  for (const child of roster) {
    const letter = child.verifiedInitial;
    const page = byLetter.get(letter);
    if (page === undefined) {
      byLetter.set(letter, [toPersonalisedCharacter(child)]);
      continue;
    }
    page.push(toPersonalisedCharacter(child));
  }

  const pages: NameBookPage[] = [...byLetter.entries()]
    .sort(([left], [right]) => spanish.compare(left, right))
    .map(([grapheme, names]) => ({
      pageId: grapheme.toLocaleLowerCase("es-ES"),
      grapheme,
      names: [...names].sort((left, right) =>
        spanish.compare(left.displayName, right.displayName)
      )
    }));

  return {
    schemaVersion: 1,
    resourceId: `name-book-${seed}`,
    template: { id: "name-book", version: 1 },
    seed,
    pages
  };
}
