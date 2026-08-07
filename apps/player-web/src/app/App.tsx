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
import type {
  PrizeContent,
  PrizeId,
  PrizeImageId
} from "@lectoemocion/domain";
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
import { derivePrizeView, EMPTY_PRIZES, type Prizes } from "../world/prizes";
import { LocalPrizeStore, systemMinter, systemImageId } from "../world/prizeStore";
import {
  LocalPrizeImageStore,
  downscaleToDataUrl,
  type PrizePick
} from "../world/prizeImageStore";
import { unlockAllEnabled } from "../world/unlockAll";
import { useDragScroll } from "./useDragScroll";
import { AdultArea } from "./adult";
import { Gift } from "./Gift";
import {
  BackArrow,
  ChestIcon,
  GiftIcon,
  MenuIcon,
  StarIcon
} from "./icons";

const storage =
  typeof localStorage === "undefined"
    ? { getItem: () => null, setItem: () => undefined }
    : localStorage;

const store = new LocalProgressStore(storage, LOCAL_OWNER);
const prizeStore = new LocalPrizeStore(storage, LOCAL_OWNER, systemMinter());
const imageStore = new LocalPrizeImageStore(
  typeof localStorage === "undefined"
    ? {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined
      }
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
 * gift ceremony, the adult area, or the map. They are exclusive rather than
 * layered so that nothing a child can touch is ever hidden behind something
 * else.
 */
export function App() {
  const [progress, setProgress] = useState<Progress>(EMPTY_PROGRESS);
  const [prizes, setPrizes] = useState<Prizes>(EMPTY_PRIZES);
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
  /*
   * The adult area and the gift are screens of their own rather than layers, so
   * which one is on is one fact. A pair of booleans could say "both", and both is
   * not a state this shell has.
   */
  const [detour, setDetour] = useState<"none" | "adult" | "gift">("none");
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
    void prizeStore.read().then((stored) => {
      if (!cancelled) setPrizes(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const view = useMemo(
    () => deriveMapView(world, progress, { unlockAll: unlockAllEnabled() }),
    [progress]
  );

  const prizeView = useMemo(
    () => derivePrizeView(prizes, view.stars),
    [prizes, view.stars]
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

  /*
   * Awarding is a write — a prize needs an identity and a moment — so it cannot
   * be derived the way the meter is. It runs off `due`, which is derived, so a
   * tab closed between the last frame of a game and this effect still finds the
   * prize owed on the next read.
   */
  useEffect(() => {
    if (prizeView.due === 0) return;
    void prizeStore.awardDue(view.stars).then(setPrizes);
  }, [prizeView.due, view.stars]);

  /** Awarded and not yet opened, oldest first — the one the child is owed next. */
  const waiting = prizeView.pending[0] ?? null;

  /*
   * Which prize the ceremony is showing, tracked by id rather than read from
   * `pending`: opening a gift moves it to `"opened"`, which drops it out of
   * `pending` on the very next render. Deriving the ceremony's prize from
   * `pending` would lose it at exactly the moment a child taps `¡Ábrelo!` —
   * the screen would fall through to the map, or to whatever prize is next in
   * `pending`. Reading the full list by id is what lets the reveal's render
   * see the same prize's `"opened"` state instead.
   */
  const [ceremonyPrizeId, setCeremonyPrizeId] = useState<PrizeId | null>(null);
  const ceremonyPrize = useMemo(
    () => prizes.prizes.find((prize) => prize.id === ceremonyPrizeId) ?? null,
    [prizes, ceremonyPrizeId]
  );

  /*
   * The gift takes the screen the first time it exists, because a wrapped box
   * appearing quietly in the corner of a busy map is a thing a child does not
   * find. Once dismissed it waits on the map instead — `shown` is what keeps
   * the ceremony from re-entering every render for a prize already shown.
   *
   * Guarded on `ceremonyPrizeId === null` as well: opening the prize on
   * screen drops it out of `pending`, which changes `waiting` to whatever is
   * next — without this guard that would swap the ceremony to the next prize
   * mid-reveal, a second gift jumping the queue in front of the one the child
   * is still looking at.
   */
  const shown = useRef<PrizeId | null>(null);
  useEffect(() => {
    if (!waiting || ceremonyPrizeId !== null || shown.current === waiting.id) {
      return;
    }
    shown.current = waiting.id;
    setCeremonyPrizeId(waiting.id);
    setDetour("gift");
  }, [waiting, ceremonyPrizeId]);

  const openGift = useCallback((id: PrizeId) => {
    void prizeStore.open(id).then(setPrizes);
  }, []);

  const continueFromGift = useCallback(() => {
    setDetour("none");
    setCeremonyPrizeId(null);
  }, []);

  const setPrizeGoal = useCallback((goal: number) => {
    void prizeStore.setGoal(goal).then(setPrizes);
  }, []);

  const configure = useCallback((id: PrizeId, content: PrizeContent) => {
    void prizeStore.configure(id, content).then(setPrizes);
  }, []);

  /**
   * Takes what an adult picked, shrinks it, and keeps it under its own key.
   *
   * Says which way it failed rather than returning nothing: a picture the
   * browser could not read and a store with no room are different things to
   * tell an adult, and either one silently answering "no picture" is how a
   * prize gets saved by someone who believes a photo is attached. The form
   * saves the words regardless — the half an adult actually reads aloud.
   */
  const pickImage = useCallback(async (file: File): Promise<PrizePick> => {
    const id = systemImageId();
    let dataUrl: string;
    try {
      dataUrl = await downscaleToDataUrl(file);
    } catch {
      return { ok: false, problem: "unreadable-picture" };
    }
    return (await imageStore.save(id, dataUrl))
      ? { ok: true, id }
      : { ok: false, problem: "no-room" };
  }, []);

  /**
   * Drops a picture no prize points at any more.
   *
   * Every kept picture is a key of its own, so one the adult replaced or moved
   * away from would sit in storage for ever — deletion is a capability, not an
   * afterthought, and this is the smallest place it belongs.
   */
  const discardImage = useCallback((id: PrizeImageId) => {
    void imageStore.remove(id);
  }, []);

  /*
   * `giftImage` is the custom picture, read from the image store for whatever
   * prize the ceremony is showing right now. Sourced from `ceremonyPrize`
   * rather than `waiting`, for the same reason the ceremony's content is: the
   * picture for the prize on screen must still resolve after it is opened,
   * once it has dropped out of `pending`. Unconfigured prizes have no content
   * to read, so they read as no picture rather than reaching into a field
   * they do not have.
   */
  const [giftImage, setGiftImage] = useState<string | null>(null);
  useEffect(() => {
    const content =
      ceremonyPrize?.state === "unconfigured" ? null : ceremonyPrize?.content;
    if (content?.kind !== "custom" || content.imageId === null) {
      setGiftImage(null);
      return;
    }
    let cancelled = false;
    void imageStore.read(content.imageId).then((url) => {
      if (!cancelled) setGiftImage(url);
    });
    return () => {
      cancelled = true;
    };
  }, [ceremonyPrize]);

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

  if (detour === "gift" && ceremonyPrize) {
    return (
      <Gift
        prize={ceremonyPrize}
        imageUrl={giftImage}
        onOpen={openGift}
        onPrepare={() => setDetour("adult")}
        onContinue={continueFromGift}
      />
    );
  }

  if (detour === "adult") {
    return (
      <AdultArea
        view={prizeView}
        currentYear={new Date().getFullYear()}
        onSetGoal={setPrizeGoal}
        onConfigure={configure}
        onPickImage={pickImage}
        onDiscardImage={discardImage}
        onClose={() => setDetour("none")}
      />
    );
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
      <PrizeMeter filled={prizeView.filled} goal={prizeView.goal} />
      <button
        type="button"
        className="menu-button"
        aria-label="Menú"
        onClick={() => setDetour("adult")}
      >
        <MenuIcon />
      </button>
      {waiting ? (
        <button
          type="button"
          className="map__gift"
          aria-label="Tu regalo"
          onClick={() => {
            setCeremonyPrizeId(waiting.id);
            setDetour("gift");
          }}
        >
          <GiftIcon />
        </button>
      ) : null}
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
 * How close the child is to the next regalo, in the map's top-left corner.
 *
 * Display only, and that is what keeps the reach-band rule intact: nothing a
 * child needs to touch sits at the top of an 86-inch panel. The star is still
 * the picture, because the stars are still what fills it.
 */
function PrizeMeter({ filled, goal }: { filled: number; goal: number }) {
  return (
    <section
      className="prize-meter"
      role="meter"
      aria-label="Letriestrellas hacia el próximo regalo"
      aria-valuenow={filled}
      aria-valuemin={0}
      aria-valuemax={goal}
    >
      <StarIcon />
      <span className="prize-meter__count">
        {filled} / {goal}
      </span>
      {/*
        Decoration: the count above is what says how far along the child is,
        and a screen reader reading the bar as well would say it twice.
      */}
      <span className="prize-meter__track" aria-hidden="true">
        <span
          className="prize-meter__fill"
          style={{ width: `${(filled / goal) * 100}%` }}
        />
      </span>
    </section>
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

