import { assertNever, type ChildRecord } from "@lectoemocion/domain";
import type { ResourceManifest } from "@lectoemocion/resource-schema";
import { defaultVocabulary } from "../fixtures/defaultVocabulary";
import { GALLO_RAYO_STORY_ID } from "../fixtures/galloRayo";
import { createIllustratedStoryResource } from "../illustratedStory";
import { createInitialsGameResource } from "../initialsGame";
import { createMemoryAlbumResource } from "../memoryAlbum";
import { createNameStoryResource } from "../nameStory";
import {
  createInitialLetterGameResource,
  createInitialSyllableGameResource,
  createLettersGameResource,
  createPairsGameResource,
  createSyllablesGameResource,
  createWordPictureGameResource,
  requireItems
} from "../vocabularyGames";
import { assertDistinctInitials } from "@lectoemocion/template-sdk";
import {
  parseWorld,
  type CollectibleAnimal,
  type World,
  type WorldNode
} from "@lectoemocion/resource-schema";

/**
 * Where a shared picture is served from.
 *
 * One library for the whole world — reward animals and map icons alike — so
 * there is a single provenance record
 * (apps/player-web/public/vocabulary/PROVENANCE.md) rather than one per use.
 */
function picture(vocabularyItemId: string): string {
  return `/vocabulary/${encodeURIComponent(vocabularyItemId)}.webp`;
}

/**
 * A collectible animal.
 *
 * Bespoke reward art replaces these by changing this list and nothing else.
 */
function animal(animalId: string, label: string): CollectibleAnimal {
  return { animalId, label, imageUrl: picture(animalId) };
}

/**
 * The authored world.
 *
 * Fixed and product-authored: not user-composed, not editable, extended by
 * product updates (platform-design.md §6.1). Progression paces discovery
 * rather than gating difficulty, so the graph is a gentle chain with one
 * branch rather than a tree of prerequisites.
 *
 * It is split into regions — places, not chapters of difficulty. A child walks
 * off the end of the farm into the forest and back again, and the prerequisite
 * graph deliberately crosses between them so that the walk is part of playing
 * rather than a one-way door.
 *
 * Every node plays on default content. Nothing here needs a roster.
 */
