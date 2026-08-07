import type { AvatarId, PlayerProfileId } from "./ids";

/** The twelve months, so that a thirteenth is a compile error. */
export type Month = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/**
 * When a child was born, or that nobody has said.
 *
 * A union rather than an optional field because the unknown case is real and
 * permanent, not a gap waiting to be filled: the starter profile is created
 * from progress that already exists on the device, and no one was there to ask.
 * Two cases mean two renderings — an age, or an invitation to supply one — and
 * the compiler demands both wherever a profile is drawn.
 *
 * A month and a year, never a day. An age in whole years is all this product
 * shows, so the day is data it would hold without ever using.
 */
export type Birth =
  | { readonly known: true; readonly month: Month; readonly year: number }
  | { readonly known: false };

/**
 * Who is playing, on this device.
 *
 * Local to the browser today. When accounts exist a profile becomes a child
 * record under a group, and this shape is what that record is read into, which
 * is why it lives here rather than in the player.
 *
 * Deliberately not `ChildRecord`: that is the roster record template
 * participant selection consumes, and it requires a photo asset and a
 * pronunciation recording that a local profile has neither of.
 */
export interface PlayerProfile {
  readonly id: PlayerProfileId;
  /** A first name, chosen by an adult. Never logged. */
  readonly name: string;
  readonly avatarId: AvatarId;
  readonly birth: Birth;
}

/**
 * Whole years old, or `null` when nobody has said when the child was born.
 *
 * `today` is a parameter because a component must not read the clock: an age
 * that changes under a render is untestable, and the one place time enters the
 * app should be its edge.
 *
 * The birth month counts as reached on its first day. With no day recorded
 * there is no more precise answer available, and rounding a child up on the
 * first of their birthday month is the reading a parent would give.
 */
export function ageInYears(birth: Birth, today: Date): number | null {
  if (!birth.known) return null;

  const monthsElapsed =
    (today.getFullYear() - birth.year) * 12 +
    (today.getMonth() + 1 - birth.month);

  return Math.floor(monthsElapsed / 12);
}
