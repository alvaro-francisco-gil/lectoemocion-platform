import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import type {
  CouponDraft,
  CouponId,
  Purchase
} from "@lectoemocion/domain";
import type { CollectibleAnimal } from "@lectoemocion/resource-schema";
import { createResourceForNode, world } from "@lectoemocion/template-catalog";
import { createGame } from "../game/createGame";
import {
  deriveShopView,
  EMPTY_INCENTIVES,
  type Incentives
} from "../world/incentives";
import {
  LocalIncentiveStore,
  systemMinter
} from "../world/incentiveStore";
import {
  deriveMapView,
  EMPTY_PROGRESS,
  STARS_PER_COMPLETION,
  type CollectionSlotView,
  type MapNodeView,
  type PendingRewardView,
  type Progress
} from "../world/mapView";
import { LOCAL_OWNER, LocalProgressStore } from "../world/progressStore";
import { unlockAllEnabled } from "../world/unlockAll";
import { Coupons } from "./Coupons";
import {
  BackArrow,
  ChestIcon,
  CloseIcon,
  GiftIcon,
  MenuIcon,
  StarIcon
} from "./icons";
import { Shop } from "./Shop";
import { useDragScroll } from "./useDragScroll";

const storage =
  typeof localStorage === "undefined"
    ? { getItem: () => null, setItem: () => undefined }
    : localStorage;

