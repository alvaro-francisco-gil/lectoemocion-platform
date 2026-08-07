/**
 * The shell's icons, drawn rather than loaded.
 *
 * Every one of these is on screen the instant a screen appears — the chests the
 * moment a game ends, the star beside every price in the shop — and on the
 * classroom panel's cold cache a picture that arrives a beat late makes the
 * reward look like an afterthought. They are inline SVG for that reason, and
 * they live together because more than one screen now draws the same star.
 *
 * All are `aria-hidden`: each is placed beside text that already says what it
 * is, or inside a control that carries its own label.
 */

/** A closed chest. Three of these are the ceremony after a first finish. */
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

/** A letriestrella: what a finish pays and what a coupon costs. */
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
 * A wrapped present: the way into the shop.
 *
 * A parcel rather than a shopping trolley or a coin. A child of three has been
 * given a present; they have not been to a checkout, and the reward here is a
 * promise from an adult rather than a thing that is bought.
 */
export function GiftIcon() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
      <rect x="10" y="40" width="80" height="52" rx="8" fill="#e07a9c" />
      <rect x="6" y="28" width="88" height="20" rx="6" fill="#f2a0bb" />
      <rect x="42" y="28" width="16" height="64" fill="#f7d774" />
      <path
        d="M50 30C42 30 30 26 30 18s12-6 20 12c8-18 20-20 20-12S58 30 50 30Z"
        fill="#f7d774"
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
