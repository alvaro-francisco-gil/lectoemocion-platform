import { assertNever, type ChildRecord } from "@lectoemocion/domain";
import type { ResourceManifest } from "@lectoemocion/resource-schema";
import { defaultVocabulary } from "../fixtures/defaultVocabulary";
import { GALLO_RAYO_STORY_ID } from "../fixtures/galloRayo";
import { createIllustratedStoryResource } from "../illustratedStory";
import { createInitialsGameResource } from "../initialsGame";
import { createMemoryAlbumResource } from "../memoryAlbum";
import { createNameBookResource } from "../nameBook";
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
 * One flat list, in the order a child meets it. Every node plays on default
 * content; nothing here needs a roster.
 */
export const world: World = parseWorld({
  nodes: [
    {
      id: "encuentro",
      title: "El encuentro",
      icon: "/world/duende.webp",
      surface: "juegos",
      unlockedBy: [],
      resource: { template: "name-story", seed: "encuentro" },
      reward: {
        animal: animal("gato", "Gato")
      }
    },
    /*
     * The book is on the shelf, not on the path, and it is open from the first
     * screen. It is thirty-one pages long — far the longest thing here — and a
     * book a child has to unlock is a book most of them never open. It still
     * pays its letriestrellas and its chest: what a chapter is worth does not
     * depend on which section it is reached from.
     */
    {
      id: "gallo-rayo",
      title: "El gallo Rayo",
      icon: picture("gallo"),
      surface: "recursos",
      unlockedBy: [],
      resource: {
        template: "illustrated-story",
        seed: "gallo-rayo",
        storyId: "gallo-rayo"
      },
      /* The three the book itself opens on: the rooster and his two mice. */
      reward: {
        animal: animal("gallo", "Gallo")
      }
    },
    /*
     * The second thing on the shelf, and the only chapter in the world that
     * cannot be played on defaults. With nobody recorded there is no book at
     * all, so the player shows it locked with an adult-facing reason rather
     * than opening it onto nothing — see `templateNeedsRoster`.
     *
     * It is on the shelf and not on the path for the same reason the story is:
     * a book a child has to unlock is a book most of them never open.
     */
    {
      id: "libro-nombres",
      title: "El libro de los nombres",
      icon: picture("corazon"),
      surface: "recursos",
      unlockedBy: [],
      resource: { template: "name-book", seed: "libro-nombres" },
      reward: {
        animal: animal("llama", "Llama")
      }
    },
    {
      id: "iniciales",
      title: "Las iniciales",
      icon: picture("abeja"),
      surface: "juegos",
      unlockedBy: ["encuentro"],
      resource: {
        template: "initials-game",
        seed: "iniciales",
        targetInitial: "A"
      },
      reward: {
        animal: animal("koala", "Koala")
      }
    },
    {
      id: "parejas",
      title: "El bosque de parejas",
      icon: picture("dados"),
      surface: "juegos",
      unlockedBy: ["iniciales"],
      /* Named, not drawn: three short, unrelated words a child can tell apart. */
      resource: {
        template: "pairs-game",
        seed: "parejas",
        vocabulary: ["gato", "luna", "mesa"]
      },
      reward: {
        animal: animal("mariposa", "Mariposa")
      }
    },
    {
      id: "cual-es",
      title: "¿Cuál es?",
      icon: picture("manzana"),
      surface: "juegos",
      unlockedBy: ["parejas"],
      resource: {
        template: "word-picture-game",
        seed: "cual-es",
        targetVocabularyItemId: "manzana",
        /* Wrong answers chosen to be plainly different, not near-misses. */
        distractors: ["tren", "pelota"]
      },
      reward: {
        animal: animal("delfin", "Delfín")
      }
    },
    {
      id: "primeras-letras",
      title: "Las primeras letras",
      icon: picture("luna"),
      surface: "juegos",
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
        animal: animal("caballo", "Caballo")
      }
    },
    {
      id: "silabas",
      title: "El puente de sílabas",
      icon: picture("mariposa"),
      surface: "juegos",
      unlockedBy: ["parejas"],
      resource: {
        template: "syllables-game",
        seed: "silabas",
        targetVocabularyItemId: "mariposa"
      },
      reward: {
        animal: animal("tigre", "Tigre")
      }
    },
    {
      id: "letras",
      title: "El taller de letras",
      icon: picture("pato"),
      surface: "juegos",
      unlockedBy: ["silabas"],
      /* Four letters, four distinct ones: nothing to place by elimination. */
      resource: {
        template: "letters-game",
        seed: "letras",
        targetVocabularyItemId: "pato"
      },
      reward: {
        animal: animal("zorro", "Zorro")
      }
    },
    {
      id: "empieza-igual",
      title: "Empieza igual",
      icon: picture("gato"),
      surface: "juegos",
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
        animal: animal("buho", "Búho")
      }
    },
    {
      id: "album",
      title: "Nuestro álbum",
      icon: picture("camara"),
      surface: "juegos",
      unlockedBy: ["primeras-letras", "empieza-igual"],
      resource: { template: "memory-album", seed: "album" },
      reward: {
        animal: animal("pinguino", "Pingüino")
      }
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
    /*
     * The one template the default roster cannot satisfy. It throws rather than
     * returning an empty book, and the player is expected to have refused to
     * launch it — `templateNeedsRoster` is the gate, this is the proof the gate
     * is the only way in.
     */
    case "name-book":
      return createNameBookResource(roster, resource.seed);
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

