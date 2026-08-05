import type { Character } from "@lectoemocion/resource-schema";

/**
 * The product-authored cast that roster templates play with when nobody has
 * uploaded anything.
 *
 * This is what inverts the dependency: `name-story` and `initials-game` are
 * resources in their own right, and a child record overrides a slot rather
 * than supplying one. The institutional pilot plays exactly this, with no
 * child data present at all.
 *
 * Two characters share each of the first initials on purpose, so
 * `initials-game` has something to filter and still fills a round.
 *
 * Names and artwork are placeholders pending design. Pictures follow
 * `defaultVocabulary`'s convention and are drawn as deterministic glyphs until
 * the artwork plan lands — see docs/plans/ideas/default-vocabulary-artwork.md.
 */
function character(displayName: string, verifiedInitial: string): Character {
  const slug = displayName.toLowerCase();
  return {
    displayName,
    verifiedInitial,
    photoUrl: `/synthetic/character-${slug}.svg`,
    pronunciationUrl: `/synthetic/silent-${slug}.mp3`
  };
}

export const defaultCharacters: readonly Character[] = [
  character("Ada", "A"),
  character("Aro", "A"),
  character("Bibi", "B"),
  character("Bruma", "B"),
  character("Luli", "L"),
  character("Mimo", "M"),
  character("Nube", "N"),
  character("Sena", "S")
];
