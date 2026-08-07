/**
 * The gate in front of the adult area.
 *
 * This is not security and must never be described as such. It is a speed bump
 * sized to the actual threat — a curious three-year-old with a finger — and a
 * four-digit year on a numeric keypad is past what that child can do while
 * costing a literate adult two seconds. Anything stronger belongs with
 * accounts, where there is a real identity to check.
 *
 * The current year is a parameter so the domain holds no clock and the rule can
 * be tested at a fixed date.
 */
export const MIN_ADULT_AGE = 18;
export const MAX_ADULT_AGE = 100;

export function isPlausibleBirthYear(
  year: number,
  currentYear: number
): boolean {
  if (!Number.isSafeInteger(year)) return false;
  return (
    year <= currentYear - MIN_ADULT_AGE && year >= currentYear - MAX_ADULT_AGE
  );
}
