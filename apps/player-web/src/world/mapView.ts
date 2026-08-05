import type { World } from "@lectoemocion/resource-schema";
import { templateKind, type ResourceKind } from "@lectoemocion/template-sdk";

/**
 * What actually happened, and nothing else.
 *
 * Unlock state is deliberately absent: it is derived from the world graph on
 * every read. Storing it would mean migrating every saved profile whenever a
 * content update changes the graph — and content updates change the graph.
 */
export interface Progress {
  readonly completedNodes: readonly string[];
  readonly lastPlayedNode: string | null;
}

export const EMPTY_PROGRESS: Progress = {
  completedNodes: [],
  lastPlayedNode: null
};

export type NodeState = "locked" | "unlocked" | "completed";

export interface MapNodeView {
  readonly id: string;
  readonly title: string;
  readonly kind: ResourceKind;
  readonly state: NodeState;
  /** Completed nodes stay playable: progression paces discovery, it is not a gate. */
  readonly playable: boolean;
}

export interface MapView {
  readonly nodes: readonly MapNodeView[];
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
  const known = new Set(world.nodes.map((node) => node.id));
  const completed = new Set(
    progress.completedNodes.filter((id) => known.has(id))
  );

  return {
    nodes: world.nodes.map((node) => {
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
        kind: templateKind(node.resource.template),
        state,
        playable: state !== "locked"
      };
    })
  };
}
