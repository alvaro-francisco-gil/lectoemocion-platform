import { assertNever, type ChildRecord } from "@lectoemocion/domain";
import type { ResourceManifest } from "@lectoemocion/resource-schema";
import { defaultVocabulary } from "../fixtures/defaultVocabulary";
import { createInitialsGameResource } from "../initialsGame";
import { createMemoryAlbumResource } from "../memoryAlbum";
import { createNameStoryResource } from "../nameStory";
import {
  createPairsGameResource,
  createSyllablesGameResource,
  createWordPictureGameResource
} from "../vocabularyGames";
import {
  parseWorld,
  type World,
  type WorldNode
} from "@lectoemocion/resource-schema";

/**
 * The authored world.
 *
 * Fixed and product-authored: not user-composed, not editable, extended by
 * product updates (platform-design.md §6.1). Progression paces discovery
 * rather than gating difficulty, so the graph is a gentle chain with one
 * branch rather than a tree of prerequisites.
 *
 * Every node plays on default content. Nothing here needs a roster.
 */
export const world: World = parseWorld({
  nodes: [
    {
      id: "encuentro",
      title: "El encuentro",
      unlockedBy: [],
      resource: { template: "name-story", seed: "encuentro" }
    },
    {
      id: "iniciales",
      title: "Las iniciales",
      unlockedBy: ["encuentro"],
      resource: {
        template: "initials-game",
        seed: "iniciales",
        targetInitial: "A"
      }
    },
    {
      id: "parejas",
      title: "El bosque de parejas",
      unlockedBy: ["iniciales"],
      resource: { template: "pairs-game", seed: "parejas", pairCount: 3 }
    },
    {
      id: "cual-es",
      title: "¿Cuál es?",
      unlockedBy: ["parejas"],
      resource: {
        template: "word-picture-game",
        seed: "cual-es",
        targetVocabularyItemId: "manzana",
        choiceCount: 3
      }
    },
    {
      id: "silabas",
      title: "El puente de sílabas",
      unlockedBy: ["parejas"],
      resource: {
        template: "syllables-game",
        seed: "silabas",
        targetVocabularyItemId: "mariposa"
      }
    },
    {
      id: "album",
      title: "Nuestro álbum",
      unlockedBy: ["cual-es", "silabas"],
      resource: { template: "memory-album", seed: "album" }
    }
  ]
});

/**
 * Turns a node into the manifest it plays.
 *
 * The switch ends in `assertNever`, so adding a template to the world schema
 * without teaching this function to build it is a compile error rather than a
 * blank scene.
 *
 * The roster is optional everywhere, because every node must play on defaults.
 */
export function createResourceForNode(
  node: WorldNode,
  roster: readonly ChildRecord[] = []
): ResourceManifest {
  const resource = node.resource;
  switch (resource.template) {
    case "name-story":
      return createNameStoryResource(resource.seed, roster);
    case "initials-game":
      return createInitialsGameResource(
        resource.targetInitial,
        resource.seed,
        roster
      );
    case "memory-album":
      return createMemoryAlbumResource(resource.seed, roster);
    case "pairs-game":
      return createPairsGameResource(
        defaultVocabulary,
        resource.pairCount,
        resource.seed
      );
    case "word-picture-game":
      return createWordPictureGameResource(
        defaultVocabulary,
        resource.targetVocabularyItemId,
        resource.choiceCount,
        resource.seed
      );
    case "syllables-game":
      return createSyllablesGameResource(
        defaultVocabulary,
        resource.targetVocabularyItemId,
        resource.seed
      );
    default:
      return assertNever(resource, "world node resource");
  }
}

