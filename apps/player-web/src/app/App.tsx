import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createResourceForNode, world } from "@lectoemocion/template-catalog";
import { createGame, createMapGame } from "../game/createGame";
import {
  deriveMapView,
  EMPTY_PROGRESS,
  type MapNodeView,
  type Progress
} from "../world/mapView";
import { LOCAL_OWNER, LocalProgressStore } from "../world/progressStore";
import { unlockAllEnabled } from "../world/unlockAll";

const store = new LocalProgressStore(
  typeof localStorage === "undefined"
    ? { getItem: () => null, setItem: () => undefined }
    : localStorage,
  LOCAL_OWNER
);

/**
 * The world shell.
 *
 * It owns progression: it reads progress, derives the map, routes into a
 * resource, and records completion. Neither the map scene nor any template
 * sees `Progress` — they receive a view or a manifest and report back.
 */
export function App() {
  const [progress, setProgress] = useState<Progress>(EMPTY_PROGRESS);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void store.read().then((stored) => {
      if (!cancelled) setProgress(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const view = useMemo(
    () => deriveMapView(world, progress, { unlockAll: unlockAllEnabled() }),
    [progress]
  );

  const activeNode = useMemo(
    () => world.nodes.find((node) => node.id === activeNodeId) ?? null,
    [activeNodeId]
  );

  const select = useCallback(
    (nodeId: string) => {
      const target = view.nodes.find((node) => node.id === nodeId);
      /* Hiding a locked node is presentation; refusing to open it is the rule. */
      if (!target?.playable) return;
      setActiveNodeId(nodeId);
    },
    [view]
  );

  const complete = useCallback((nodeId: string) => {
    void store.recordCompletion(nodeId).then(setProgress);
  }, []);

  useEffect(() => {
    const parent = host.current;
    if (!parent) return;

    const game = activeNode
      ? createGame(parent, createResourceForNode(activeNode), () =>
          complete(activeNode.id)
        )
      : createMapGame(parent, view, select);

    return () => game.destroy(true);
  }, [activeNode, view, select, complete]);

  const unlocked = view.nodes.filter((node) => node.playable).length;

  return (
    <main>
      <header>
        <h1>LectoEmoción</h1>
        {activeNode ? (
          <button onClick={() => setActiveNodeId(null)}>Volver al mapa</button>
        ) : (
          <p data-testid="progress-summary">
            {unlocked} de {view.nodes.length} desbloqueados
          </p>
        )}
        {/*
          The canvas map is for the child. This list is for the adult, who must
          be able to see what the class can actually reach before a session
          starts (platform-design.md §6.1), and it is what a screen reader can
          read.

          It belongs to the map, not to play: while a resource is running the
          only way onward is finishing it or going back, so a permanent strip of
          shortcuts along the top is both a distraction at a child's eye level
          and a way around the progression.
        */}
        {!activeNode && (
          <nav aria-label="Mundo">
            {view.nodes.map((node) => (
              <NodeButton
                key={node.id}
                node={node}
                active={node.id === activeNodeId}
                onSelect={select}
              />
            ))}
          </nav>
        )}
      </header>
      <div ref={host} className="game-host" data-testid="game-host" />
    </main>
  );
}

function NodeButton({
  node,
  active,
  onSelect
}: {
  node: MapNodeView;
  active: boolean;
  onSelect: (nodeId: string) => void;
}) {
  return (
    <button
      aria-pressed={active}
      disabled={!node.playable}
      data-state={node.state}
      onClick={() => onSelect(node.id)}
    >
      {node.title}
    </button>
  );
}
