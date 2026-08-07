import type { PrizeId, PrizeImageId } from "./ids";

/**
 * The places a prize can be hidden, as a closed union rather than a branded id.
 *
 * The player's illustration lookup switches over this and closes with
 * `assertNever`, so adding a preset here fails to compile until it has a
 * picture and a phrase. A branded string would accept a new key silently and
 * render a child nothing.
 */
export type PrizePresetKey = "patio" | "mesa" | "puerta" | "habitacion";

export const PRIZE_PRESET_KEYS: readonly PrizePresetKey[] = [
  "patio",
  "mesa",
  "puerta",
  "habitacion"
];

export function isPrizePresetKey(value: unknown): value is PrizePresetKey {
  return (
    typeof value === "string" &&
    (PRIZE_PRESET_KEYS as readonly string[]).includes(value)
  );
}

/**
 * What is inside the gift.
 *
 * Custom text is required and the image is the optional half: the adult reads
 * the words aloud at the ceremony, so a photo with no words leaves nothing to
 * say.
 */
export type PrizeContent =
  | { readonly kind: "preset"; readonly preset: PrizePresetKey }
  | {
      readonly kind: "custom";
      readonly text: string;
      readonly imageId: PrizeImageId | null;
    };

/**
 * One gift, in one of three states.
 *
 * A union rather than optional fields, so "opened but never configured" cannot
 * be written down. `costStars` is recorded at award time: an adult changing the
 * goal must never rewrite what an earlier prize cost.
 */
export type Prize =
  | {
      readonly id: PrizeId;
      readonly state: "unconfigured";
      readonly awardedAt: string;
      readonly costStars: number;
    }
  | {
      readonly id: PrizeId;
      readonly state: "ready";
      readonly awardedAt: string;
      readonly costStars: number;
      readonly content: PrizeContent;
    }
  | {
      readonly id: PrizeId;
      readonly state: "opened";
      readonly awardedAt: string;
      readonly costStars: number;
      readonly content: PrizeContent;
      readonly openedAt: string;
    };

/** Ten finished chapters. Far enough to be worth waiting for, close enough to reach. */
export const DEFAULT_PRIZE_GOAL = 30;

/**
 * The bounds are a typo guard, not a design limit: at three letriestrellas a
 * chapter, a four-figure goal is a slipped keystroke rather than a decision.
 */
export const MIN_PRIZE_GOAL = 5;
export const MAX_PRIZE_GOAL = 200;

/** Long enough for a real promise, short enough to stay one line an adult reads. */
export const MAX_PRIZE_TEXT_LENGTH = 80;

export type PrizeGoalProblem = "not-a-whole-number" | "out-of-range";

export type PrizeGoalCheck =
  | { readonly ok: true; readonly goal: number }
  | { readonly ok: false; readonly problem: PrizeGoalProblem };

/**
 * Checks a goal an adult typed, and says which part is wrong.
 *
 * A result rather than a throw: the caller is a form with an adult mid-sentence
 * in it, and it must say what to fix rather than fail.
 */
export function checkPrizeGoal(value: number): PrizeGoalCheck {
  if (!Number.isSafeInteger(value)) {
    return { ok: false, problem: "not-a-whole-number" };
  }
  if (value < MIN_PRIZE_GOAL || value > MAX_PRIZE_GOAL) {
    return { ok: false, problem: "out-of-range" };
  }
  return { ok: true, goal: value };
}

export type CustomPrizeProblem = "empty-text" | "text-too-long";

export type CustomPrizeCheck =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly problem: CustomPrizeProblem };

/** Same contract as `checkPrizeGoal`, for the words an adult will read aloud. */
export function checkCustomPrize(text: string): CustomPrizeCheck {
  const trimmed = text.trim();
  if (trimmed.length === 0) return { ok: false, problem: "empty-text" };
  if (trimmed.length > MAX_PRIZE_TEXT_LENGTH) {
    return { ok: false, problem: "text-too-long" };
  }
  return { ok: true, text: trimmed };
}
