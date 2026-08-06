import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from "react";
import type { CollectibleAnimal } from "@lectoemocion/resource-schema";
import { createResourceForNode, world } from "@lectoemocion/template-catalog";
import { createGame } from "../game/createGame";
import {
  deriveMapView,
  EMPTY_PROGRESS,
  type CollectionSlotView,
  type MapNodeView,
  type PendingRewardView,
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
 *
 * Exactly one of three screens is on: a playing resource, the chest ceremony
 * owed for finishing one, or the map. They are exclusive rather than layered
 * so that nothing a child can touch is ever hidden behind something else.
 */
export function App() {
  const [progress, setProgress] = useState<Progress>(EMPTY_PROGRESS);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  /*
   * The animal just won, held only until the child acknowledges it. It cannot
   * be derived: the moment it is claimed it stops being pending, and without
   * this the reveal would vanish in the same frame the chest opened.
   */
  const [revealed, setRevealed] = useState<CollectibleAnimal | null>(null);
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
    void store.recordCompletion(nodeId).then((next) => {
      setProgress(next);
      /*
       * Finishing a chapter for the first time hands the screen to the chests.
       * A replay does not: the child chose to play it again, and taking the
       * game away from them for a reward they already hold would be a
       * punishment for replaying.
       */
      if (!next.rewards.some((reward) => reward.nodeId === nodeId)) {
        setActiveNodeId(null);
      }
    });
  }, []);

  const openChest = useCallback((nodeId: string, animal: CollectibleAnimal) => {
    /*
     * Recorded before it is shown. A child who is handed an animal and then
     * loses it to a closing tab has been given nothing, and the reveal is the
     * one part of this that can safely be replayed.
     */
    setRevealed(animal);
    void store.claimReward(nodeId, animal.animalId).then(setProgress);
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

  if (revealed) {
    return <Reveal animal={revealed} onContinue={() => setRevealed(null)} />;
  }

  if (view.pendingReward) {
    return <Chests reward={view.pendingReward} onOpen={openChest} />;
  }

  return (
    <main className="map">
      {/*
        An ordered list because the world is a sequence: that is what a screen
        reader should hear, and it is what the connecting line draws.
      */}
      <nav aria-label="Mundo" className="map__world">
        <ol className="world-path">
          {view.nodes.map((node, index) => (
            <li key={node.id}>
              <WorldNode node={node} index={index} onSelect={select} />
            </li>
          ))}
        </ol>
      </nav>
      <Collection slots={view.collection} />
    </main>
  );
}

/**
 * The animals won so far, one slot per chapter, in world order.
 *
 * Display only: it is the record of what a child has done, not another way to
 * navigate. Its slots exist from the first screen so the row reads as a thing
 * to fill rather than a thing that grows.
 */
function Collection({ slots }: { slots: readonly CollectionSlotView[] }) {
  return (
    <section className="collection" aria-label="Mis animales">
      <ul className="collection__slots">
        {slots.map((slot) => (
          <li
            key={slot.nodeId}
            className="collection__slot"
            data-filled={slot.animal !== null}
          >
            {slot.animal ? (
              <>
                {/*
                  Empty `alt`: the name below is the accessible text, and a
                  screen reader announcing the picture as well would say it
                  twice.
                */}
                <img src={slot.animal.imageUrl} alt="" />
                <span className="collection__name">{slot.animal.label}</span>
              </>
            ) : (
              <>
                <span className="collection__empty" aria-hidden="true">
                  ?
                </span>
                {/*
                  Spoken but not drawn. An empty slot must say what it is to a
                  screen reader without putting "todavía no" six times across a
                  screen a child is looking at.
                */}
                <span className="visually-hidden">
                  {slot.title}: todavía no
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The ceremony: three closed chests, one choice.
 *
 * The chests are identical on purpose — the child is choosing, not solving.
 * There is no way past this screen other than opening one, because the reward
 * is owed and a way to decline it is a way to lose it by accident.
 */
function Chests({
  reward,
  onOpen
}: {
  reward: PendingRewardView;
  onOpen: (nodeId: string, animal: CollectibleAnimal) => void;
}) {
  return (
    <main className="reward">
      <p className="reward__prompt">¡Muy bien! Elige un cofre</p>
      {/*
        The duende is where the chests came from. He stands beside them rather
        than above the prompt, so the screen reads as one offer being made —
        and he is `alt=""` because he is not a fourth thing to choose.
      */}
      <div className="reward__offer">
        <img className="duende" src="/world/duende.webp" alt="" />
        <ul className="chests">
          {reward.choices.map((animal, index) => (
            <li key={animal.animalId}>
              <button
                type="button"
                className="chest"
                aria-label={`Abrir el cofre ${index + 1}`}
                onClick={() => onOpen(reward.nodeId, animal)}
              >
                <ChestIcon />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

/** What was inside. One picture, one name, one way on. */
function Reveal({
  animal,
  onContinue
}: {
  animal: CollectibleAnimal;
  onContinue: () => void;
}) {
  return (
    <main className="reveal">
      {/*
        Announced when it appears: a child who cannot see the picture is still
        told what they won, at the moment they won it.
      */}
      <div className="reveal__prize" role="status">
        <img src={animal.imageUrl} alt="" />
        <p className="reveal__name">¡{animal.label}!</p>
      </div>
      <button type="button" className="reveal__continue" onClick={onContinue}>
        Seguir
      </button>
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

/**
 * A closed chest, drawn rather than loaded.
 *
 * Three of these are the first thing on screen after a game ends, and a
 * picture that arrives a beat late would make the ceremony stutter on the
 * classroom panel's cold cache.
 */
function ChestIcon() {
  return (
    <svg viewBox="0 0 100 84" width="100%" height="100%" aria-hidden="true">
      <rect x="6" y="34" width="88" height="44" rx="8" fill="#b5651d" />
      <path d="M6 38a44 26 0 0 1 88 0Z" fill="#d98c3f" />
      <rect x="6" y="34" width="88" height="10" fill="#8a4712" />
      <rect x="42" y="26" width="16" height="30" rx="4" fill="#f4c95d" />
      <circle cx="50" cy="44" r="5" fill="#8a4712" />
    </svg>
  );
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
