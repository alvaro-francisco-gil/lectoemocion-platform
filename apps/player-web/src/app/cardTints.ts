/**
 * The colour a chapter wears, on its card and behind its game.
 *
 * The palette is positional decoration: which colour a chapter gets is a fact
 * about where it stands in the row, not about the chapter. What changed is that
 * the colour no longer stops at the card. Opening a chapter now carries it onto
 * the canvas, so a child sees the pink card open into the pink game and knows,
 * without reading anything, that they are in the place they just pressed.
 *
 * That is why the palette lives here in TypeScript rather than in the
 * stylesheet: it has to reach Phaser, and a second copy of six hex values that
 * must agree with the first is the kind of duplication that silently drifts.
 * The stylesheet consumes these through custom properties.
 *
 * Nothing here is the sole carrier of any state. Locked says so with a padlock,
 * and every card's state is spoken.
 */

/**
 * A saturated field, dark enough to hold white text and light enough to
 * separate from the shell behind it.
 *
 * Six, because a row long enough to repeat has put four cards between the
 * repeats, which is further than a child compares — and cycling by position is
 * what guarantees no two neighbours match.
 */
const CARD_COLOURS = [
  "#e05299",
  "#2a9d8f",
  "#e07a3f",
  "#4361c9",
  "#7a4fc7",
  "#d64550"
] as const;

/** How many colours the row cycles through before repeating. */
export const CARD_TINT_COUNT = CARD_COLOURS.length;

/**
 * How much of the card's colour survives into the field behind the game.
 *
 * A whole screen of the card's own colour is a different proposition from a
 * card-sized patch of it: the saturated field that carries a cut-out
 * illustration across a classroom becomes, at full size, something every
 * template's dark text and white shapes have to fight. Mixing towards white
 * keeps the hue exactly — the mix is affine in every channel, so the ratios HSL
 * reads a hue from are untouched — while returning the contrast a pale shell
 * gave those templates in the first place.
 */
const WASH_STRENGTH = 0.12;

export interface CardTint {
  /** The card's own field, behind its illustration. */
  readonly card: string;
  /** The same colour at screen size: behind the game, and in its letterbox. */
  readonly wash: string;
}

/**
 * The tint for a card at `position` in its section, wrapping at the end of the
 * palette.
 *
 * Takes the raw position rather than an already-wrapped index so that the
 * modulo happens once, here, and no caller can pass an index the palette does
 * not have.
 */
export function cardTint(position: number): CardTint {
  const card = CARD_COLOURS[position % CARD_TINT_COUNT];
  /*
   * Unreachable for any non-negative integer, which is what a list index is.
   * It fails rather than defaults because a chapter with no colour is a broken
   * invariant, not a chapter to paint grey (invariant 6).
   */
  if (card === undefined) {
    throw new Error(`No card tint for position ${position}`);
  }
  return { card, wash: mixTowardsWhite(card, WASH_STRENGTH) };
}

function mixTowardsWhite(hex: string, strength: number): string {
  const channels = [1, 3, 5].map((offset) => {
    const channel = Number.parseInt(hex.slice(offset, offset + 2), 16);
    return Math.round(channel * strength + 255 * (1 - strength));
  });
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}
