import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from "react";
import { createResourceForNode, world } from "@lectoemocion/template-catalog";
import { createGame } from "../game/createGame";
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
 * resource, and records completion. No template sees `Progress` — each receives
 * a manifest and a completion callback, and reports back.
 *
 * There is no page header. The world path is the whole map screen, and a
 * playing resource shows only the way back: chrome above a game competes with
 * it at a child's eye level, and a permanent list of destinations is a way
 * around the progression.
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
      /* Dimming a locked node is presentation; refusing to open it is the rule. */
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
    if (!activeNode || !parent) return;

    const game = createGame(parent, createResourceForNode(activeNode), () =>
      complete(activeNode.id)
    );
    return () => game.destroy(true);
  }, [activeNode, complete]);

  if (activeNode) {
    return (
      <main className="playing">
        <button
          type="button"
          className="back"
          aria-label="Volver al mapa"
          onClick={() => setActiveNodeId(null)}
        >
          <BackArrow />
        </button>
        <div ref={host} className="game-host" data-testid="game-host" />
      </main>
    );
  }

  return (
    <main className="map">
      {/*
        The duende is the framing story's guide. It sits in the upper corner:
        decoration belongs in the band a child aged 3–5 cannot reach, well
        clear of the path they choose from. Empty `alt` because it names
        nothing a screen reader needs — the world is the list below.
      */}
      <img className="map__duende" src="/world/duende.webp" alt="" />
      {/*
        An ordered list because the world is a sequence: that is what a screen
        reader should hear, and it is what the connecting line draws.
      */}
      <nav aria-label="Mundo">
        <ol className="world-path">
          {view.nodes.map((node, index) => (
            <li key={node.id}>
              <WorldNode node={node} index={index} onSelect={select} />
            </li>
          ))}
        </ol>
      </nav>
    </main>
  );
}

function WorldNode({
  node,
  index,
  onSelect
}: {
  node: MapNodeView;
  index: number;
  onSelect: (nodeId: string) => void;
}) {
  const titleId = useId();
  const stateId = useId();
  return (
    <button
      type="button"
      className="world-node"
      data-state={node.state}
      disabled={!node.playable}
      /*
       * The node is named by its title alone and described by its state, so a
       * screen reader announces "El encuentro, Historia" rather than folding
       * the state into the name of the place.
       */
      aria-labelledby={titleId}
      aria-describedby={stateId}
      onClick={() => onSelect(node.id)}
    >
      <span className="world-node__marker" aria-hidden="true">
        {node.state === "locked" ? "🔒" : index + 1}
      </span>
      <span className="world-node__title" id={titleId}>
        {node.title}
      </span>
      <span className="world-node__state" id={stateId}>
        {stateLabel(node)}
      </span>
    </button>
  );
}

/** Spoken by a screen reader and read by an adult; never carried by colour alone. */
function stateLabel(node: MapNodeView): string {
  if (node.state === "locked") return "Bloqueado";
  if (node.state === "completed") return "Completado";
  return node.kind === "cinematic" ? "Historia" : "Jugar";
}

function BackArrow() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <path
        d="M15 4 7 12l8 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
