import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from "react";
import {
  assertNever,
  type ChildRecord,
  type PlayerProfileId,
  type PrizeContent,
  type PrizeId,
  type PrizeImageId
} from "@lectoemocion/domain";
import {
  worldNodes,
  type CollectibleAnimal
} from "@lectoemocion/resource-schema";
import { createResourceForNode, world } from "@lectoemocion/template-catalog";
import { createGame } from "../game/createGame";
import { rosterForBuild } from "../world/devRoster";
import {
  deriveWorldView,
  EMPTY_PROGRESS,
  STARS_PER_COMPLETION,
  type CollectionSlotView,
  type PendingRewardView,
  type Progress,
  type WorldNodeView
} from "../world/worldView";
import { LocalProgressStore } from "../world/progressStore";
import { derivePrizeView, EMPTY_PRIZES, type Prizes } from "../world/prizes";
import {
  LOCAL_GROUP,
  LocalPrizeStore,
  systemImageId,
  systemMinter
} from "../world/prizeStore";
import {
  LocalPrizeImageStore,
  downscaleToDataUrl,
  type PrizePick
} from "../world/prizeImageStore";
import { unlockAllEnabled } from "../world/unlockAll";
import {
  NO_ARRIVAL,
  nextArrival,
  type Motion
} from "../world/starArrival";
import { bookShape } from "./bookShape";
import { cardTint, type CardTint } from "./cardTints";
import { useDragScroll } from "./useDragScroll";
import { avatarImageUrl } from "../profiles/avatarCatalogue";
import {
  LocalProfileStore,
  ProfileStoreError,
  type ProfileBook,
  type ProfileDraft
} from "../profiles/profileStore";
import { ProfileMenu } from "./ProfileMenu";
import { AdultArea } from "./adult";
import { Gift } from "./Gift";
import { BackArrow, ChestIcon, GiftIcon, StarIcon } from "./icons";
import { PrizeCount, PrizeRing, StarFlight } from "./PrizeReadout";

/*
 * A store that answers nothing, for a browser that has no storage at all —
 * private mode, or a locked-down panel. The session still plays; it just does
 * not persist.
 */
const memoryStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined
};

const browserStorage =
  typeof localStorage === "undefined" ? memoryStorage : localStorage;

const profiles = new LocalProfileStore(browserStorage, () =>
  crypto.randomUUID()
);

/**
 * Which section a child is standing in.
 *
 * Multijugador is absent on purpose. A section with nothing behind it is a
 * button, not a place, so it cannot be a value here: a screen that cannot be
 * built is a state that cannot be represented, rather than one rejected at
 * runtime.
 */
type TabId = "juegos" | "recursos";

/**
 * How many chests the duende offers.
 *
 * A question about the ceremony rather than about the world, which is why it
 * lives here and not in the schema: every chest holds the chapter's one animal,
 * so this is how wide the choice looks, not how many outcomes there are. Three
 * is what a child aged 3–5 can hold in mind at once.
 */
const CHEST_COUNT = 3;

/**
 * How long the book stays up while it stamps an animal in.
 *
 * The stamp itself runs for most of it; the rest is the beat afterwards where
 * the animal is simply sitting in the page among the others, which is the part
 * a child is actually being shown. It agrees with the `book-stamp` animation in
 * `styles.css`, and this is the only number that has to.
 */
const STAMP_VISIBLE_MS = 1850;

/**
 * The world shell.
 *
 * It owns progression: it reads progress, derives the world, routes into a
 * resource, and records completion. No template sees `Progress` — each receives
 * a manifest and a completion callback, and reports back.
 *
 * There is no page header. The row of cards is the whole world screen, and a
 * playing resource shows only the way back: chrome above a game competes with
 * it at a child's eye level, and a permanent list of destinations is a way
 * around the progression.
 *
 * Exactly one screen is on at a time: a playing resource, the letriestrellas
 * just won, the animal just revealed, the chests owed for a first finish, the
 * gift ceremony, the adult area, or a section. They are exclusive rather than
 * layered so that nothing a child can touch is ever hidden behind something
 * else.
 *
 * Two things are layers over the world instead. The profile drawer is one: a
 * child needs to see the world is still there while an adult changes who is
 * playing, and what the exclusivity rule was protecting — a tap landing on
 * something hidden — is handled by the scrim and by `select` refusing while the
 * drawer is up. The animal book is the other: it is a record of what a child has
 * done, not a place to go, so looking at it must not cost them their place in
 * the world.
 *
 * The roster is a prop with a build-derived default rather than a value read
 * inside. This is the composition root, so where the children come from is
 * decided here and nowhere below — and a test can then render the shell with no
 * roster and see what a school sees, which is the state that actually ships
 * until photo and recording capture lands.
 */
