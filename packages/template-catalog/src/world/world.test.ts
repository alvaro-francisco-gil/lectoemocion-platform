import { describe, expect, it } from "vitest";
import {
  parseResourceManifest,
  parseWorld,
  worldNodes
} from "@lectoemocion/resource-schema";
import { templateKind, templateNeedsRoster } from "@lectoemocion/template-sdk";
import { defaultVocabulary } from "../fixtures/defaultVocabulary";
import { syntheticClass } from "../fixtures/syntheticClass";
import { createResourceForNode, world } from ".";

describe("the authored world", () => {
  it("validates", () => {
    expect(parseWorld(world)).toEqual(world);
  });

  it("has exactly one entry node under Juegos", () => {
    const entries = worldNodes(world).filter(
      (node) => node.surface === "juegos" && node.unlockedBy.length === 0
    );
    expect(entries.map((node) => node.id)).toEqual(["encuentro"]);
  });

  /*
   * The shelf is not a reward. A book a child has to unlock is a book most of
   * them never open, so the story is reachable from the very first screen —
   * and it is the only thing on the shelf, which is why this names it.
   */
  it("keeps the books on the shelf, open from the first screen", () => {
    const shelf = worldNodes(world).filter(
      (node) => node.surface === "recursos"
    );
    expect(shelf.map((node) => node.id)).toEqual(["gallo-rayo", "libro-nombres"]);
    expect(shelf.every((node) => node.unlockedBy.length === 0)).toBe(true);
  });

  /**
   * The book of names is gated by whether a roster exists, and by nothing in
   * the graph. `unlockedBy` describes what a child has played; needing a
   * roster is a different question with a different answer, asked of the
   * player rather than of progress — see `templateNeedsRoster`.
   */
  it("does not express the roster requirement as a prerequisite", () => {
    const book = worldNodes(world).find((node) => node.id === "libro-nombres");
    expect(book?.unlockedBy).toEqual([]);
    expect(book?.resource.template).toBe("name-book");
  });

  /* It is still a chapter of the world: it pays its stars and its chest, and
     it keeps its slot in the collection. */
  it("still pays a chest for the story on the shelf", () => {
    const story = worldNodes(world).find((node) => node.id === "gallo-rayo");
    expect(story?.reward.animal.animalId).toBe("gallo");
  });

  it("puts every other chapter under Juegos", () => {
    const games = worldNodes(world).filter((node) => node.surface === "juegos");
    expect(games).toHaveLength(worldNodes(world).length - 2);
  });

  it("reaches every node from the entry", () => {
    const reachable = new Set<string>(
      worldNodes(world)
        .filter((node) => node.unlockedBy.length === 0)
        .map((node) => node.id)
    );

    let grew = true;
    while (grew) {
      grew = false;
      for (const node of worldNodes(world)) {
        if (reachable.has(node.id)) continue;
        if (node.unlockedBy.every((id) => reachable.has(id))) {
          reachable.add(node.id);
          grew = true;
        }
      }
    }

    expect(reachable.size).toBe(worldNodes(world).length);
  });

  it("offers all three resource kinds, so the world is not only minigames", () => {
    const kinds = new Set(
      worldNodes(world).map((node) => templateKind(node.resource.template))
    );
    expect(kinds).toEqual(
      new Set(["cinematic", "minigame", "non-interactive"])
    );
  });

  /**
   * Every chapter but one plays with no uploads at all, which is what lets an
   * institutional pilot ship with no child data present. `name-book` is the
   * single declared exception — it is the class's own names, so there is
   * nothing for it to be without them — and `templateNeedsRoster` is where that
   * exception is declared rather than inferred here.
   */
  it("builds a valid manifest for every node that plays on defaults", () => {
    for (const node of worldNodes(world)) {
      if (templateNeedsRoster(node.resource.template)) continue;
      const manifest = createResourceForNode(node);
      expect(parseResourceManifest(manifest)).toEqual(manifest);
    }
  });

  it("fails closed on the one node that cannot play without a roster", () => {
    const book = worldNodes(world).find(
      (node) => node.resource.template === "name-book"
    );
    expect(book).toBeDefined();
    expect(() => createResourceForNode(book!)).toThrow(/needs a roster/);
  });

  it("builds the book of names once it has one", () => {
    const book = worldNodes(world).find(
      (node) => node.resource.template === "name-book"
    )!;
    const manifest = createResourceForNode(book, syntheticClass);
    expect(parseResourceManifest(manifest)).toEqual(manifest);
  });

  it("gives every node a distinct resource", () => {
    const ids = worldNodes(world).map(
      (node) => createResourceForNode(node, syntheticClass).resourceId
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  /*
   * One page of the book per chapter, and a different animal on each. The book
   * shows a child the shadow of what is still owed, so two chapters granting
   * the same animal would draw the same shadow twice and leave one page that
   * can never be filled.
   */
  it("grants a different animal in every chapter", () => {
    const animals = worldNodes(world).map((node) => node.reward.animal.animalId);
    expect(new Set(animals).size).toBe(animals.length);
  });

  /*
   * `defaultVocabulary` is generated from the picture files themselves, so an
   * animal that appears there is an animal whose picture ships. This is the
   * check that a reward slot cannot render a broken image.
   */
  it("draws every reward picture from the shipped library", () => {
    const known = new Map(
      defaultVocabulary.map((item) => [
        String(item.vocabularyItemId),
        item.imageUrl
      ])
    );

    for (const node of worldNodes(world)) {
      const { animalId, imageUrl } = node.reward.animal;
      expect(known.get(animalId), animalId).toBe(imageUrl);
    }
  });
});

describe("world validation", () => {
  /** One animal each, so a fixture exercises the graph rules and not the reward. */
  const reward = {
    animal: { animalId: "gato", label: "Gato", imageUrl: "/vocabulary/gato.webp" }
  };
  const otherReward = {
    animal: { animalId: "pato", label: "Pato", imageUrl: "/vocabulary/pato.webp" }
  };

  /** A world holding the nodes under test. */
  const worldOf = (...nodes: unknown[]) => ({ nodes });

  const entry = {
    id: "start",
    title: "Comienzo",
    icon: "/vocabulary/gato.webp",
    surface: "juegos",
    unlockedBy: [],
    resource: { template: "name-story", seed: "start" },
    reward
  };

  /* Where a chapter stands is authored, never guessed from its template: a
     node with no surface would be a node missing from both tabs. */
  it("rejects a node that does not say which surface it stands on", () => {
    const { surface: _dropped, ...homeless } = entry;
    expect(() => parseWorld(worldOf(homeless))).toThrow("Invalid world");
  });

  it("rejects a surface the shell has no tab for", () => {
    expect(() =>
      parseWorld(worldOf({ ...entry, surface: "multijugador" }))
    ).toThrow("Invalid world");
  });

  it("rejects an unlock pointing at a node that does not exist", () => {
    expect(() =>
      parseWorld(
        worldOf(entry, {
          id: "second",
          title: "Segundo",
          icon: "/vocabulary/perro.webp",
          surface: "juegos",
          unlockedBy: ["nowhere"],
          resource: { template: "pairs-game", seed: "second", pairCount: 3 },
          reward: otherReward
        })
      )
    ).toThrow("nowhere");
  });

  /*
   * The book draws one page per chapter and fills it with that chapter's
   * animal. Two chapters granting the same one would draw the same shadow in
   * two places and leave a page that can never be filled.
   */
  it("rejects the same animal granted by two chapters", () => {
    expect(() =>
      parseWorld(
        worldOf(entry, {
          id: "second",
          title: "Segundo",
          icon: "/vocabulary/perro.webp",
          surface: "juegos",
          unlockedBy: ["start"],
          resource: { template: "pairs-game", seed: "second", pairCount: 3 },
          reward
        })
      )
    ).toThrow("gato");
  });

  it("rejects a duplicate node id", () => {
    expect(() => parseWorld(worldOf(entry, entry))).toThrow("start");
  });

  it("rejects a world with no nodes at all", () => {
    expect(() => parseWorld({ nodes: [] })).toThrow("Invalid world");
  });

  it("rejects a world with no entry node", () => {
    expect(() =>
      parseWorld(worldOf({ ...entry, unlockedBy: ["start"] }))
    ).toThrow("entry");
  });

  it("rejects a cycle", () => {
    expect(() =>
      parseWorld(
        worldOf(
          entry,
          {
            id: "a",
            title: "A",
            icon: "/vocabulary/luna.webp",
            surface: "juegos",
            unlockedBy: ["b"],
            resource: { template: "pairs-game", seed: "a", pairCount: 3 },
            reward: otherReward
          },
          {
            id: "b",
            title: "B",
            icon: "/vocabulary/sol.webp",
            surface: "juegos",
            unlockedBy: ["a"],
            resource: { template: "pairs-game", seed: "b", pairCount: 3 },
            reward: {
              animal: {
                animalId: "luna",
                label: "Luna",
                imageUrl: "/vocabulary/luna.webp"
              }
            }
          }
        )
      )
    ).toThrow("Unreachable world nodes: a, b");
  });

  /* The world is a row of pictures: a chapter without one cannot be found by a
     child who does not read, so it is a content defect, not a missing nicety. */
  it("rejects a node with no map icon", () => {
    const { icon: _dropped, ...iconless } = entry;
    expect(() => parseWorld(worldOf(iconless))).toThrow("Invalid world");
  });

  it("rejects a node with no reward to give", () => {
    const { reward: _dropped, ...rewardless } = entry;
    expect(() => parseWorld(worldOf(rewardless))).toThrow("Invalid world");
  });

  it("rejects a chapter that grants no animal", () => {
    expect(() => parseWorld(worldOf({ ...entry, reward: {} }))).toThrow(
      "Invalid world"
    );
  });

  it("rejects an unknown template", () => {
    expect(() =>
      parseWorld(
        worldOf({ ...entry, resource: { template: "not-a-template", seed: "x" } })
      )
    ).toThrow("Invalid world");
  });
});

/**
 * Authoring a world means naming pictures, and a name is a thing you can get
 * wrong. These pin that a named set is honoured exactly and that a bad name
 * fails closed rather than shipping a game one picture short.
 */
describe("authored vocabulary", () => {
  const nodeFor = (id: string) => {
    const node = worldNodes(world).find((candidate) => candidate.id === id);
    expect(node, `${id} is in the world`).toBeDefined();
    return node!;
  };

  /*
   * The author picks which pictures, not where they land: the game seeds its
   * own layout, and the two card rows are shuffled independently by design.
   */
  it("plays exactly the pairs the world names", () => {
    const resource = createResourceForNode(nodeFor("parejas"));
    expect(resource.template.id).toBe("pairs-game");
    expect(
      "vocabulary" in resource
        ? resource.vocabulary.map((item) => item.vocabularyItemId).sort()
        : []
    ).toEqual(["gato", "luna", "mesa"]);
  });

  it("spells exactly the word the world names", () => {
    const resource = createResourceForNode(nodeFor("letras"));
    expect(resource.template.id).toBe("letters-game");
    expect(
      "vocabulary" in resource
        ? resource.vocabulary.map((item) => item.vocabularyItemId)
        : []
    ).toEqual(["pato"]);
  });

  it("fails closed on a word the letters game cannot show", () => {
    expect(() =>
      createResourceForNode({
        ...nodeFor("letras"),
        resource: {
          template: "letters-game",
          seed: "too-long",
          targetVocabularyItemId: "astronauta"
        }
      })
    ).toThrow("this game shows");
  });

  it("plays exactly the target and distractors the world names", () => {
    const resource = createResourceForNode(nodeFor("cual-es"));
    expect(
      "vocabulary" in resource
        ? resource.vocabulary.map((item) => item.vocabularyItemId).sort()
        : []
    ).toEqual(["manzana", "pelota", "tren"]);
  });

  it("still draws a set for a game that names none", () => {
    const drawn = createResourceForNode({
      ...nodeFor("parejas"),
      resource: { template: "pairs-game", seed: "drawn", pairCount: 4 }
    });
    expect("vocabulary" in drawn ? drawn.vocabulary : []).toHaveLength(4);
  });

  it("fails closed on a picture the vocabulary does not have", () => {
    expect(() =>
      createResourceForNode({
        ...nodeFor("parejas"),
        resource: {
          template: "pairs-game",
          seed: "typo",
          vocabulary: ["gato", "casa"]
        }
      })
    ).toThrow("No vocabulary item named casa");
  });

  it("rejects the same picture named twice in one game", () => {
    expect(() =>
      createResourceForNode({
        ...nodeFor("parejas"),
        resource: {
          template: "pairs-game",
          seed: "duplicate",
          vocabulary: ["gato", "gato"]
        }
      })
    ).toThrow("Vocabulary item named twice: gato");
  });
});
