import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from "react";
import { assertNever, type ChildRecord } from "@lectoemocion/domain";
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
import { unlockAllEnabled } from "../world/unlockAll";
import { bookShape } from "./bookShape";
import { useDragScroll } from "./useDragScroll";
import { avatarImageUrl } from "../profiles/avatarCatalogue";
import {
  LocalProfileStore,
  ProfileStoreError,
  type ProfileBook,
  type ProfileDraft
} from "../profiles/profileStore";
import { ProfileMenu } from "./ProfileMenu";

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
 * How many card colours the row cycles through.
 *
 * It agrees with `.world-node[data-tint="N"]` in `styles.css`, and this is the
 * only number that has to: the palette itself is the stylesheet's business.
 * Six, because a row long enough to repeat has put four cards between the
 * repeats, which is further than a child compares.
 */
const CARD_TINTS = 6;

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
 * just won, the animal just revealed, the chests owed for a first finish, or a
 * section. They are exclusive rather than layered so that nothing a child can
 * touch is ever hidden behind something else.
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
  const panWorld = useDragScroll();

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

  useEffect(() => {
    if (progressStore === null) return;
    let cancelled = false;
    /*
     * Cleared before the read, not after it. Holding the previous child's
     * total on screen for the frame it takes to load the next one shows a
     * child stars that are not theirs.
     */
    setProgress(EMPTY_PROGRESS);
    void progressStore.read().then((stored) => {
      if (!cancelled) setProgress(stored);
    });
    return () => {
      cancelled = true;
    };
  }, [progressStore]);

  const view = useMemo(
    () =>
      deriveWorldView(world, progress, {
        unlockAll: unlockAllEnabled(),
        hasRoster: roster.length > 0
      }),
    [progress, roster]
  );

  const activeNode = useMemo(
    () => worldNodes(world).find((node) => node.id === activeNodeId) ?? null,
    [activeNodeId]
  );

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

  useEffect(() => {
    const parent = host.current;
    if (!activeNode || !parent) return;

    const game = createGame(parent, createResourceForNode(activeNode, roster), () =>
      complete(activeNode.id)
    );
    return () => game.destroy(true);
  }, [activeNode, complete, roster]);

  /*
   * Profiles that cannot be read stop everything, deliberately.
   *
   * Invariant 6: this is a broken invariant, not a missing nicety, and the
   * alternative — carrying on with an invented profile — would write a fresh
   * book over the one that failed to parse and destroy a family's progress
   * with it. Nothing is written until an adult has seen this.
   */
  if (profileError !== null) {
    return (
      <main className="profile-failure" role="alert">
        <h1>No se pueden leer los perfiles</h1>
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

  const standing = tab === "juegos" ? view.games : view.resources;
  const playing =
    book.profiles.find((profile) => profile.id === book.selectedId) ?? null;

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
      <StarCounter stars={view.stars} />
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
            a fact about the chapter, and the stylesheet is where colour lives.
            Cycling by position is also what guarantees no two neighbours match.
          */}
          {standing.map((node, index) => (
            <li key={node.id}>
              <WorldNode
                node={node}
                tint={index % CARD_TINTS}
                onSelect={select}
              />
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
        />
      ) : null}
      {/*
        Above the world rather than instead of it. The book is a record, so
        opening it must not move a child anywhere, and closing it must not cost
        them the section and the scroll position they were standing in.
      */}
      {(animalBookOpen || stamping !== null) && (
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
 * Every letriestrella won so far, in the world's top-right corner.
 *
 * A running total rather than a per-chapter mark: stars are paid for playing,
 * including replaying, and a number that only ever goes up is the part of the
 * world a child can move on their own. It is display only — nothing here is
 * pressable — and it lives on the world alone, because a total counting up
 * beside a running game is a second thing to watch.
 *
 * It moved here from the left when the avatar took that corner. The rule it
 * was placed by is unchanged: what was won and what an adult can change never
 * share a corner. They traded sides, and the child's own face earned the more
 * prominent one because it is what a pre-reader reads first.
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
  tint: number;
  onSelect: (nodeId: string) => void;
}) {
  const titleId = useId();
  const stateId = useId();
  return (
    <button
      type="button"
      className="world-node"
      data-state={node.state}
      data-tint={tint}
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