export function App({
  roster = rosterForBuild(import.meta.env.DEV)
}: {
  readonly roster?: readonly ChildRecord[];
} = {}) {
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
  const [revealed, setRevealed] = useState<PendingRewardView | null>(null);
  /*
   * The adult area and the gift are screens of their own rather than layers, so
   * which one is on is one fact. A pair of booleans could say "both", and both
   * is not a state this shell has.
   */
  const [detour, setDetour] = useState<"none" | "adult" | "gift">("none");
  /*
   * The drawer is a layer rather than a screen, so it is not part of which
   * screen is on: the world stays mounted underneath it.
   */
  const [menuOpen, setMenuOpen] = useState(false);
  /* Whether the child asked to see the book. */
  const [animalBookOpen, setAnimalBookOpen] = useState(false);
  /*
   * The chapter whose animal is being stamped into the book right now.
   *
   * It opens the book on its own and closes it again, so this is not the same
   * question as `animalBookOpen`: one is the child asking to look, the other is the
   * book showing them what just arrived.
   */
  const [stamping, setStamping] = useState<string | null>(null);
  /*
   * Everyone who plays on this device. `null` until the first read lands —
   * which is a frame, and the corner simply has no face in it until then.
   */
  const [book, setBook] = useState<ProfileBook | null>(null);
  /*
   * A profile problem an adult has to see. Profiles cannot be re-derived from
   * anything on the device, so this fails closed rather than resetting: the
   * unreadable data is left exactly where it is, to be recovered.
   */
  const [profileError, setProfileError] = useState<string | null>(null);
  /*
   * Which section the child is standing in. Session state, deliberately not
   * stored: the app is for playing, so it opens on the games rather than on
   * whichever tab a child happened to leave open last week.
   */
  const [tab, setTab] = useState<TabId>("juegos");
  const host = useRef<HTMLDivElement>(null);
  /* Where the stars are flying to. Measured, never derived from the stylesheet. */
  const pill = useRef<HTMLParagraphElement>(null);
  const panWorld = useDragScroll();

  /*
   * What the corner is drawing, which is behind what the child has earned for
   * about a second after every finish. It lives here rather than on the world
   * screen because the world is unmounted for the whole ceremony — the stars,
   * the chests, the reveal, the regalo — and state inside it would be rebuilt
   * from the new truth before anyone could see the old one.
   */
  const [arrival, dispatchArrival] = useReducer(nextArrival, NO_ARRIVAL);

  /* Read once: a preference that changes mid-session changes nothing in flight. */
  const motion: Motion = useMemo(
    () =>
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "reduced"
        : "full",
    []
  );

  useEffect(() => {
    let cancelled = false;
    void profiles.read().then(
      (next) => {
        if (!cancelled) setBook(next);
      },
      (error: unknown) => {
        if (!cancelled) setProfileError(describeProfileFailure(error));
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * One progress store per child, namespaced by their profile id. This is the
   * seam `progressStore.ts` was written with: what used to be the constant
   * `LOCAL_OWNER` is now whoever is playing, and the starter profile carries
   * that same string so nothing already on the device moves.
   */
  const selectedId = book?.selectedId ?? null;
  const progressStore = useMemo(
    () =>
      selectedId === null
        ? null
        : new LocalProgressStore(browserStorage, selectedId),
    [selectedId]
  );

  /*
   * The prizes are two things owned by two people, behind one store.
   *
   * The goal is the group's — one family or one class, one line every child in
   * it fills a meter towards — and the gifts are the child's, namespaced by the
   * same profile id their progress is. So a sibling picking up the tablet sees
   * their own meter fill against the goal an adult set once, and never a regalo
   * they did not earn. The pictures follow the gifts, because a photo an adult
   * took belongs to the gift it is inside.
   *
   * `LOCAL_GROUP` is the one implicit group, exactly as the starter profile is
   * the one implicit child; both become real ids at the Firestore stage with no
   * caller changing.
   *
   * Built here rather than beside `profiles` above for the same reason the
   * progress store is: a store carries an in-memory fallback for a browser that
   * denies storage, and one built at module scope carries that fallback across
   * every mount the module ever sees.
   */
  const prizeStore = useMemo(
    () =>
      selectedId === null
        ? null
        : new LocalPrizeStore(
            browserStorage,
            { group: LOCAL_GROUP, child: selectedId },
            systemMinter()
          ),
    [selectedId]
  );
  const imageStore = useMemo(
    () =>
      selectedId === null
        ? null
        : new LocalPrizeImageStore(browserStorage, selectedId),
    [selectedId]
  );

  /*
   * Which child's truth `progress` and `prizes` actually answer for, as
   * opposed to the placeholder shown while storage is asked.
   *
   * The arrival reducer's `!started` branch exists so a session opening on
   * stars already banked shows them outright instead of flying them in — "what
   * is already banked is not an event". But `progress` and `prizes` load one
   * storage round trip after `selectedId` settles, so the corner's very first
   * reading of them would otherwise land on the placeholder's zero rather than
   * the child's real total, spending that one no-fly opportunity on a number
   * that was never true.
   *
   * An identity rather than a boolean, and compared against `selectedId` at
   * render time rather than latched in an effect: a boolean set `true` by the
   * previous child's read is still `true`, unchanged, on the very render
   * `selectedId` moves to the next child — a stale "ready" that seeds the new
   * child's counter with the old child's number. Comparing *which child* each
   * store last answered for cannot lag that way, because `selectedId` itself
   * is already the fresh value on that same render.
   */
  const [progressReadFor, setProgressReadFor] = useState<PlayerProfileId | null>(
    null
  );
  const [prizesReadFor, setPrizesReadFor] = useState<PlayerProfileId | null>(
    null
  );

  useEffect(() => {
    if (progressStore === null) return;
    let cancelled = false;
    /*
     * Cleared before the read, not after it. Holding the previous child's
     * total on screen for the frame it takes to load the next one shows a
     * child stars that are not theirs.
     */
    setProgress(EMPTY_PROGRESS);
    void progressStore.read().then(
      (stored) => {
        if (!cancelled) {
          setProgress(stored);
          setProgressReadFor(selectedId);
        }
      },
      (error: unknown) => {
        /*
         * Invariant 6: a broken read fails closed with an adult-facing error
         * rather than leaving the child's readout silently absent forever.
         * Routed through the same failure screen a profile read already uses,
         * rather than a second error surface for the same kind of problem.
         */
        if (!cancelled) setProfileError(describeProfileFailure(error));
      }
    );
    return () => {
      cancelled = true;
    };
  }, [progressStore, selectedId]);

  /* Cleared before the read for the same reason, and it matters more here: a
     frame of the previous child's gifts is a wrapped box on the map that is not
     this child's to open. */
  useEffect(() => {
    if (prizeStore === null) return;
    let cancelled = false;
    setPrizes(EMPTY_PRIZES);
    void prizeStore.read().then(
      (stored) => {
        if (!cancelled) {
          setPrizes(stored);
          setPrizesReadFor(selectedId);
        }
      },
      (error: unknown) => {
        if (!cancelled) setProfileError(describeProfileFailure(error));
      }
    );
    return () => {
      cancelled = true;
    };
  }, [prizeStore, selectedId]);

  const view = useMemo(
    () =>
      deriveWorldView(world, progress, {
        unlockAll: unlockAllEnabled(),
        hasRoster: roster.length > 0
      }),
    [progress, roster]
  );

  const prizeView = useMemo(
    () => derivePrizeView(prizes, view.stars),
    [prizes, view.stars]
  );

  /*
   * Declared before the reading below, and the reading depends on `selectedId`
   * as well as on the number itself. Effects run in the order they are written,
   * so the reset lands first — and the reading that follows it is what re-seeds
   * the new child's count, including when their total happens to equal the last
   * child's and the number alone would not have changed.
   */
  useEffect(() => {
    dispatchArrival({ type: "reset" });
  }, [selectedId]);

  const dataReady =
    progressReadFor === selectedId && prizesReadFor === selectedId;
  useEffect(() => {
    if (!dataReady) return;
    dispatchArrival({ type: "reading", filled: prizeView.filled, motion });
  }, [prizeView.filled, motion, selectedId, dataReady]);

  const arrive = useCallback(() => dispatchArrival({ type: "arrived" }), []);
  const land = useCallback(() => dispatchArrival({ type: "landed" }), []);

  /**
   * The open chapter and the colour its card was wearing, together.
   *
   * One object rather than two lookups, so "a chapter is open but has no
   * colour" is a state the shell cannot get into: the game and its background
   * are decided at the same moment, from the same section list that drew the
   * card. The row is what decides a tint, so the row is what answers for it.
   */
  const active = useMemo(() => {
    if (activeNodeId === null) return null;
    for (const section of [view.games, view.resources]) {
      const index = section.findIndex((node) => node.id === activeNodeId);
      if (index === -1) continue;
      const node = worldNodes(world).find((entry) => entry.id === activeNodeId);
      /* The view is derived from the world; a node in one and not the other is
         a broken invariant, not a chapter to open onto a default (invariant 6). */
      if (node === undefined) {
        throw new Error(`Chapter ${activeNodeId} is in the view but not the world`);
      }
      return { node, tint: cardTint(index) };
    }
    return null;
  }, [view, activeNodeId]);

  const select = useCallback(
    (nodeId: string) => {
      /*
       * Nothing in the world opens while the drawer is up. The scrim already
       * covers it, but a stylesheet is not a guarantee — one missed
       * `pointer-events` rule would drop a child into a game they never chose.
       */
      if (menuOpen) return;
      const target = view.nodes.find((node) => node.id === nodeId);
      /* Dimming a locked node is presentation; refusing to open it is the rule. */
      if (!target?.playable) return;
      setActiveNodeId(nodeId);
    },
    [view, menuOpen]
  );

  const complete = useCallback(
    (nodeId: string) => {
      if (progressStore === null) return;
      void progressStore.recordCompletion(nodeId).then((next) => {
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
    },
    [progressStore]
  );

  const openChest = useCallback(
    (reward: PendingRewardView) => {
      if (progressStore === null) return;
      /*
       * Recorded before it is shown. A child who is handed an animal and then
       * loses it to a closing tab has been given nothing, and the reveal is the
       * one part of this that can safely be replayed.
       */
      setRevealed(reward);
      void progressStore
        .claimReward(reward.nodeId, reward.animal.animalId)
        .then(setProgress);
    },
    [progressStore]
  );

  /*
   * Every profile change lands here, so the drawer never holds a book of its
   * own to drift from this one.
   */
  const applyProfileChange = useCallback(
    (change: Promise<ProfileBook>) => {
      void change.then(setBook, (error: unknown) => {
        setProfileError(describeProfileFailure(error));
      });
    },
    []
  );

  /*
   * The reveal hands over to the book: the animal a child has just been shown
   * travels into the page and is stamped where its shadow was.
   */
  const acknowledgeReveal = useCallback((nodeId: string) => {
    setRevealed(null);
    setStamping(nodeId);
  }, []);

  /*
   * The book closes itself once the stamp has landed and been looked at.
   *
   * Nothing is tapped in any of it. A child at the end of a chapter has already
   * made every choice this ceremony asks for, and a modal they must dismiss to
   * get back to the world is one more thing between them and playing again.
   */
  useEffect(() => {
    if (stamping === null) return;
    const timer = setTimeout(() => setStamping(null), STAMP_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [stamping]);

  /*
   * Awarding is a write — a prize needs an identity and a moment — so it cannot
   * be derived the way the meter is. It runs off `due`, which is derived, so a
   * tab closed between the last frame of a game and this effect still finds the
   * prize owed on the next read.
   */
  useEffect(() => {
    if (prizeStore === null || prizeView.due === 0) return;
    void prizeStore.awardDue(view.stars).then(setPrizes);
  }, [prizeView.due, view.stars, prizeStore]);

  /** Awarded and not yet opened, oldest first — the one the child is owed next. */
  const waiting = prizeView.pending[0] ?? null;

  /*
   * Which prize the ceremony is showing, tracked by id rather than read from
   * `pending`: opening a gift moves it to `"opened"`, which drops it out of
   * `pending` on the very next render. Deriving the ceremony's prize from
   * `pending` would lose it at exactly the moment a child taps `¡Ábrelo!` —
   * the screen would fall through to the world, or to whatever prize is next in
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
   * appearing quietly in the corner of a busy world is a thing a child does not
   * find. Once dismissed it waits on the world instead — `shown` is what keeps
   * the ceremony from re-entering every render for a prize already shown.
   *
   * Guarded on `ceremonyPrizeId === null` as well: opening the prize on
   * screen drops it out of `pending`, which changes `waiting` to whatever is
   * next — without this guard that would swap the ceremony to the next prize
   * mid-reveal, a second gift jumping the queue in front of the one the child
   * is still looking at.
   *
   * And it waits for the animal's stamp to land. A chapter that both owes a
   * chest and reaches the goal pays two ceremonies in a row, and the book is a
   * layer over the world rather than a screen — a gift taking the screen while
   * it is up would replace the very frame the stamp is drawn in, so the child
   * would never see the animal arrive.
   */
  const shown = useRef<PrizeId | null>(null);
  useEffect(() => {
    if (
      !waiting ||
      stamping !== null ||
      ceremonyPrizeId !== null ||
      shown.current === waiting.id
    ) {
      return;
    }
    shown.current = waiting.id;
    setCeremonyPrizeId(waiting.id);
    setDetour("gift");
  }, [waiting, ceremonyPrizeId, stamping]);

  const openGift = useCallback(
    (id: PrizeId) => {
      if (prizeStore === null) return;
      void prizeStore.open(id).then(setPrizes);
    },
    [prizeStore]
  );

  const continueFromGift = useCallback(() => {
    setDetour("none");
    setCeremonyPrizeId(null);
  }, []);

  const setPrizeGoal = useCallback(
    (goal: number) => {
      if (prizeStore === null) return;
      void prizeStore.setGoal(goal).then(setPrizes);
    },
    [prizeStore]
  );

  const configure = useCallback(
    (id: PrizeId, content: PrizeContent) => {
      if (prizeStore === null) return;
      void prizeStore.configure(id, content).then(setPrizes);
    },
    [prizeStore]
  );

  /**
   * Takes what an adult picked, shrinks it, and keeps it under its own key.
   *
   * Says which way it failed rather than returning nothing: a picture the
   * browser could not read and a store with no room are different things to
   * tell an adult, and either one silently answering "no picture" is how a
   * prize gets saved by someone who believes a photo is attached. The form
   * saves the words regardless — the half an adult actually reads aloud.
   */
  const pickImage = useCallback(
    async (file: File): Promise<PrizePick> => {
      /*
       * Unreachable: the adult area is only mounted from a screen that already
       * knows who is playing. Explicit rather than defaulted, because either
       * silent answer here — "no picture" or a picture filed under nobody — is
       * a lie told to the adult saving the gift.
       */
      if (imageStore === null) {
        throw new Error("A prize picture needs the child it belongs to");
      }
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
    },
    [imageStore]
  );

  /**
   * Drops a picture no prize points at any more.
   *
   * Every kept picture is a key of its own, so one the adult replaced or moved
   * away from would sit in storage for ever — deletion is a capability, not an
   * afterthought, and this is the smallest place it belongs.
   */
  const discardImage = useCallback(
    (id: PrizeImageId) => {
      if (imageStore === null) return;
      void imageStore.remove(id);
    },
    [imageStore]
  );

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
    if (imageStore === null) return;
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
  }, [ceremonyPrize, imageStore]);

  useEffect(() => {
    const parent = host.current;
    if (!active || !parent) return;

    const game = createGame(
      parent,
      createResourceForNode(active.node, roster),
      active.tint.wash,
      () => complete(active.node.id)
    );
    return () => game.destroy(true);
  }, [active, complete, roster]);

  /*
   * A child's own data that cannot be read stops everything, deliberately —
   * their profiles, their progress, and their regalos all land here.
   *
   * Invariant 6: this is a broken invariant, not a missing nicety, and the
   * alternative — carrying on with an invented profile — would write a fresh
   * book over the one that failed to parse and destroy a family's progress
   * with it. Nothing is written until an adult has seen this.
   */
  if (profileError !== null) {
    return (
      <main className="profile-failure" role="alert">
        <h1>No se pueden leer los datos del niño</h1>
        <p>{profileError}</p>
        <p>
          No se ha borrado nada. Vuelve a abrir la aplicación; si sigue igual,
          avisa a quien la instaló.
        </p>
      </main>
    );
  }

  /*
   * Nothing is playable until the app knows whose progress it would be writing.
   *
   * The window is a microtask against local storage, but it is not nothing: a
   * chapter finished inside it would have no profile to pay, and the stars
   * would be dropped. Waiting is the only answer that cannot lose them.
   */
  if (book === null) {
    return <main className="loading" aria-busy="true" aria-label="Cargando" />;
  }

  if (active) {
    return (
      /*
       * The wash goes on the shell, not only into Phaser: the canvas keeps a
       * fixed 16:9 and every other shape of screen letterboxes it, so a colour
       * that stopped at the canvas would leave the chapter's own colour in a
       * band of the shell's lavender.
       */
      <main
        className="playing"
        style={{ "--game-wash": active.tint.wash } as CSSProperties}
      >
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
    return (
      <Reveal
        animal={revealed.animal}
        onContinue={() => acknowledgeReveal(revealed.nodeId)}
      />
    );
  }

  if (view.pendingReward) {
    return <Chests reward={view.pendingReward} onOpen={openChest} />;
  }

  /*
   * The stamp finishes before the gift takes the screen.
   *
   * A chapter can both owe a chest and reach the goal, and the book is a layer
   * over the world rather than a screen of its own — so a gift returning here
   * while the animal is landing would replace the very frame the stamp is drawn
   * in, and the child would never see it arrive. The gift is not lost by
   * waiting: it is held in `detour`, and this renders it the moment the book
   * has taken itself away.
   */
  if (detour === "gift" && ceremonyPrize && stamping === null) {
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
        today={new Date()}
        onSetGoal={setPrizeGoal}
        onConfigure={configure}
        onPickImage={pickImage}
        onDiscardImage={discardImage}
        onClose={() => setDetour("none")}
      />
    );
  }

  const standing = tab === "juegos" ? view.games : view.resources;
  const playing =
    book.profiles.find((profile) => profile.id === book.selectedId) ?? null;
  /*
   * Whether the animal book is covering the world right now — stamping an
   * arrival in on its own, or opened by the child's own tap on the paw. One
   * name for both, used at both places it draws: a flight gate and a render
   * condition that read this two different ways could drift the moment either
   * one changes without the other, which is exactly how the flight gate below
   * once fell out of step with what the book actually opens on.
   */
  const bookOverlaid = animalBookOpen || stamping !== null;

  return (
    <main className="world">
      {playing ? (
        <button
          type="button"
          className="profile-button"
          aria-label={`Quién juega: ${playing.name}`}
          onClick={() => setMenuOpen(true)}
        >
          <img src={avatarImageUrl(playing.avatarId)} alt="" />
        </button>
      ) : null}
      <PrizeCount
        shown={arrival.shown}
        arriving={arrival.flight !== null}
        landings={arrival.landings}
        pill={pill}
      />
      {/*
        Withheld while the animal book is overlaying the world — stamping an
        arrival in, or opened by the child's own tap. `StarFlight`'s mount is
        the one signal `arrival` gets that the corner is actually visible, and
        a flight that plays out behind the book is a flight the child never
        sees, landing in a corner the book is covering. Gated on `bookOverlaid`
        rather than `stamping` alone, so a child opening the book mid-flight
        does unmount `StarFlight` and clear its timers — a flight resumes,
        restarted, when the book closes, and the count still lands exactly
        right, because any landings the restart double-schedules are swallowed
        as stray timers on a flight that has already cleared. A flight the
        child cannot see is worse than a flight that restarts.
      */}
      {bookOverlaid ? null : (
        <StarFlight
          flight={arrival.flight}
          pill={pill}
          onArrive={arrive}
          onLanded={land}
        />
      )}
      {/*
        The reward corner, as one column.

        What is already won and what is still filling are two answers to the
        same question, so they stand in one place rather than two: the box at
        the bottom, where a hand lands and where the child's eye starts, and
        the ring above it. Rendered even when both halves are empty — an empty
        column draws nothing, and a container that appears and disappears would
        make the corner's order a thing each branch has to remember.
      */}
      <div className="world__gifts">
        <PrizeRing
          shown={arrival.shown}
          goal={prizeView.goal}
          landings={arrival.landings}
        />
        {waiting ? (
          <button
            type="button"
            className="world__gift"
            aria-label={
              prizeView.pending.length > 1
                ? `Tus regalos: ${prizeView.pending.length}`
                : "Tu regalo"
            }
            onClick={() => {
              setCeremonyPrizeId(waiting.id);
              setDetour("gift");
            }}
          >
            <GiftIcon />
            {/*
              How many are wrapped, drawn only when it is more than one. The
              button's own name says it in words, so the badge is decoration:
              a screen reader that read both would hear the number twice.
            */}
            {prizeView.pending.length > 1 ? (
              <span className="world__gift-count" aria-hidden="true">
                {prizeView.pending.length}
              </span>
            ) : null}
          </button>
        ) : null}
      </div>
      {/*
        An ordered list because a section is a sequence: that is what a screen
        reader should hear, and it is what the connecting line draws.

        Named "Mundo" whichever section is on screen: it is one row of places to
        go, not two navigations. Which section it is showing is said by the bar
        below it, which is where that question belongs.
      */}
      <nav aria-label="Mundo" className="world__row" ref={panWorld}>
        <ol className="world-path">
          {/*
            The tint comes from the card's place in the row rather than from
            the node, because it is decoration: what colour a chapter is is not
            a fact about the chapter. Cycling by position is also what
            guarantees no two neighbours match.
          */}
          {standing.map((node, index) => (
            <li key={node.id}>
              <WorldNode node={node} tint={cardTint(index)} onSelect={select} />
            </li>
          ))}
        </ol>
      </nav>
      <TabBar tab={tab} onChange={setTab} />
      <button
        type="button"
        className="collection-button"
        aria-label="Mis animales"
        onClick={() => setAnimalBookOpen(true)}
      >
        <PawIcon />
      </button>
      {menuOpen ? (
        <ProfileMenu
          book={book}
          today={new Date()}
          onClose={() => setMenuOpen(false)}
          onSelect={(id) => applyProfileChange(profiles.select(id))}
          onAdd={(draft: ProfileDraft) =>
            applyProfileChange(profiles.add(draft))
          }
          onUpdate={(id, draft) =>
            applyProfileChange(profiles.update(id, draft))
          }
          onRemove={(id) => applyProfileChange(profiles.remove(id))}
          onOpenAdultArea={() => {
            setMenuOpen(false);
            setDetour("adult");
          }}
        />
      ) : null}
      {/*
        Above the world rather than instead of it. The book is a record, so
        opening it must not move a child anywhere, and closing it must not cost
        them the section and the scroll position they were standing in.
      */}
      {bookOverlaid && (
        <AnimalBook
          slots={view.collection}
          stamping={stamping}
          onClose={() => {
            setAnimalBookOpen(false);
            setStamping(null);
          }}
        />
      )}
    </main>
  );
}

/**
 * The three sections, as a bar along the bottom.
 *
 * Low and central, because unlike the star counter and the menu this is
 * something a child uses: the corners are for the app talking, the bottom band
 * is where hands land.
 *
 * Multijugador is a button that refuses rather than a section that is missing.
 * A child shown three doors who finds one shut has learned the shape of the
 * app; one shown two learns it again the day the third appears.
 */
function TabBar({
  tab,
  onChange
}: {
  tab: TabId;
  onChange: (tab: TabId) => void;
}) {
  return (
    <nav className="tab-bar" aria-label="Secciones">
      <ul className="tab-bar__tabs">
        <li>
          <Tab id="juegos" label="Juegos" tab={tab} onChange={onChange}>
            <GamesIcon />
          </Tab>
        </li>
        <li>
          <Tab id="recursos" label="Recursos" tab={tab} onChange={onChange}>
            <ShelfIcon />
          </Tab>
        </li>
        <li>
          <button type="button" className="tab" disabled data-state="locked">
            <span className="tab__icon" aria-hidden="true">
              <LockIcon />
            </span>
            <span className="tab__label">Multijugador</span>
            {/*
              Spoken but not drawn. The dimming says "shut" to someone looking
              at it; this is the same sentence for someone who is not.
            */}
            <span className="visually-hidden">Bloqueado</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

function Tab({
  id,
  label,
  tab,
  onChange,
  children
}: {
  id: TabId;
  label: string;
  tab: TabId;
  onChange: (tab: TabId) => void;
  children: ReactNode;
}) {
  const current = tab === id;
  return (
    <button
      type="button"
      className="tab"
      /*
       * `aria-current`, not `aria-pressed`: these are destinations, and where
       * you are standing is not a switch you have turned on.
       */
      {...(current ? { "aria-current": "page" as const } : {})}
      onClick={() => onChange(id)}
    >
      <span className="tab__icon" aria-hidden="true">
        {children}
      </span>
      <span className="tab__label">{label}</span>
    </button>
  );
}

/**
 * What to tell an adult when a profile operation fails.
 *
 * `ProfileStoreError` carries a message written for them; anything else is a
 * defect, and saying so is more use than showing its internals.
 */
function describeProfileFailure(error: unknown): string {
  return error instanceof ProfileStoreError
    ? error.message
    : "Ha ocurrido un fallo inesperado.";
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
 * The book of animals: one page per chapter, in world order.
 *
 * A modal over the world rather than a screen of its own. It is a record of
 * what a child has done, not a place to go, so looking at it does not move
 * them and closing it does not cost them where they were standing.
 *
 * Every page carries its chapter's animal from the very first screen. Until it
 * is won it is drawn as that animal's shadow, so the book shows a child which
 * animal is still owed rather than merely that something is. Display only:
 * nothing on the page is a button.
 */
function AnimalBook({
  slots,
  stamping,
  onClose
}: {
  slots: readonly CollectionSlotView[];
  /** The chapter whose animal is landing right now, if one is. */
  stamping: string | null;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  /*
   * The stylesheet cannot count the chapters, and it must not guess: a fixed
   * number of columns is what let an eleventh chapter add a row the paper had
   * no room for. So both shapes are decided here and handed over, and the
   * stylesheet picks between them on the shape of the room it has — which is
   * the one thing it knows and this does not.
   */
  const wide = bookShape(slots.length);
  const tall = bookShape(slots.length, true);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  /*
   * Focus moves in and comes back out again.
   *
   * A screen replacing another took this for granted — there was nothing left
   * behind to tab into. An overlay leaves the whole world underneath, so a
   * keyboard or a screen reader would otherwise wander into a map nobody can
   * see.
   *
   * It lands on the book itself rather than on a control, because there is no
   * control: the book holds nothing to press.
   */
  useEffect(() => {
    const restore = document.activeElement;
    dialog.current?.focus();
    return () => {
      if (restore instanceof HTMLElement) restore.focus();
    };
  }, []);

  return (
    /*
     * The way out is the world around it, not a cross in the corner.
     *
     * A child who wants to stop looking at their animals points at the thing
     * they want instead, which is what tapping outside already is. The cross
     * was a second thing to learn, drawn small in a corner and reading as chrome
     * on a page that is meant to be a book.
     *
     * Only a tap on the scrim itself closes it — `currentTarget` rather than
     * anything inside — so putting a finger on the animals leaves the book open.
     * Escape does the same for a keyboard, which is what a dialog with nothing
     * focusable in it needs.
     */
    <div
      ref={dialog}
      tabIndex={-1}
      className="animal-book"
      role="dialog"
      aria-modal="true"
      aria-label="Mis animales"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <ul
        className="animal-book__pages"
        style={
          {
            "--book-columns-wide": wide.columns,
            "--book-rows-wide": wide.rows,
            "--book-columns-tall": tall.columns,
            "--book-rows-tall": tall.rows
          } as CSSProperties
        }
      >
        {slots.map((slot) => (
          <li
            key={slot.nodeId}
            className="animal-book__page"
            data-earned={slot.earned}
            data-stamping={slot.nodeId === stamping}
          >
            {/*
              The same picture in both states, in the same place and at the
              same size: winning one changes its colour and nothing else, so a
              child finds the animal they just won exactly where its shadow
              was.

              Empty `alt` throughout — the text beside it is the accessible
              name, and a screen reader announcing the picture as well would
              say it twice.
            */}
            <span className="animal-book__well">
              <img src={slot.animal.imageUrl} alt="" />
            </span>
            {/*
              Spoken but not drawn. A child of three does not read the label,
              the picture is the animal they remember winning, and a word under
              every page would turn the book into a page of text.
            */}
            <span className="animal-book__name visually-hidden">
              {slot.earned ? slot.animal.label : `${slot.title}: todavía no`}
            </span>
          </li>
        ))}
      </ul>
    </div>
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
  onOpen: (reward: PendingRewardView) => void;
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
        {/*
          Three chests, one animal. Which one a child opens changes nothing,
          and that is the point: choosing is the ceremony, and a chapter that
          could hand over any of three animals could not show the shadow of
          what it owes in the book.
        */}
        <ul className="chests">
          {Array.from({ length: CHEST_COUNT }, (_unused, index) => (
            <li key={index}>
              <button
                type="button"
                className="chest"
                aria-label={`Abrir el cofre ${index + 1}`}
                onClick={() => onOpen(reward)}
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
 * One chapter, as a card.
 *
 * The card is the chapter's own picture, filling a rectangle edge to edge. A
 * child of three does not read the title and cannot count, so a numbered disc
 * named nothing: the picture is what they remember a chapter by and what they
 * aim a finger at, and a rectangle is the shape that gives an illustration the
 * most of itself. The title rides on a chip over the picture, for the adult and
 * the screen reader.
 *
 * A locked chapter says so with a padlock over its picture rather than by
 * hiding it, because what is behind the lock is the reason to come back.
 */
function WorldNode({
  node,
  tint,
  onSelect
}: {
  node: WorldNodeView;
  tint: CardTint;
  onSelect: (nodeId: string) => void;
}) {
  const titleId = useId();
  const stateId = useId();
  return (
    <button
      type="button"
      className="world-node"
      data-state={node.state}
      style={{ "--card-tint": tint.card } as CSSProperties}
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
        {node.playable ? null : <LockIcon />}
      </span>
      <span className="world-node__title" id={titleId}>
        {node.title}
      </span>
      <span className="world-node__state" id={stateId}>
        {stateLabel(node)}
      </span>
      {/*
        The one thing on this screen addressed to an adult rather than a child.
        It is written on the card instead of waiting behind a tap, because the
        card cannot be tapped: what is missing is not something a child can go
        and get, so nothing here should invite them to try.
      */}
      {node.state === "needs-roster" ? (
        <span className="world-node__note">{NEEDS_ROSTER_NOTE}</span>
      ) : null}
    </button>
  );
}

const NEEDS_ROSTER_NOTE =
  "Añade los nombres y las fotos de los niños para abrir este libro";

/** Spoken by a screen reader and read by an adult; never carried by colour alone. */
function stateLabel(node: WorldNodeView): string {
  switch (node.state) {
    case "locked":
      return "Bloqueado";
    /* Not "Bloqueado": nothing here is waiting on the child. */
    case "needs-roster":
      return "Faltan los nombres";
    case "completed":
      return "Completado";
    case "unlocked":
      return node.kind === "cinematic" ? "Historia" : "Jugar";
    default:
      return assertNever(node.state, "world node state");
  }
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

/**
 * A die: the one shape that reads as "things to play" without a word.
 *
 * Drawn rather than loaded, like every other icon here. The bar is on screen
 * before anything else is, and on a classroom panel's cold cache a picture that
 * arrives a beat late would leave a child with three unlabelled buttons.
 */
function GamesIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" fill="currentColor" />
      <circle cx="8.5" cy="8.5" r="1.8" fill="#2c1250" />
      <circle cx="15.5" cy="15.5" r="1.8" fill="#2c1250" />
      <circle cx="15.5" cy="8.5" r="1.8" fill="#2c1250" />
      <circle cx="8.5" cy="15.5" r="1.8" fill="#2c1250" />
    </svg>
  );
}

/** An open book: the shelf holds one, and will hold more of the same kind. */
function ShelfIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <path
        d="M12 6.5C10.2 5.2 7.8 4.8 4 5.2v13c3.8-.4 6.2 0 8 1.3 1.8-1.3 4.2-1.7 8-1.3v-13c-3.8-.4-6.2 0-8 1.3Z"
        fill="currentColor"
      />
      <path d="M12 6.5v13" fill="none" stroke="#2c1250" strokeWidth="1.6" />
    </svg>
  );
}

/** A paw: what the collection is full of, at a size where a word would not fit. */
function PawIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
      <circle cx="7" cy="8" r="2.4" fill="currentColor" />
      <circle cx="12" cy="6" r="2.4" fill="currentColor" />
      <circle cx="17" cy="8" r="2.4" fill="currentColor" />
      <circle cx="19.4" cy="13" r="2.1" fill="currentColor" />
      <path
        d="M12 11c3.2 0 5.6 2.4 5.6 4.9 0 2-1.6 3.1-3.4 3.1-1 0-1.6-.4-2.2-.4s-1.2.4-2.2.4c-1.8 0-3.4-1.1-3.4-3.1C6.4 13.4 8.8 11 12 11Z"
        fill="currentColor"
      />
    </svg>
  );
}
