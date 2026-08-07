import { describe, expect, it } from "vitest";
import {
  parseWorld,
  worldNodes,
  type World
} from "@lectoemocion/resource-schema";
import { world } from "@lectoemocion/template-catalog";
import {
  deriveWorldView,
  EMPTY_PROGRESS,
  STARS_PER_COMPLETION,
  type Progress
} from "./worldView";

/** Three animals for a node's chests, named after the node so they are traceable. */
const chestsFor = (node: string) => ({
  choices: ["a", "b", "c"].map((suffix) => ({
    animalId: `${node}-${suffix}`,
    label: `${node} ${suffix}`,
    imageUrl: `/vocabulary/${node}-${suffix}.webp`
  }))
});

/**
 * A four-chapter world with one thing on the shelf.
 *
 * `three` stands under Recursos and is open from the start, which is what the
 * real world's story does: a fixture where every node was a game could not tell
 * the two lists apart.
 */
const chain: World = parseWorld({
  nodes: [
    {
      id: "one",
      title: "Uno",
      icon: "/vocabulary/gato.webp",
      surface: "juegos",
      unlockedBy: [],
      resource: { template: "name-story", seed: "one" },
      reward: chestsFor("one")
    },
    {
      id: "two",
      title: "Dos",
      icon: "/vocabulary/luna.webp",
      surface: "juegos",
      unlockedBy: ["one"],
      resource: { template: "pairs-game", seed: "two", pairCount: 3 },
      reward: chestsFor("two")
    },
    {
      id: "three",
      title: "Tres",
      icon: "/vocabulary/sol.webp",
      surface: "recursos",
      unlockedBy: [],
      resource: { template: "pairs-game", seed: "three", pairCount: 3 },
      reward: chestsFor("three")
    },
    {
      id: "four",
      title: "Cuatro",
      icon: "/vocabulary/pato.webp",
      surface: "juegos",
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
  })),
  stars: completedNodes.length * STARS_PER_COMPLETION
});

const stateOf = (view: ReturnType<typeof deriveWorldView>, id: string) =>
  view.nodes.find((node) => node.id === id)?.state;

describe("deriving the world from progress", () => {
  it("opens the entry node and the shelf, and nothing else, to a new player", () => {
    const view = deriveWorldView(chain, EMPTY_PROGRESS);
    expect(stateOf(view, "one")).toBe("unlocked");
    expect(stateOf(view, "three")).toBe("unlocked");
    expect(stateOf(view, "two")).toBe("locked");
    expect(stateOf(view, "four")).toBe("locked");
  });

  it("unlocks successors when their prerequisite is completed", () => {
    const view = deriveWorldView(chain, progressAfter("one"));
    expect(stateOf(view, "one")).toBe("completed");
    expect(stateOf(view, "two")).toBe("unlocked");
  });

  it("keeps a node locked until every prerequisite is done", () => {
    const partial = deriveWorldView(chain, progressAfter("one", "two"));
    expect(stateOf(partial, "four")).toBe("locked");

    const complete = deriveWorldView(chain, progressAfter("one", "two", "three"));
    expect(stateOf(complete, "four")).toBe("unlocked");
  });

  it("keeps a completed node replayable rather than closing it", () => {
    const view = deriveWorldView(chain, progressAfter("one"));
    const one = view.nodes.find((node) => node.id === "one");
    expect(one?.state).toBe("completed");
    expect(one?.playable).toBe(true);
  });

  it("is pure: the same inputs always give the same view", () => {
    const progress = progressAfter("one");
    expect(deriveWorldView(chain, progress)).toEqual(
      deriveWorldView(chain, progress)
    );
  });

  it("ignores stored ids the world no longer contains", () => {
    const view = deriveWorldView(chain, {
      ...progressAfter("one"),
      completedNodes: ["one", "a-node-from-an-older-content-release"],
      lastPlayedNode: "a-node-from-an-older-content-release"
    });
    expect(view.nodes).toHaveLength(worldNodes(chain).length);
    expect(stateOf(view, "two")).toBe("unlocked");
  });

  it("carries each node's kind so the shell can draw it", () => {
    const view = deriveWorldView(chain, EMPTY_PROGRESS);
    expect(stateOf(view, "one")).toBe("unlocked");
    expect(view.nodes.find((node) => node.id === "one")?.kind).toBe("cinematic");
    expect(view.nodes.find((node) => node.id === "four")?.kind).toBe(
      "non-interactive"
    );
  });

  /*
   * The total is not derived from the node list on purpose: replays are paid
   * too, and `completedNodes` is a set that has forgotten them.
   */
  it("carries the star total so the shell can show it", () => {
    expect(deriveWorldView(chain, EMPTY_PROGRESS).stars).toBe(0);
    expect(
      deriveWorldView(chain, { ...progressAfter("one"), stars: 42 }).stars
    ).toBe(42);
  });

  it("opens everything when the development bypass is on", () => {
    const view = deriveWorldView(chain, EMPTY_PROGRESS, { unlockAll: true });
    expect(view.nodes.every((node) => node.playable)).toBe(true);
  });
});

