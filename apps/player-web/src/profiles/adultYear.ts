/** A year is four digits, and the pad shows four blanks to say so. */
export const ADULT_YEAR_DIGITS = 4;

/** Old enough to be the adult answering for a child. */
export const MINIMUM_ADULT_AGE = 18;

/** Nobody alive was born before this, so nothing earlier is a real answer. */
export const OLDEST_PLAUSIBLE_AGE = 110;

/**
 * Whether a typed year could belong to the adult on the other side of the gate.
 *
 * **This verifies nothing.** The app has never been told when any adult was
 * born and has nowhere to check, so what this asks is not "is that your year"
 * but "is that a year an adult could have been born in". The gate is a lock
 * against the three-year-old holding the tablet, not authorization — invariant
 * 4's real boundary arrives with accounts, in Rules, and nothing here may ever
 * be mistaken for it.
 *
 * What makes it work on a preschooler is the shape of the answer rather than
 * its truth. A four-digit number is beyond a child who is still learning
 * letters, their own year of birth is refused by construction, and the window
 * of years that pass is a small slice of the ten thousand a mashed pad could
 * produce.
 */
export function isAdultBirthYear(digits: string, today: Date): boolean {
  if (!new RegExp(`^\\d{${ADULT_YEAR_DIGITS}}$`).test(digits)) return false;

  const age = today.getFullYear() - Number(digits);
  return age >= MINIMUM_ADULT_AGE && age <= OLDEST_PLAUSIBLE_AGE;
}
