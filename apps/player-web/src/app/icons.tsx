/**
 * The chrome drawn rather than loaded.
 *
 * Several of these are the first thing on screen after a game ends, and a
 * picture that arrives a beat late would make the ceremony stutter on the
 * classroom panel's cold cache.
 */

/**
 * A closed chest, drawn rather than loaded.
 *
 * Three of these are the first thing on screen after a game ends, and a
 * picture that arrives a beat late would make the ceremony stutter on the
 * classroom panel's cold cache.
 */
export function ChestIcon() {
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
export function StarIcon() {
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
 * The wrapped gift, distinct from the chests on purpose.
 *
 * `ChestIcon` already means the three chests a child chooses an animal from. A
 * second thing shaped like a chest would make the two rewards read as one.
 */
export function GiftIcon() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
      <rect x="10" y="38" width="80" height="52" rx="6" fill="#e05a72" />
      <rect x="6" y="26" width="88" height="18" rx="6" fill="#f2778c" />
      <rect x="42" y="26" width="16" height="64" fill="#f4c95d" />
      <path
        d="M50 26c-10-14-28-8-22 2 4 6 14 5 22-2Zm0 0c10-14 28-8 22 2-4 6-14 5-22-2Z"
        fill="#f4c95d"
      />
    </svg>
  );
}

/** Three bars: the one shape an adult reads as "everything else" without a word. */
export function MenuIcon() {
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

export function CloseIcon() {
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

export function BackArrow() {
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
