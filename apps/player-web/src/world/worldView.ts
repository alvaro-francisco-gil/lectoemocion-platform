import {
  worldNodes,
  type CollectibleAnimal,
  type World,
  type WorldNode
} from "@lectoemocion/resource-schema";
import {
  templateKind,
  templateNeedsRoster,
  type ResourceKind
} from "@lectoemocion/template-sdk";

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

/**
 * `needs-roster` is deliberately not a second flavour of `locked`.
 *
 * The two say different things to the adult standing next to the child:
 * `locked` is *not yet, keep playing*, and `needs-roster` is *this one needs
 * you*. It is the only state in the world an adult can act on, so a shell that
 * could not tell them apart would bury the one message worth reading.
 */
export type NodeState = "locked" | "needs-roster" | "unlocked" | "completed";

export interface WorldNodeView {
  readonly id: string;
  readonly title: string;
  /** The picture that stands for the chapter, and what a child navigates by. */
  readonly icon: string;
  /** Which of the shell's sections this chapter stands in. */
  readonly surface: "juegos" | "recursos";
  readonly kind: ResourceKind;
  readonly state: NodeState;
  /** Completed nodes stay playable: progression paces discovery, it is not a gate. */
  readonly playable: boolean;
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

export interface WorldView {
  /**
   * The chapters on the path, in authored order.
   *
   * Split here rather than in the shell so that "which section is this in" has
   * one answer, sitting next to the rule that decides what may be played at
   * all.
   */
  readonly games: readonly WorldNodeView[];
  /** The chapters on the shelf: books, and whatever else is there to browse. */
  readonly resources: readonly WorldNodeView[];
  /** Every chapter in the world, both sections in authored order. */
  readonly nodes: readonly WorldNodeView[];
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

export interface WorldViewOptions {
  /** Development bypass only. Never reachable in a production build. */
  readonly unlockAll?: boolean;
  /**
   * Whether any children have been recorded for this group.
   *
   * A boolean rather than the roster itself: this function decides what a child
   * may reach, and handing it names would put child data through a projection
   * that has no use for them. Defaults to `false`, so a caller that has not
   * thought about it gets the chapter held back rather than opened onto
   * nothing.
   */
  readonly hasRoster?: boolean;
}

/**
 * Projects progress onto the world.
 *
 * Pure, and the only place that decides what a child may reach. The shell
 * receives the result and never hands `Progress` on, which is what keeps the
 * renderer from growing an opinion about progression.
 *
 * Stored ids the world no longer contains are ignored rather than fatal: a
 * content update that removes a node must not brick a saved profile.
 */
export function deriveWorldView(
  world: World,
  progress: Progress,
  options: WorldViewOptions = {}
): WorldView {
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

  const project = (node: WorldNode): WorldNodeView => {
    /*
     * Asked before progression, and unaffected by the development bypass. The
     * bypass answers "has the child played enough", and this is a different
     * question with no answer available: a book of the group's own names has
     * nothing to be made of until there are some.
     */
    const missingRoster =
      templateNeedsRoster(node.resource.template) && options.hasRoster !== true;

    const unlocked =
      options.unlockAll === true ||
      node.unlockedBy.every((required) => completed.has(required));
    const state: NodeState = missingRoster
      ? "needs-roster"
      : completed.has(node.id)
        ? "completed"
        : unlocked
          ? "unlocked"
          : "locked";

    return {
      id: node.id,
      title: node.title,
      icon: node.icon,
      surface: node.surface,
      kind: templateKind(node.resource.template),
      state,
      playable: state === "unlocked" || state === "completed"
    };
  };

  const projected = nodes.map(project);

  return {
    stars: progress.stars,
    games: projected.filter((node) => node.surface === "juegos"),
    resources: projected.filter((node) => node.surface === "recursos"),
    nodes: projected,
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