const store = new LocalProgressStore(storage, LOCAL_OWNER);
const incentiveStore = new LocalIncentiveStore(
  storage,
  LOCAL_OWNER,
  systemMinter()
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
 * prize just bought, the shop, the menu, or the map. They are exclusive rather
 * than layered so that nothing a child can touch is ever hidden behind
 * something else.
 */
export function App() {
  const [progress, setProgress] = useState<Progress>(EMPTY_PROGRESS);
  const [incentives, setIncentives] = useState<Incentives>(EMPTY_INCENTIVES);
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
   * The prize just bought, held only until the child acknowledges it. Same
   * reason as the animal above: it is already paid for and already in the
   * history by the time this appears, so the screen is the telling.
   */
  const [bought, setBought] = useState<Purchase | null>(null);
  /*
   * The shop and the menu are screens of their own rather than layers, so which
   * one is on is one fact. A pair of booleans could say "both", and both is not
   * a state this shell has.
   */
  const [detour, setDetour] = useState<"none" | "shop" | "menu">("none");
  const host = useRef<HTMLDivElement>(null);
  const panWorld = useDragScroll();

  useEffect(() => {
    let cancelled = false;
    void store.read().then((stored) => {
      if (!cancelled) setProgress(stored);
    });
    void incentiveStore.read().then((stored) => {
      if (!cancelled) setIncentives(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const view = useMemo(
    () => deriveMapView(world, progress, { unlockAll: unlockAllEnabled() }),
    [progress]
  );

  const shop = useMemo(
    () => deriveShopView(incentives, view.stars),
    [incentives, view.stars]
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

  /**
   * Buying is the whole transaction: the stars are spent, the promise is owed,
   * and the history entry is the reminder an adult settles it against.
   *
   * The refusal is not surfaced as a message. The only way to reach one from
   * this screen is a coupon the shop already showed as out of reach and
   * disabled, or one an adult deleted in another tab — in both cases the shop
   * re-rendering from the store is the answer, not an error a child has to
   * dismiss.
   */
  const buy = useCallback(
    (couponId: CouponId) => {
      void incentiveStore.buy(couponId, view.stars).then((outcome) => {
        if (!outcome.ok) return;
        setIncentives(outcome.incentives);
        setBought(outcome.purchase);
      });
    },
    [view.stars]
  );

  const addCoupon = useCallback((draft: CouponDraft) => {
    void incentiveStore.addCoupon(draft).then(setIncentives);
  }, []);

  const editCoupon = useCallback((id: CouponId, draft: CouponDraft) => {
    void incentiveStore.editCoupon(id, draft).then(setIncentives);
  }, []);

  const removeCoupon = useCallback((id: CouponId) => {
    void incentiveStore.removeCoupon(id).then(setIncentives);
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

  if (bought) {
    return <Bought purchase={bought} onContinue={() => setBought(null)} />;
  }

  if (detour === "shop") {
    return <Shop view={shop} onBuy={buy} onClose={() => setDetour("none")} />;
  }

  if (detour === "menu") {
    return (
      <Menu onClose={() => setDetour("none")}>
        <Coupons
          coupons={incentives.coupons}
          history={shop.history}
          onAdd={addCoupon}
          onEdit={editCoupon}
          onRemove={removeCoupon}
        />
      </Menu>
    );
  }

  return (
    <main className="map">
      {/*
        The stars are the way into the shop — but only once an adult has
        promised something. With an empty shelf they stay the readout they were:
        a door a child opens onto nothing is worse than no door, and coupons are
        opt-in per family or class, so most deployments will never have one.
      */}
      <StarCounter
        stars={shop.balance}
        onOpenShop={
          shop.items.length === 0 ? null : () => setDetour("shop")
        }
      />
      <button
        type="button"
        className="menu-button"
        aria-label="Menú"
        onClick={() => setDetour("menu")}
      >
        <MenuIcon />
      </button>
      {/*
        An ordered list because the world is a sequence: that is what a screen
        reader should hear, and it is what the connecting line draws.
      */}
      <nav aria-label="Mundo" className="map__world" ref={panWorld}>
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
 * The letriestrellas there are to spend, in the map's top-left corner — and,
 * once there is anything to spend them on, the way to spend them.
 *
 * A balance rather than a lifetime total: the number in the corner has to be
 * the number a child compares against a price, or the shop refuses a coupon the
 * map said they could afford. Earned and spent are still kept apart in storage
 * — see `starBalance` — so nothing is ever unpaid, only used.
 *
 * Pressing the stars is the whole affordance. A child who wants to know what
 * their stars are for touches the stars; a second button elsewhere on the map
 * would be a thing to learn, and this is a thing to try. The present beside the
 * number is what says it is pressable to someone who cannot read the label.
 *
 * With no coupons it is a readout again, not a disabled control: a target that
 * does nothing teaches a child that pressing does nothing.
 *
 * This is the one place the player's reach-band rule is knowingly not applied —
 * see `AGENTS.md`. On a classroom panel a small child cannot touch this corner,
 * and an adult opens the shop for them. It is a deliberate trade for a single
 * obvious affordance on the surfaces where a child holds the device.
 */
function StarCounter({
  stars,
  onOpenShop
}: {
  stars: number;
  onOpenShop: (() => void) | null;
}) {
  if (onOpenShop === null) {
    return (
      <section className="star-counter" aria-label="Letriestrellas">
        <StarIcon />
        <span className="star-counter__count">{stars}</span>
      </section>
    );
  }

  return (
    <button
      type="button"
      className="star-counter star-counter--shop"
      /*
       * Named by the count *and* by what pressing does. The number alone would
       * announce a total and hide that it opens anything; "ver los premios"
       * alone would drop the one fact the child is here to check.
       */
      aria-label={`${stars} letriestrellas. Ver los premios`}
      onClick={onOpenShop}
    >
      <StarIcon />
      <span className="star-counter__count">{stars}</span>
      <span className="star-counter__gift" aria-hidden="true">
        <GiftIcon />
      </span>
    </button>
  );
}

/**
 * The adult's way in, in the map's top-right corner.
 *
 * The place the app's own settings live, kept apart from the world so that
 * nothing on the map is about the app rather than about playing. It takes the
 * screen rather than floating over the map, like every other screen here — a
 * panel a child can tap through is a way to leave the world by accident.
 *
 * There is no gate on it yet. Everything reachable from here is recoverable by
 * the adult who wrote it, and destructive actions ask twice; a PIN belongs with
 * accounts, not with a list of coupons on one device.
 */
function Menu({
  children,
  onClose
}: {
  children: ReactNode;
  onClose: () => void;
}) {
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
      <div className="menu__scroll">{children}</div>
    </main>
  );
}

/**
 * What the letriestrellas just bought.
 *
 * The same beat as the animal reveal, for the same reason: a reward a child is
 * not told about in the moment is one they did not feel they earned. It is
 * already paid and already in the history when this appears — the screen is the
 * telling, not the giving — and it names the promise rather than the price,
 * because the stars are spent and what is left is the football.
 */
function Bought({
  purchase,
  onContinue
}: {
  purchase: Purchase;
  onContinue: () => void;
}) {
  return (
    <main className="reveal">
      <div className="reveal__prize" role="status">
        <div className="reveal__gift">
          <GiftIcon />
        </div>
        <p className="reveal__name">¡{purchase.label}!</p>
      </div>
      <button type="button" className="reveal__continue" onClick={onContinue}>
        Seguir
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
