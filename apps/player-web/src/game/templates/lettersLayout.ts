/**
 * Where the letters game puts its two rows, in logical canvas units.
 *
 * Its own module, free of Phaser, because the end-to-end suite has to know
 * where to press: a test that hard-codes these numbers would keep passing
 * after the layout moved and the game stopped being reachable. Importing the
 * renderer instead would drag Phaser into a Node process.
 *
 * Both rows sit in the lower reach band. A child aged 3–5 cannot touch the top
 * of an 86-inch panel, so only the picture goes up there.
 */
export const LETTERS_LAYOUT = {
  canvasWidth: 1280,
  canvasHeight: 720,
  pictureY: 175,
  /** The letters to pick from, above the word being built. */
  trayRowY: 430,
  slotRowY: 600,
  cardWidth: 110,
  cardHeight: 110,
  maximumSpacing: 150,
  rowWidth: 1180
} as const;

/** The centre of the `index`th card in a centred row of `total`. */
export function letterColumnX(index: number, total: number): number {
  const spacing = Math.min(
    LETTERS_LAYOUT.maximumSpacing,
    LETTERS_LAYOUT.rowWidth / total
  );
  return LETTERS_LAYOUT.canvasWidth / 2 + (index - (total - 1) / 2) * spacing;
}
