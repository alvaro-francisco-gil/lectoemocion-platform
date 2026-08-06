import { describe, expect, it } from "vitest";
import { parseWorld, type World } from "@lectoemocion/resource-schema";
import { world } from "@lectoemocion/template-catalog";
import { deriveMapView, EMPTY_PROGRESS, type Progress } from "./mapView";

/** Three animals for a node's chests, named after the node so they are traceable. */
const chestsFor = (node: string) => ({
  choices: ["a", "b", "c"].map((suffix) => ({
    animalId: `${node}-${suffix}`,
    label: `${node} ${suffix}`,
    imageUrl: `/vocabulary/${node}-${suffix}.webp`
  }))
});

const chain: World = parseWorld({
  nodes: [
    {
      id: "one",
      title: "Uno",
      unlockedBy: [],
      resource: { template: "name-story", seed: "one" },
      reward: chestsFor("one")
    },
    {
      id: "two",
      title: "Dos",
      unlockedBy: ["one"],
      resource: { template: "pairs-game", seed: "two", pairCount: 3 },
      reward: chestsFor("two")
    },
    {
      id: "three",
      title: "Tres",
      unlockedBy: ["one"],
      resource: { template: "pairs-game", seed: "three", pairCount: 3 },
      reward: chestsFor("three")
    },
    {
      id: "four",
      title: "Cuatro",
      unlockedBy: ["two", "three"],
      resource: { template: "memory-album", seed: "four" },
      reward: chestsFor("four")
    }
  ]
});

/**
 * Progress as it is after the chests have been dealt with.
 *
 * Most of these cases are about the graph, not the ceremony, so they claim
 * each completed node's first animal and move on.
 */
const progressAfter = (...completedNodes: string[]): Progress => ({
  completedNodes,
  lastPlayedNode: completedNodes.at(-1) ?? null,
  rewards: completedNodes.map((nodeId) => ({
    nodeId,
    animalId: `${nodeId}-a`
  }))
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
    const view = deriveMapView(chain, progressAfter("one"));
    expect(stateOf(view, "one")).toBe("completed");
    expect(stateOf(view, "two")).toBe("unlocked");
    expect(stateOf(view, "three")).toBe("unlocked");
  });

  it("keeps a node locked until every prerequisite is done", () => {
    const partial = deriveMapView(chain, progressAfter("one", "two"));
    expect(stateOf(partial, "four")).toBe("locked");

    const complete = deriveMapView(chain, progressAfter("one", "two", "three"));
    expect(stateOf(complete, "four")).toBe("unlocked");
  });

  it("keeps a completed node replayable rather than closing it", () => {
    const view = deriveMapView(chain, progressAfter("one"));
    const one = view.nodes.find((node) => node.id === "one");
    expect(one?.state).toBe("completed");
    expect(one?.playable).toBe(true);
  });

  it("is pure: the same inputs always give the same view", () => {
    const progress = progressAfter("one");
    expect(deriveMapView(chain, progress)).toEqual(
      deriveMapView(chain, progress)
    );
  });

  it("ignores stored ids the world no longer contains", () => {
    const view = deriveMapView(chain, {
      ...progressAfter("one"),
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

describe("the collection and the chests owed for it", () => {
  const collectionOf = (view: ReturnType<typeof deriveMapView>) =>
    view.collection.map((slot) => [slot.nodeId, slot.animal?.animalId ?? null]);

  it("gives a new player an empty slot for every chapter", () => {
    const view = deriveMapView(chain, EMPTY_PROGRESS);
    expect(collectionOf(view)).toEqual([
      ["one", null],
      ["two", null],
      ["three", null],
      ["four", null]
    ]);
    expect(view.pendingReward).toBeNull();
  });

  it("owes chests for a completed node until one is opened", () => {
    const finished: Progress = {
      completedNodes: ["one"],
      lastPlayedNode: "one",
      rewards: []
    };

    const owed = deriveMapView(chain, finished);
    expect(owed.pendingReward?.nodeId).toBe("one");
    expect(
      owed.pendingReward?.choices.map((choice) => choice.animalId)
    ).toEqual(["one-a", "one-b", "one-c"]);

    const claimed = deriveMapView(chain, {
      ...finished,
      rewards: [{ nodeId: "one", animalId: "one-b" }]
    });
    expect(claimed.pendingReward).toBeNull();
  });

  it("fills the chapter's own slot with the animal the child chose", () => {
    const view = deriveMapView(chain, {
      completedNodes: ["one"],
      lastPlayedNode: "one",
      rewards: [{ nodeId: "one", animalId: "one-c" }]
    });
    expect(collectionOf(view)).toEqual([
      ["one", "one-c"],
      ["two", null],
      ["three", null],
      ["four", null]
    ]);
  });

  /* Finishing several nodes before opening a chest owes them in world order. */
  it("owes one ceremony at a time, oldest first", () => {
    const view = deriveMapView(chain, {
      completedNodes: ["two", "one"],
      lastPlayedNode: "two",
      rewards: []
    });
    expect(view.pendingReward?.nodeId).toBe("one");
  });

  it("never owes a chest for a node that was never finished", () => {
    expect(deriveMapView(chain, EMPTY_PROGRESS).pendingReward).toBeNull();
  });

  /*
   * A content update can retire an animal. Re-offering the chests is the
   * recoverable outcome: the alternative is a slot that stays grey forever
   * with no way for a child to fill it.
   */
  it("offers the chests again when the stored animal no longer exists", () => {
    const view = deriveMapView(chain, {
      completedNodes: ["one"],
      lastPlayedNode: "one",
      rewards: [{ nodeId: "one", animalId: "an-animal-from-an-older-release" }]
    });
    expect(view.pendingReward?.nodeId).toBe("one");
    expect(view.collection[0]?.animal).toBeNull();
  });
});

describe("the authored world through the map", () => {
  it("starts a real player on exactly one playable node", () => {
    const view = deriveMapView(world, EMPTY_PROGRESS);
    expect(view.nodes.filter((node) => node.playable)).toHaveLength(1);
  });
});