describe("the world's two surfaces", () => {
  it("splits the chapters into the section each one stands in", () => {
    const view = deriveWorldView(chain, EMPTY_PROGRESS);
    expect(view.games.map((node) => node.id)).toEqual(["one", "two", "four"]);
    expect(view.resources.map((node) => node.id)).toEqual(["three"]);
  });

  /* The flat list is the same chapters, so nothing that reads it — the
     collection, the ceremony — has to learn about sections. */
  it("keeps every chapter in one list, in authored order", () => {
    const view = deriveWorldView(chain, EMPTY_PROGRESS);
    expect(view.nodes.map((node) => node.id)).toEqual([
      "one",
      "two",
      "three",
      "four"
    ]);
  });

  it("carries each node's surface, so the shell does not re-derive it", () => {
    const view = deriveWorldView(chain, EMPTY_PROGRESS);
    expect(view.nodes.find((node) => node.id === "three")?.surface).toBe(
      "recursos"
    );
  });
});

describe("the collection and the chests owed for it", () => {
  const collectionOf = (view: ReturnType<typeof deriveWorldView>) =>
    view.collection.map((slot) => [slot.nodeId, slot.animal?.animalId ?? null]);

  it("gives a new player an empty slot for every chapter", () => {
    const view = deriveWorldView(chain, EMPTY_PROGRESS);
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
      rewards: [],
      stars: STARS_PER_COMPLETION
    };

    const owed = deriveWorldView(chain, finished);
    expect(owed.pendingReward?.nodeId).toBe("one");
    expect(
      owed.pendingReward?.choices.map((choice) => choice.animalId)
    ).toEqual(["one-a", "one-b", "one-c"]);

    const claimed = deriveWorldView(chain, {
      ...finished,
      rewards: [{ nodeId: "one", animalId: "one-b" }]
    });
    expect(claimed.pendingReward).toBeNull();
  });

  it("fills the chapter's own slot with the animal the child chose", () => {
    const view = deriveWorldView(chain, {
      completedNodes: ["one"],
      lastPlayedNode: "one",
      rewards: [{ nodeId: "one", animalId: "one-c" }],
      stars: STARS_PER_COMPLETION
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
    const view = deriveWorldView(chain, {
      completedNodes: ["two", "one"],
      lastPlayedNode: "two",
      rewards: [],
      stars: 2 * STARS_PER_COMPLETION
    });
    expect(view.pendingReward?.nodeId).toBe("one");
  });

  it("never owes a chest for a node that was never finished", () => {
    expect(deriveWorldView(chain, EMPTY_PROGRESS).pendingReward).toBeNull();
  });

  /*
   * A content update can retire an animal. Re-offering the chests is the
   * recoverable outcome: the alternative is a slot that stays grey forever
   * with no way for a child to fill it.
   */
  it("offers the chests again when the stored animal no longer exists", () => {
    const view = deriveWorldView(chain, {
      completedNodes: ["one"],
      lastPlayedNode: "one",
      rewards: [{ nodeId: "one", animalId: "an-animal-from-an-older-release" }],
      stars: STARS_PER_COMPLETION
    });
    expect(view.pendingReward?.nodeId).toBe("one");
    expect(view.collection[0]?.animal).toBeNull();
  });
});

describe("the authored world through the shell", () => {
  it("starts a real player on one game and the whole shelf", () => {
    const view = deriveWorldView(world, EMPTY_PROGRESS);
    expect(view.games.filter((node) => node.playable)).toHaveLength(1);
    expect(view.resources.every((node) => node.playable)).toBe(true);
  });
});
