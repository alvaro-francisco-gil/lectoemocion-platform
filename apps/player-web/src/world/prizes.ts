import {
  DEFAULT_PRIZE_GOAL,
  type Prize,
  type PrizeContent,
  type PrizeId
} from "@lectoemocion/domain";

/**
 * What the adults set and what the child has been given.
 *
 * Separate from `Progress` on purpose. Progress is what a child did; this is
 * what the adults around them decided a star is worth, and the two change for
 * entirely different reasons.
 *
 * One shape, two owners. The goal belongs to the group — one family or one
 * class, one line to reach — and the gifts belong to the child who earned them,
 * exactly as their stars do. They are stored apart and composed here, so
 * `derivePrizeView` stays the one place a prize's state is decided and no
 * screen has to know the split exists.
 */
export interface Prizes {
  readonly goal: number;
  readonly prizes: readonly Prize[];
}

/** The group's half: the line every child in it fills a meter towards. */
export interface PrizeGoal {
  readonly goal: number;
}

/** The child's half: the gifts they have earned, in the order they earned them. */
export interface ChildGifts {
  readonly prizes: readonly Prize[];
}

export const DEFAULT_GOAL: PrizeGoal = { goal: DEFAULT_PRIZE_GOAL };
export const NO_GIFTS: ChildGifts = { prizes: [] };

/** The two stored halves, as the one shape every consumer already reads. */
export function composePrizes(goal: PrizeGoal, gifts: ChildGifts): Prizes {
  return { goal: goal.goal, prizes: gifts.prizes };
}

export const EMPTY_PRIZES: Prizes = composePrizes(DEFAULT_GOAL, NO_GIFTS);

/** The identity and the moment a prize is about to be awarded. */
export interface PrizeMint {
  readonly id: PrizeId;
  /** ISO 8601, in UTC. */
  readonly at: string;
}

/** Every letriestrella already spent on a prize, at the price it cost then. */
export function starsClaimed(prizes: Prizes): number {
  return prizes.prizes.reduce((total, prize) => total + prize.costStars, 0);
}

/**
 * Whether a goal can be divided into. `checkPrizeGoal` is what stops a bad
 * goal being saved, but this module must not trust that it was called: a
 * goal of zero or less would divide by nothing or below it, and a fractional
 * one has no honest "one prize's worth" to count in whole numbers. Failing
 * closed here means a goal that slips past the boundary above owes nothing
 * rather than inventing prizes out of `Infinity` or `NaN`.
 */
function isDivisible(goal: number): boolean {
  return Number.isInteger(goal) && goal > 0;
}

/**
 * How many prizes the child has earned and not yet been given.
 *
 * Derived rather than remembered, the same way `pendingReward` is: closing the
 * tab between the last frame of a game and the ceremony must not cost a prize.
 * Because `costStars` is recorded per prize, lowering the goal owes one at
 * once and raising it simply moves the line the current fill is measured
 * against.
 */
export function prizesDue(prizes: Prizes, starsEarned: number): number {
  if (!isDivisible(prizes.goal)) return 0;
  const unclaimed = starsEarned - starsClaimed(prizes);
  if (unclaimed < prizes.goal) return 0;
  return Math.floor(unclaimed / prizes.goal);
}

/**
 * Awards every prize owed, in one step.
 *
 * Takes one mint per prize so identities and timestamps come from the caller
 * and a test can name them. A mint short of what is owed awards what it can:
 * the rest stays owed and is awarded on the next read, which is the honest
 * outcome of running out of names rather than a silently skipped reward.
 */
export function awardDue(
  prizes: Prizes,
  starsEarned: number,
  mints: readonly PrizeMint[]
): Prizes {
  const due = Math.min(prizesDue(prizes, starsEarned), mints.length);
  if (due === 0) return prizes;

  const awarded: Prize[] = [];
  for (let index = 0; index < due; index += 1) {
    const mint = mints[index];
    if (mint === undefined) break;
    awarded.push({
      id: mint.id,
      state: "unconfigured",
      awardedAt: mint.at,
      costStars: prizes.goal
    });
  }
  return { ...prizes, prizes: [...prizes.prizes, ...awarded] };
}

/**
 * Says what is inside a gift.
 *
 * An id the list no longer holds changes nothing, and an already-opened prize
 * is left alone: what a child has already been shown is a fact about that
 * moment and must not change because an adult edited something afterwards.
 */
export function configurePrize(
  prizes: Prizes,
  id: PrizeId,
  content: PrizeContent
): Prizes {
  const target = prizes.prizes.find((prize) => prize.id === id);
  if (target === undefined || target.state === "opened") return prizes;

  return {
    ...prizes,
    prizes: prizes.prizes.map((prize) =>
      prize.id === id
        ? {
            id: prize.id,
            state: "ready",
            awardedAt: prize.awardedAt,
            costStars: prize.costStars,
            content
          }
        : prize
    )
  };
}

/**
 * Opens a gift that is ready.
 *
 * An unconfigured gift cannot be opened — there is nothing inside to show — and
 * an opened one stays opened, so a double tap cannot restamp the moment.
 */
export function openPrize(
  prizes: Prizes,
  id: PrizeId,
  at: string
): Prizes {
  const target = prizes.prizes.find((prize) => prize.id === id);
  if (target === undefined || target.state !== "ready") return prizes;

  return {
    ...prizes,
    prizes: prizes.prizes.map((prize) =>
      prize.id === id && prize.state === "ready"
        ? { ...prize, state: "opened", openedAt: at }
        : prize
    )
  };
}

/** Moves the line the meter is measured against. Awarded prizes keep their cost. */
export function setGoal(prizes: Prizes, goal: number): Prizes {
  return { ...prizes, goal };
}

export interface PrizeView {
  readonly goal: number;
  /** Never more than the goal: a meter fuller than full says nothing. */
  readonly filled: number;
  readonly due: number;
  /**
   * Awarded and not yet opened, oldest first — the longest wait is owed first.
   *
   * What the *child* is owed: a wrapped box on the map is a box either way,
   * whether or not an adult has said yet what is inside it.
   */
  readonly pending: readonly Prize[];
  /**
   * The subset of `pending` no adult has filled in yet — what the adult area
   * offers a blank form for. Split out here rather than filtered by that
   * screen, so this stays the one place a prize's state is given a meaning.
   */
  readonly unprepared: readonly Prize[];
  /** The subset of `pending` already filled in, waiting on the child to open it. */
  readonly prepared: readonly Prize[];
  /** Opened, newest first: what a child asks about is what they just opened. */
  readonly history: readonly Prize[];
}

/**
 * Projects the prize list onto what a child has earned.
 *
 * Pure, and the only place that decides whether a gift is owed — the same
 * division `deriveWorldView` draws, so no screen grows its own opinion.
 */
export function derivePrizeView(
  prizes: Prizes,
  starsEarned: number
): PrizeView {
  const unclaimed = Math.max(0, starsEarned - starsClaimed(prizes));
  const filled = isDivisible(prizes.goal)
    ? Math.min(unclaimed, prizes.goal)
    : 0;
  return {
    goal: prizes.goal,
    filled,
    due: prizesDue(prizes, starsEarned),
    pending: prizes.prizes.filter((prize) => prize.state !== "opened"),
    unprepared: prizes.prizes.filter((prize) => prize.state === "unconfigured"),
    prepared: prizes.prizes.filter((prize) => prize.state === "ready"),
    history: prizes.prizes.filter((prize) => prize.state === "opened").reverse()
  };
}