export const world: World = parseWorld({
  regions: [
    {
      id: "granja",
      title: "La granja",
      background: "/world/granero.webp",
      nodes: [
        {
          id: "encuentro",
          title: "El encuentro",
          icon: "/world/duende.webp",
          unlockedBy: [],
          resource: { template: "name-story", seed: "encuentro" },
          reward: {
            choices: [animal("gato", "Gato"), animal("perro", "Perro"), animal("conejo", "Conejo")]
          }
        },
        /*
         * The book sits beside the first minigame rather than in front of it, on
         * the branch the world already allows. It is thirty-one pages long — far
         * the longest thing here — and putting it across the only path would make
         * every child read all of it before they could play anything.
         */
        {
          id: "gallo-rayo",
          title: "El gallo Rayo",
          icon: picture("gallo"),
          unlockedBy: ["encuentro"],
          resource: {
            template: "illustrated-story",
            seed: "gallo-rayo",
            storyId: "gallo-rayo"
          },
          /* The three the book itself opens on: the rooster and his two mice. */
          reward: {
            choices: [
              animal("gallo", "Gallo"),
              animal("pollito", "Pollito"),
              animal("raton", "Ratón")
            ]
          }
        },
        {
          id: "iniciales",
          title: "Las iniciales",
          icon: picture("abeja"),
          unlockedBy: ["encuentro"],
          resource: {
            template: "initials-game",
            seed: "iniciales",
            targetInitial: "A"
          },
          reward: {
            choices: [
              animal("koala", "Koala"),
              animal("jirafa", "Jirafa"),
              animal("elefante", "Elefante")
            ]
          }
        },
        {
          id: "primeras-letras",
          title: "Las primeras letras",
          icon: picture("luna"),
          unlockedBy: ["cual-es"],
          /*
           * Four letters a child can tell apart at a glance, on four unrelated
           * pictures. No two may share an initial — a letter card that fitted two
           * pictures would have no right answer — and the builder refuses a set
           * that does.
           */
          resource: {
            template: "initial-letter-game",
            seed: "primeras-letras",
            vocabulary: ["luna", "sol", "pato", "flor"]
          },
          reward: {
            choices: [
              animal("caballo", "Caballo"),
              animal("vaca", "Vaca"),
              animal("oveja", "Oveja")
            ]
          }
        },
        {
          id: "silabas",
          title: "El puente de sílabas",
          icon: picture("mariposa"),
          unlockedBy: ["parejas"],
          resource: {
            template: "syllables-game",
            seed: "silabas",
            targetVocabularyItemId: "mariposa"
          },
          reward: {
            choices: [
              animal("tigre", "Tigre"),
              animal("leon", "León"),
              animal("mono", "Mono")
            ]
          }
        },
        {
          id: "letras",
          title: "El taller de letras",
          icon: picture("pato"),
          unlockedBy: ["silabas"],
          /* Four letters, four distinct ones: nothing to place by elimination. */
          resource: {
            template: "letters-game",
            seed: "letras",
            targetVocabularyItemId: "pato"
          },
          reward: {
            choices: [
              animal("zorro", "Zorro"),
              animal("erizo", "Erizo"),
              animal("tortuga", "Tortuga")
            ]
          }
        },
        {
          id: "empieza-igual",
          title: "Empieza igual",
          icon: picture("gato"),
          unlockedBy: ["letras"],
          /*
           * `GA-to` against `GA-llo` or `GA-fas`: the syllable, not the letter.
           * It comes after the letters workshop on purpose — a child who has taken
           * a word apart into letters is ready to hear the piece above them.
           */
          resource: {
            template: "initial-syllable-game",
            seed: "empieza-igual",
            targetVocabularyItemId: "gato"
          },
          reward: {
            choices: [
              animal("buho", "Búho"),
              animal("rana", "Rana"),
              animal("flamenco", "Flamenco")
            ]
          }
        },
        {
          id: "album",
          title: "Nuestro álbum",
          icon: picture("camara"),
          unlockedBy: ["primeras-letras", "empieza-igual"],
          resource: { template: "memory-album", seed: "album" },
          reward: {
            choices: [
              animal("pinguino", "Pingüino"),
              animal("foca", "Foca"),
              animal("tucan", "Tucán")
            ]
          }
        }
      ]
    },
    /*
     * The forest is a second place, not a second difficulty. Two chapters
     * stand in it, and what unlocks them is still their own `unlockedBy` — a
     * child reaches the door once there is something behind it to play.
     *
     * The farm needs the forest back: the chapters after these two are on the
     * farm and wait on them. The walk is meant to go both ways.
     */
    {
      id: "bosque",
      title: "El bosque",
      background: "/world/bosque.webp",
      nodes: [
        {
          id: "parejas",
          title: "El bosque de parejas",
          icon: picture("dados"),
          unlockedBy: ["iniciales"],
          /* Named, not drawn: three short, unrelated words a child can tell apart. */
          resource: {
            template: "pairs-game",
            seed: "parejas",
            vocabulary: ["gato", "luna", "mesa"]
          },
          reward: {
            choices: [
              animal("mariposa", "Mariposa"),
              animal("abeja", "Abeja"),
              animal("mariquita", "Mariquita")
            ]
          }
        },
        {
          id: "cual-es",
          title: "¿Cuál es?",
          icon: picture("manzana"),
          unlockedBy: ["parejas"],
          resource: {
            template: "word-picture-game",
            seed: "cual-es",
            targetVocabularyItemId: "manzana",
            /* Wrong answers chosen to be plainly different, not near-misses. */
            distractors: ["tren", "pelota"]
          },
          reward: {
            choices: [
              animal("delfin", "Delfín"),
              animal("ballena", "Ballena"),
              animal("pulpo", "Pulpo")
            ]
          }
        }
      ]
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
    case "illustrated-story":
      return createIllustratedStoryResource(resource.storyId, resource.seed);
    case "initials-game":
      return createInitialsGameResource(
        resource.targetInitial,
        resource.seed,
        roster
      );
    case "memory-album":
      return createMemoryAlbumResource(resource.seed, roster);
    /*
     * Named pictures are resolved to exactly those items, and the builder is
     * then asked for all of them — same code path as the random draw, so an
     * authored set cannot diverge in behaviour from a drawn one.
     */
    case "pairs-game": {
      const chosen =
        "vocabulary" in resource
          ? requireItems(defaultVocabulary, resource.vocabulary)
          : defaultVocabulary;
      const pairCount =
        "vocabulary" in resource ? chosen.length : resource.pairCount;
      return createPairsGameResource(chosen, pairCount, resource.seed);
    }
    case "word-picture-game": {
      const chosen =
        "distractors" in resource
          ? requireItems(defaultVocabulary, [
              resource.targetVocabularyItemId,
              ...resource.distractors
            ])
          : defaultVocabulary;
      const choiceCount =
        "distractors" in resource ? chosen.length : resource.choiceCount;
      return createWordPictureGameResource(
        chosen,
        resource.targetVocabularyItemId,
        choiceCount,
        resource.seed
      );
    }
    /*
     * An authored set is checked for clashing initials here, before the draw,
     * so the error names the two words rather than reporting how many pictures
     * the filtered draw managed to find.
     */
    case "initial-letter-game": {
      if ("vocabulary" in resource) {
        const chosen = requireItems(defaultVocabulary, resource.vocabulary);
        assertDistinctInitials(chosen);
        return createInitialLetterGameResource(
          chosen,
          chosen.length,
          resource.seed
        );
      }
      return createInitialLetterGameResource(
        defaultVocabulary,
        resource.pictureCount,
        resource.seed
      );
    }
    case "syllables-game":
      return createSyllablesGameResource(
        defaultVocabulary,
        resource.targetVocabularyItemId,
        resource.seed
      );
    case "initial-syllable-game":
      return createInitialSyllableGameResource(
        defaultVocabulary,
        resource.targetVocabularyItemId,
        resource.seed
      );
    case "letters-game":
      return createLettersGameResource(
        defaultVocabulary,
        resource.targetVocabularyItemId,
        resource.seed
      );
    default:
      return assertNever(resource, "world node resource");
  }
}

