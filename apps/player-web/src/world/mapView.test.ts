import { describe, expect, it } from "vitest";
import { parseWorld, type World } from "@lectoemocion/resource-schema";
import { world } from "@lectoemocion/template-catalog";
import { deriveMapView, EMPTY_PROGRESS } from "./mapView";

const chain: World = parseWorld({
  nodes: [
    {
      id: "one",
      title: "Uno",
      unlockedBy: [],
      resource: { template: "name-story", seed: "one" }
    },
    {
      id: "two",
      title: "Dos",
      unlockedBy: ["one"],
      resource: { template: "pairs-game", seed: "two", pairCount: 3 }
    },
    {
      id: "three",
      title: "Tres",
      unlockedBy: ["one"],
      resource: { template: "pairs-game", seed: "three", pairCount: 3 }
    },
    {
      id: "four",
      title: "Cuatro",
      unlockedBy: ["two", "three"],
      resource: { template: "memory-album", seed: "four" }
    }
  ]
});

const stateOf = (view: ReturnType<typeof deriveMapView>, id: string) =>
  view.nodes.find((node) => node.id === id)?.state;

describe("deriving the map from progress", () => {
  it("opens the entry node and nothing else to a new player", () => {
    const view = deriveMapView(chain, EMPTY_PROGRESS);
    expect(stateOf(view, "one")).toBe("unlocked");
    expect(stateOf(view, "two")).toBe("locked");
    expect(stateOf(view, "four")).toBe("locked");
  });

  it("unlocks successors when their prerequisite is completed", () => {
    const view = deriveMapView(chain, {
      completedNodes: ["one"],
      lastPlayedNode: "one"
    });
    expect(stateOf(view, "one")).toBe("completed");
    expect(stateOf(view, "two")).toBe("unlocked");
    expect(stateOf(view, "three")).toBe("unlocked");
  });

  it("keeps a node locked until every prerequisite is done", () => {
    const partial = deriveMapView(chain, {
      completedNodes: ["one", "two"],
      lastPlayedNode: "two"
    });
    expect(stateOf(partial, "four")).toBe("locked");

    const complete = deriveMapView(chain, {
      completedNodes: ["one", "two", "three"],
      lastPlayedNode: "three"
    });
    expect(stateOf(complete, "four")).toBe("unlocked");
  });

  it("keeps a completed node replayable rather than closing it", () => {
    const view = deriveMapView(chain, {
      completedNodes: ["one"],
      lastPlayedNode: "one"
    });
    const one = view.nodes.find((node) => node.id === "one");
    expect(one?.state).toBe("completed");
    expect(one?.playable).toBe(true);
  });

  it("is pure: the same inputs always give the same view", () => {
    const progress = { completedNodes: ["one"], lastPlayedNode: "one" };
    expect(deriveMapView(chain, progress)).toEqual(
      deriveMapView(chain, progress)
    );
  });

  it("ignores stored ids the world no longer contains", () => {
    const view = deriveMapView(chain, {
      completedNodes: ["one", "a-node-from-an-older-content-release"],
      lastPlayedNode: "a-node-from-an-older-content-release"
    });
    expect(view.nodes).toHaveLength(chain.nodes.length);
    expect(stateOf(view, "two")).toBe("unlocked");
  });

  it("carries each node's kind so the map can draw it", () => {
    const view = deriveMapView(chain, EMPTY_PROGRESS);
    expect(stateOf(view, "one")).toBe("unlocked");
    expect(view.nodes.find((node) => node.id === "one")?.kind).toBe("cinematic");
    expect(view.nodes.find((node) => node.id === "four")?.kind).toBe(
      "non-interactive"
    );
  });

  it("opens everything when the development bypass is on", () => {
    const view = deriveMapView(chain, EMPTY_PROGRESS, { unlockAll: true });
    expect(view.nodes.every((node) => node.playable)).toBe(true);
  });
});

describe("the authored world through the map", () => {
  it("starts a real player on exactly one playable node", () => {
    const view = deriveMapView(world, EMPTY_PROGRESS);
    expect(view.nodes.filter((node) => node.playable)).toHaveLength(1);
  });
});
