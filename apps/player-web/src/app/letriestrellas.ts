/**
 * The star a child is handed, drawn five ways.
 *
 * Each carries a vowel, and which vowel is decoration in exactly the sense
 * `cardTints` is: a fact about where a star stands in a row, not about the
 * star. Every one is worth one letriestrella, nothing reads the letter, and no
 * stored state has ever heard of it. Three stars at the end of a chapter are
 * an A, an E and an I because they are the first three, and a child who earns
 * three tomorrow gets the same three.
 *
 * That is the whole reason this is a list and not a field on a prize. A star
 * that carried a vowel would have to be minted with one, stored with one, and
 * counted by one, and the counter's single number would stop being the truth.
 *
 * Kept here beside `cardTints` rather than in `world/prizes.ts`, because those
 * modules decide what a child has earned and this one only decides what it
 * looks like.
 */

/**
 * In the order the vowels are said, which is the order a child meets them.
 *
 * `apps/player-web/public/world/PROVENANCE.md` records where the art came
 * from — including that two of the supplied files are named for the wrong
 * letter, and were committed by what they actually contain.
 */
export const LETRIESTRELLAS = [
  "/world/letriestrella-a.webp",
  "/world/letriestrella-e.webp",
  "/world/letriestrella-i.webp",
  "/world/letriestrella-o.webp",
  "/world/letriestrella-u.webp"
] as const;

/** How many the row cycles through before repeating. */
export const LETRIESTRELLA_COUNT = LETRIESTRELLAS.length;

/**
 * The star at `position` in a row of them, wrapping at the end of the set.
 *
 * Takes the raw position rather than an already-wrapped index so the modulo
 * happens once, here, and no caller can pass an index the set does not have.
 */
export function letriestrella(position: number): string {
  const star = LETRIESTRELLAS[position % LETRIESTRELLA_COUNT];
  /*
   * Unreachable for any non-negative integer, which is what a list index is.
   * It fails rather than defaults because a star with no picture is a broken
   * invariant, not a star to leave blank (invariant 6).
   */
  if (star === undefined) {
    throw new Error(`No letriestrella for position ${position}`);
  }
  return star;
}
