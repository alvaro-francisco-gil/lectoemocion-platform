import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties
} from "react";
import {
  worldNodes,
  type CollectibleAnimal
} from "@lectoemocion/resource-schema";
import { createResourceForNode, world } from "@lectoemocion/template-catalog";
import { createGame } from "../game/createGame";
import {
  deriveMapView,
  EMPTY_PROGRESS,
  STARS_PER_COMPLETION,
  type CollectionSlotView,
  type MapNodeView,
  type MapRegionView,
  type PendingRewardView,
  type Progress
} from "../world/mapView";
import { LOCAL_OWNER, LocalProgressStore } from "../world/progressStore";
import { unlockAllEnabled } from "../world/unlockAll";
import { useDragScroll } from "./useDragScroll";

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
 * Exactly one screen is on at a time: a playing resource, the letriestrellas
 * just won, the animal just revealed, the chests owed for a first finish, the
 * menu, or the map. They are exclusive rather than layered so that nothing a
 * child can touch is ever hidden behind something else.
 */
export function App() {
  const [progress, setProgress] = useState<Progress>(EMPTY_PROGRESS);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  /*
   * The stars just paid, held only until the child acknowledges them. Like the
   * animal below, this cannot be derived: the total is already banked by the
   * time the screen appears, and the screen is about what was added to it.
   */
  const [awarded, setAwarded] = useState<number | null>(null);
  /*
   * The animal just won, held only until the child acknowledges it. It cannot
   * be derived: the moment it is claimed it stops being pending, and without
   * this the reveal would vanish in the same frame the chest opened.
   */
  const [revealed, setRevealed] = useState<CollectibleAnimal | null>(null);
  /* The menu is a screen of its own, so whether it is on is part of which one. */
  const [menuOpen, setMenuOpen] = useState(false);
  /*
   * Where the child is standing. Session state, deliberately not stored: the
   * farm holds the entry chapter and everything the forest leads back to, so
   * opening the app in the room a child happened to wander into last week is a
   * worse start than opening it where the world begins.
   */
  const [regionIndex, setRegionIndex] = useState(0);
  const host = useRef<HTMLDivElement>(null);
  const panWorld = useDragScroll();

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
    () => worldNodes(world).find((node) => node.id === activeNodeId) ?? null,
    [activeNodeId]
  );

  /*
   * The world always has a first region, so a stored or stale index that no
   * longer exists lands the child at the beginning rather than on a blank
   * screen. Fails to the entry, not to nothing.
   */
  const region = view.regions[regionIndex] ?? view.regions[0]!;

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
       * Every finish leaves the game, because every finish is paid: the stars
       * come first and the chests, when a chapter is owed them, come after.
       * Banked before they are shown, for the same reason as the animal — a
       * child who is told they won something and then loses it to a closing
       * tab has been given nothing.
       */
      setActiveNodeId(null);
      setAwarded(STARS_PER_COMPLETION);
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

  if (awarded !== null) {
    return <StarAward amount={awarded} onContinue={() => setAwarded(null)} />;
  }

  if (revealed) {
    return <Reveal animal={revealed} onContinue={() => setRevealed(null)} />;
  }

  if (view.pendingReward) {
    return <Chests reward={view.pendingReward} onOpen={openChest} />;
  }

  if (menuOpen) {
    return <Menu onClose={() => setMenuOpen(false)} />;
  }

  const before = view.regions[regionIndex - 1];
  const after = view.regions[regionIndex + 1];

  return (
    /*
     * The scene is the region's, passed as a custom property rather than set
     * in the stylesheet: which place a child is standing in is content, and the
     * stylesheet is not where the world's geography should be written down.
     */
    <main
      className="map"
      style={{ "--map-scene": `url("${region.background}")` } as CSSProperties}
    >
      <StarCounter stars={view.stars} />
      <button
        type="button"
        className="menu-button"
        aria-label="Menú"
        onClick={() => setMenuOpen(true)}
      >
        <MenuIcon />
      </button>
      {/*
        An ordered list because the world is a sequence: that is what a screen
        reader should hear, and it is what the connecting line draws.

        Named "Mundo" whichever region is on screen: it is one map showing one
        place at a time, not two navigations. Which place that is comes from the
        doors at its ends, which say where they lead.
      */}
      <nav aria-label="Mundo" className="map__world" ref={panWorld}>
        <ol className="world-path">
          {before ? (
            <li>
              <RegionDoor
                region={before}
                direction="back"
                onEnter={() => setRegionIndex(regionIndex - 1)}
              />
            </li>
          ) : null}
          {region.nodes.map((node) => (
            <li key={node.id}>
              <WorldNode node={node} onSelect={select} />
            </li>
          ))}
          {after ? (
            <li>
              <RegionDoor
                region={after}
                direction="on"
                onEnter={() => setRegionIndex(regionIndex + 1)}
              />
            </li>
          ) : null}
        </ol>
      </nav>
      <Collection slots={view.collection} />
    </main>
  );
}

