import type { ManifestFor, StoryPage } from "@lectoemocion/resource-schema";
import { GALLO_RAYO_STORY_ID, galloRayoPages } from "./fixtures/galloRayo";

/**
 * Every story the catalogue can build, by id.
 *
 * A second title is an entry here and a world node pointing at it — not a
 * second template, and not a copy of the renderer.
 */
const STORIES: Readonly<Record<string, readonly StoryPage[]>> = {
  [GALLO_RAYO_STORY_ID]: galloRayoPages
};

/**
 * An illustrated story, read aloud.
 *
 * No roster: the book is product-authored content from cover to last page, so
 * unlike `name-story` there is no slot for a child to fill. That is what makes
 * it the resource an institutional pilot can ship with no child data present
 * at all.
 */
export function createIllustratedStoryResource(
  storyId: string,
  seed: string
): ManifestFor<"illustrated-story"> {
  const pages = STORIES[storyId];
  /*
   * A story the catalogue does not have is missing *default* content, which
   * fails closed (invariant 6) rather than opening an empty book.
   */
  if (pages === undefined) {
    throw new Error(`Unknown story: ${storyId}`);
  }

  return {
    schemaVersion: 1,
    resourceId: `illustrated-story-${storyId}-${seed}`,
    template: { id: "illustrated-story", version: 1 },
    seed,
    pages: [...pages]
  };
}
