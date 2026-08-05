import { describe, expect, it } from "vitest";
import {
  parseResourceManifest,
  parseWorld
} from "@lectoemocion/resource-schema";
import { templateKind } from "@lectoemocion/template-sdk";
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
});

describe("world validation", () => {
  const entry = {
    id: "start",
    title: "Comienzo",
    unlockedBy: [],
    resource: { template: "name-story", seed: "start" }
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
            resource: { template: "pairs-game", seed: "second", pairCount: 3 }
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
            resource: { template: "pairs-game", seed: "a", pairCount: 3 }
          },
          {
            id: "b",
            title: "B",
            unlockedBy: ["a"],
            resource: { template: "pairs-game", seed: "b", pairCount: 3 }
          }
        ]
      })
    ).toThrow("Unreachable world nodes: a, b");
  });

  it("rejects an unknown template", () => {
    expect(() =>
      parseWorld({
        nodes: [{ ...entry, resource: { template: "not-a-template", seed: "x" } }]
      })
    ).toThrow("Invalid world");
  });
});