/**
 * Every letriestrella won so far, in the map's top-left corner.
 *
 * A running total rather than a per-chapter mark: stars are paid for playing,
 * including replaying, and a number that only ever goes up is the part of the
 * world a child can move on their own. It is display only — nothing here is
 * pressable — and it lives on the map alone, because a total counting up
 * beside a running game is a second thing to watch.
 */
function StarCounter({ stars }: { stars: number }) {
  return (
    <section className="star-counter" aria-label="Letriestrellas">
      <StarIcon />
      <span className="star-counter__count">{stars}</span>
    </section>
  );
}

/**
 * The adult's way in, in the map's top-right corner.
 *
 * Empty for now: it is the place the app's own settings will live, kept apart
 * from the world so that nothing on the map is about the app rather than about
 * playing. It takes the screen rather than floating over the map, like every
 * other screen here — a panel a child can tap through is a way to leave the
 * world by accident.
 */
function Menu({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <main className="menu" role="dialog" aria-modal="true" aria-label="Menú">
      <button
        type="button"
        className="menu__close"
        aria-label="Cerrar el menú"
        onClick={onClose}
      >
        <CloseIcon />
      </button>
    </main>
  );
}

/**
 * What the finish itself was worth.
 *
 * Shown after every finish, before the chests when a chapter is owed them, so
 * the two rewards are never the same beat: this one says "you played", the
 * chests say "you got somewhere new". The stars are already banked when this
 * appears — the screen is the telling, not the giving.
 */
function StarAward({
  amount,
  onContinue
}: {
  amount: number;
  onContinue: () => void;
}) {
  return (
    <main className="award">
      <div className="award__prize" role="status">
        {/* Decoration: the line below is what says how many. */}
        <ul className="award__stars" aria-hidden="true">
          {Array.from({ length: amount }, (_, index) => (
            <li key={index}>
              <StarIcon />
            </li>
          ))}
        </ul>
        <p className="award__count">¡+{amount} letriestrellas!</p>
      </div>
      <button type="button" className="reveal__continue" onClick={onContinue}>
        Seguir
      </button>
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
    <section
      className="collection"
      aria-label="Mis animales"
      ref={useDragScroll()}
    >
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
                  Empty `alt`: the name is the accessible text, and a screen
                  reader announcing the picture as well would say it twice.

                  Spoken but not drawn, like the empty slot below it. A child of
                  three does not read the label, the picture is the animal they
                  remember winning, and a word under every square turns a row of
                  animals into a row of text.
                */}
                <img src={slot.animal.imageUrl} alt="" />
                <span className="collection__name visually-hidden">
                  {slot.animal.label}
                </span>
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

        The animal is alone here. The duende handed over the chests and stayed
        on that screen; putting him beside the prize as well would make the
        reveal about the pair rather than about the animal.
      */}
      <div className="reveal__prize" role="status">
        <img className="reveal__animal" src={animal.imageUrl} alt="" />
        <p className="reveal__name">¡{animal.label}!</p>
      </div>
      <button type="button" className="reveal__continue" onClick={onContinue}>
        Seguir
      </button>
    </main>
  );
}

