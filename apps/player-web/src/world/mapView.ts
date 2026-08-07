import {
  worldNodes,
  type CollectibleAnimal,
  type World,
  type WorldNode
} from "@lectoemocion/resource-schema";
import { templateKind, type ResourceKind } from "@lectoemocion/template-sdk";

/** Which animal a child chose out of a node's three chests. */
export interface ClaimedReward {
  readonly nodeId: string;
  readonly animalId: string;
}

/**
 * What every finish is worth.
 *
 * Letriestrellas are the reward for the act of playing, so they are paid every
 * time a chapter is finished — including a replay. The animals are the reward
 * for reaching somewhere new, and those are paid once.
 */
export const STARS_PER_COMPLETION = 3;

/**
 * What actually happened, and nothing else.
 *
 * Unlock state is deliberately absent: it is derived from the world graph on
 * every read. Storing it would mean migrating every saved profile whenever a
 * content update changes the graph — and content updates change the graph.
 *
 * A claimed reward *is* stored, because it is not derivable: it records a
 * choice the child made, and nothing else in the world remembers it. Stars are
 * stored for the same reason — they count finishes, and `completedNodes`
 * deliberately forgets that a chapter was played twice.
 */
export interface Progress {
  readonly completedNodes: readonly string[];
  readonly lastPlayedNode: string | null;
  readonly rewards: readonly ClaimedReward[];
  readonly stars: number;
}

export const EMPTY_PROGRESS: Progress = {
  completedNodes: [],
  lastPlayedNode: null,
  rewards: [],
  stars: 0
};

export type NodeState = "locked" | "unlocked" | "completed";

export interface MapNodeView {
  readonly id: string;
  readonly title: string;
  /** The picture that stands for the chapter, and what a child navigates by. */
  readonly icon: string;
  readonly kind: ResourceKind;
  readonly state: NodeState;
  /** Completed nodes stay playable: progression paces discovery, it is not a gate. */
  readonly playable: boolean;
}

/**
 * One place in the world, with the chapters standing in it.
 *
 * `reachable` is what the door into this region is: a region nothing inside is
 * open in yet is a room with nothing to do, and walking into it would be a way
 * to get lost rather than a way on. It is derived from the same unlock rule as
 * the nodes, so there is no second progression to keep in agreement.
 */
export interface MapRegionView {
  readonly id: string;
  readonly title: string;
  readonly background: string;
  readonly nodes: readonly MapNodeView[];
  readonly reachable: boolean;
}

/**
 * One place in the collection, in world order.
 *
 * Every node has a slot from the very first screen, including locked ones: the
 * empty row is the promise, and a collection that grew a new slot each time
 * would show a child nothing to fill.
 */
export interface CollectionSlotView {
  readonly nodeId: string;
  readonly title: string;
  /** `null` until the child has opened a chest for this node. */
  readonly animal: CollectibleAnimal | null;
}

/** A finished node whose chests are still closed. */
export interface PendingRewardView {
  readonly nodeId: string;
  readonly title: string;
  readonly choices: readonly CollectibleAnimal[];
}

export interface MapView {
  /**
   * The world's places, in walking order.
   *
   * The map shows one at a time and the doors at its ends lead to its
   * neighbours, so the order here *is* the geography.
   */
  readonly regions: readonly MapRegionView[];
  /** Every chapter in the world, region order flattened. */
  readonly nodes: readonly MapNodeView[];
  readonly collection: readonly CollectionSlotView[];
  /**
   * The ceremony owed to the child, if any.
   *
   * Derived rather than remembered in the session, so closing the tab between
   * the last frame of a game and the chests does not quietly cost a reward.
   */
  readonly pendingReward: PendingRewardView | null;
  /** Every letriestrella won so far, across every finish. */
  readonly stars: number;
}

export interface MapViewOptions {
  /** Development bypass only. Never reachable in a production build. */
  readonly unlockAll?: boolean;
}

/**
 * Projects progress onto the world.
 *
 * Pure, and the only place that decides what a child may reach. The map scene
 * receives the result and never sees `Progress` itself, which is what keeps
 * the renderer from growing an opinion about progression.
 *
 * Stored ids the world no longer contains are ignored rather than fatal: a
 * content update that removes a node must not brick a saved profile.
 */
export function deriveMapView(
  world: World,
  progress: Progress,
  options: MapViewOptions = {}
): MapView {
  const nodes = worldNodes(world);
  const known = new Set(nodes.map((node) => node.id));
  const completed = new Set(
    progress.completedNodes.filter((id) => known.has(id))
  );
  const claimed = new Map(
    progress.rewards.map((reward) => [reward.nodeId, reward.animalId])
  );

  /*
   * A stored animal the node no longer offers resolves to nothing, which puts
   * the node back in the queue for a chest. Same reasoning as an unknown node
   * id: stored client state outlives a content update, and the honest recovery
   * is to hand the reward out again rather than to leave a hole in the row.
   */
  const earned = (node: WorldNode): CollectibleAnimal | null =>
    node.reward.choices.find(
      (choice) => choice.animalId === claimed.get(node.id)
    ) ?? null;

  const owed = nodes.find(
    (node) => completed.has(node.id) && earned(node) === null
  );

  const project = (node: WorldNode): MapNodeView => {
    const unlocked =
      options.unlockAll === true ||
      node.unlockedBy.every((required) => completed.has(required));
    const state: NodeState = completed.has(node.id)
      ? "completed"
      : unlocked
        ? "unlocked"
        : "locked";

    return {
      id: node.id,
      title: node.title,
      icon: node.icon,
      kind: templateKind(node.resource.template),
      state,
      playable: state !== "locked"
    };
  };

  const regions = world.regions.map((region) => {
    const projected = region.nodes.map(project);
    return {
      id: region.id,
      title: region.title,
      background: region.background,
      nodes: projected,
      reachable: projected.some((node) => node.playable)
    };
  });

  return {
    stars: progress.stars,
    regions,
    nodes: regions.flatMap((region) => region.nodes),
    collection: nodes.map((node) => ({
      nodeId: node.id,
      title: node.title,
      animal: earned(node)
    })),
    pendingReward:
      owed === undefined
        ? null
        : {
            nodeId: owed.id,
            title: owed.title,
            choices: owed.reward.choices
          }
  };
}
