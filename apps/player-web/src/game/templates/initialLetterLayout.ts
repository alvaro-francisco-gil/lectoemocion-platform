/**
 * Where the initial-letter game puts its two rows, in logical canvas units.
 *
 * Its own module, free of Phaser, for the same reason the letters game has
 * one: the end-to-end suite has to know where to press, and a test carrying
 * copies of these numbers would keep passing after the rows moved and the game
 * stopped being reachable by a child.
 *
 * The letter cards are smaller than the pictures they answer. A single letter
 * in a full-size card reads as a mostly empty box, and the board then looks
 * like the same kind of thing twice rather than pictures above and letters
 * below.
 */
export const INITIAL_LETTER_LAYOUT = {
  canvasWidth: 1280,
  canvasHeight: 720,
  bannerY: 60,
  pictureRowY: 360,
  letterRowY: 590,
  /* The picture card's own size is the shared `CARD.size`, not repeated here. */
  letterCardSize: 140,
  letterFontSize: 72,
  maximumSpacing: 260,
  rowWidth: 1200
} as const;

/** The centre of the `index`th card in a centred row of `total`. */
export function initialLetterColumnX(index: number, total: number): number {
  const spacing = Math.min(
    INITIAL_LETTER_LAYOUT.maximumSpacing,
    INITIAL_LETTER_LAYOUT.rowWidth / total
  );
  return (
    INITIAL_LETTER_LAYOUT.canvasWidth / 2 + (index - (total - 1) / 2) * spacing
  );
}
