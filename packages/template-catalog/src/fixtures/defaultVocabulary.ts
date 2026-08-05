import { vocabularyItemId } from "@lectoemocion/domain";
import type { VocabularyItem } from "@lectoemocion/resource-schema";

/**
 * Product-authored default vocabulary.
 *
 * Every template ships playable with no uploads, and these three games never
 * personalise: they carry no child data at all, which is what the
 * default-content institutional pilot requires.
 *
 * `imageUrl` names the picture each item will use. No artwork is committed yet,
 * so the player draws a deterministic placeholder — see
 * `docs/migration/minigame-specifications.md`.
 */
function item(id: string, syllables: readonly string[]): VocabularyItem {
  return {
    vocabularyItemId: vocabularyItemId(id),
    syllables: [...syllables],
    imageUrl: `/synthetic/picture-${id}.svg`
  };
}

export const defaultVocabulary: readonly VocabularyItem[] = [
  item("casa", ["ca", "sa"]),
  item("luna", ["lu", "na"]),
  item("gato", ["ga", "to"]),
  item("pelota", ["pe", "lo", "ta"]),
  item("mariposa", ["ma", "ri", "po", "sa"]),
  item("zapato", ["za", "pa", "to"]),
  item("sol", ["sol"]),
  item("flor", ["flor"])
];