/**
 * The way out of a region and into the one beside it.
 *
 * It stands at the end of the path like a chapter and is built like one — same
 * disc, same size, same picture-first rule — because to a child it is the same
 * gesture: the next thing along the road. What it shows is the place it leads
 * to, so the door out of the farm is a window onto the forest.
 *
 * A door with nothing open behind it is locked and says so, exactly as a
 * chapter does. The way back is never locked: a child who walked here has to
 * be able to walk home, and the chapters that wait on this region are there.
 */
function RegionDoor({
  region,
  direction,
  onEnter
}: {
  region: MapRegionView;
  direction: "back" | "on";
  onEnter: () => void;
}) {
  const titleId = useId();
  const stateId = useId();
  const open = direction === "back" || region.reachable;

  return (
    <button
      type="button"
      className="world-node region-door"
      data-direction={direction}
      data-state={open ? "unlocked" : "locked"}
      disabled={!open}
      aria-labelledby={titleId}
      aria-describedby={stateId}
      onClick={onEnter}
    >
      <span className="world-node__marker" aria-hidden="true">
        <img className="world-node__icon" src={region.background} alt="" />
        {open ? (
          /* Which way the road goes, for a child who reads neither the title
             nor the position of the door on a path they have to scroll. */
          <span className="region-door__way">
            <BackArrow />
          </span>
        ) : (
          <LockIcon />
        )}
      </span>
      <span className="world-node__title" id={titleId}>
        {region.title}
      </span>
      <span className="world-node__state" id={stateId}>
        {open ? "Ir" : "Bloqueado"}
      </span>
    </button>
  );
}

/**
 * One chapter on the path.
 *
 * The marker is the chapter's own picture, as large as the row allows. A child
 * of three does not read the title and cannot count, so a numbered disc named
 * nothing: the picture is what they remember a chapter by and what they aim a
 * finger at. Nothing on the marker is a glyph — the number is gone, and a
 * locked chapter says so with a padlock over its picture rather than by hiding
 * it, because what is behind the lock is the reason to come back.
 */
function WorldNode({
  node,
  onSelect
}: {
  node: MapNodeView;
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
        {/*
          Empty `alt`: the title beside it is the accessible name, and a screen
          reader announcing the picture as well would say the chapter twice.
        */}
        <img className="world-node__icon" src={node.icon} alt="" />
        {node.state === "locked" ? <LockIcon /> : null}
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

/**
 * A letriestrella, drawn rather than loaded.
 *
 * Same reason as the chest: it is on screen the instant a game ends, and on a
 * classroom panel's cold cache a picture that arrives late would make the
 * reward look like an afterthought.
 */
function StarIcon() {
  return (
    <svg viewBox="0 0 100 96" width="100%" height="100%" aria-hidden="true">
      <path
        d="M50 4 63.5 33.8 96 37.6 71.9 59.6 78.4 91.6 50 75.6 21.6 91.6 28.1 59.6 4 37.6 36.5 33.8Z"
        fill="#f4c95d"
        stroke="#c98a1b"
        strokeWidth="5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The padlock over a chapter that has not opened yet.
 *
 * Drawn rather than the emoji it replaced: an emoji is a glyph a font decides
 * the shape of, and this one sits over an illustration at a size where a
 * platform's stray colour scheme would show.
 */
function LockIcon() {
  return (
    <svg
      className="world-node__lock"
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <path
        d="M32 46V34a18 18 0 0 1 36 0v12"
        fill="none"
        stroke="#4a3a63"
        strokeWidth="11"
        strokeLinecap="round"
      />
      <rect x="22" y="44" width="56" height="44" rx="9" fill="#4a3a63" />
      <circle cx="50" cy="63" r="7" fill="#e7e1ef" />
      <rect x="46" y="63" width="8" height="15" rx="4" fill="#e7e1ef" />
    </svg>
  );
}

/** Three bars: the one shape an adult reads as "everything else" without a word. */
function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <path
        d="M4 7h16M4 12h16M4 17h16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
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
