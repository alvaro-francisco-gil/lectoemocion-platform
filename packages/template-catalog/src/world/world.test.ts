import { describe, expect, it } from "vitest";
import {
  CHEST_COUNT,
  parseResourceManifest,
  parseWorld
} from "@lectoemocion/resource-schema";
import { templateKind } from "@lectoemocion/template-sdk";
import { defaultVocabulary } from "../fixtures/defaultVocabulary";
import { createResourceForNode, world } from ".";

describe("the authored world", () => {
  it("validates", () => {
    expect(parseWorld(world)).toEqual(world);
  });

  it("has exactly one entry node", () => {
    const entries = world.nodes.filter((node) => node.unlockedBy.length === 0);
    expect(entries).toHaveLength(1);
  });

  it("reaches every node from the entry", () => {
    const reachable = new Set<string>(
      world.nodes
        .filter((node) => node.unlockedBy.length === 0)
        .map((node) => node.id)
    );

    let grew = true;
    while (grew) {
      grew = false;
      for (const node of world.nodes) {
        if (reachable.has(node.id)) continue;
        if (node.unlockedBy.every((id) => reachable.has(id))) {
          reachable.add(node.id);
          grew = true;
        }
      }
    }

    expect(reachable.size).toBe(world.nodes.length);
  });

  it("offers all three resource kinds, so the world is not only minigames", () => {
    const kinds = new Set(
      world.nodes.map((node) => templateKind(node.resource.template))
    );
    expect(kinds).toEqual(
      new Set(["cinematic", "minigame", "non-interactive"])
    );
  });

  it("builds a valid manifest for every node, with no roster", () => {
    for (const node of world.nodes) {
      const manifest = createResourceForNode(node);
      expect(parseResourceManifest(manifest)).toEqual(manifest);
    }
  });

  it("gives every node a distinct resource", () => {
    const ids = world.nodes.map((node) => createResourceForNode(node).resourceId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("offers a chest for every node, each hiding a different animal", () => {
    for (const node of world.nodes) {
      expect(node.reward.choices, node.id).toHaveLength(CHEST_COUNT);
      const animals = node.reward.choices.map((choice) => choice.animalId);
      expect(new Set(animals).size, node.id).toBe(animals.length);
    }
  });

  /*
   * A collection with the same animal in two slots reads as a bug to a child
   * who has just been told they found something new.
   */
  it("never offers the same animal in two nodes", () => {
    const animals = world.nodes.flatMap((node) =>
      node.reward.choices.map((choice) => choice.animalId)
    );
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

    for (const node of world.nodes) {
      for (const choice of node.reward.choices) {
        expect(known.get(choice.animalId), choice.animalId).toBe(
          choice.imageUrl
        );
      }
    }
  });
});

describe("world validation", () => {
  /** Three animals, so a fixture exercises the graph rules and not the reward. */
  const reward = {
    choices: [
      { animalId: "gato", label: "Gato", imageUrl: "/vocabulary/gato.webp" },
      { animalId: "perro", label: "Perro", imageUrl: "/vocabulary/perro.webp" },
      { animalId: "pato", label: "Pato", imageUrl: "/vocabulary/pato.webp" }
    ]
  };

  const entry = {
    id: "start",
    title: "Comienzo",
    unlockedBy: [],
    resource: { template: "name-story", seed: "start" },
    reward
  };

  it("rejects an unlock pointing at a node that does not exist", () => {
    expect(() =>
      parseWorld({
        nodes: [
          entry,
          {
            id: "second",
            title: "Segundo",
            unlockedBy: ["nowhere"],
            resource: { template: "pairs-game", seed: "second", pairCount: 3 },
            reward
          }
        ]
      })
    ).toThrow("nowhere");
  });

  it("rejects a duplicate node id", () => {
    expect(() => parseWorld({ nodes: [entry, entry] })).toThrow("start");
  });

  it("rejects a world with no entry node", () => {
    expect(() =>
      parseWorld({
        nodes: [{ ...entry, unlockedBy: ["start"] }]
      })
    ).toThrow("entry");
  });

  it("rejects a cycle", () => {
    expect(() =>
      parseWorld({
        nodes: [
          entry,
          {
            id: "a",
            title: "A",
            unlockedBy: ["b"],
            resource: { template: "pairs-game", seed: "a", pairCount: 3 },
            reward
          },
          {
            id: "b",
            title: "B",
            unlockedBy: ["a"],
            resource: { template: "pairs-game", seed: "b", pairCount: 3 },
            reward
          }
        ]
      })
    ).toThrow("Unreachable world nodes: a, b");
  });

  it("rejects a node with no reward to give", () => {
    const { reward: _dropped, ...rewardless } = entry;
    expect(() => parseWorld({ nodes: [rewardless] })).toThrow("Invalid world");
  });

  it("rejects a number of chests other than three", () => {
    expect(() =>
      parseWorld({
        nodes: [{ ...entry, reward: { choices: reward.choices.slice(0, 2) } }]
      })
    ).toThrow("Invalid world");
  });

  it("rejects the same animal hidden in two chests", () => {
    expect(() =>
      parseWorld({
        nodes: [
          {
            ...entry,
            reward: {
              choices: [reward.choices[0], reward.choices[0], reward.choices[1]]
            }
          }
        ]
      })
    ).toThrow("the same animal in two chests");
  });

  it("rejects an unknown template", () => {
    expect(() =>
      parseWorld({
        nodes: [{ ...entry, resource: { template: "not-a-template", seed: "x" } }]
      })
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
    const node = world.nodes.find((candidate) => candidate.id === id);
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
