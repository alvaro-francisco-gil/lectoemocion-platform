/**
 * Where the syllables game puts its two rows, in logical canvas units.
 *
 * Its own module, free of Phaser, for the same reason `lettersLayout.ts` is:
 * the end-to-end suite has to know where to press, and a test that hard-codes
 * these numbers would keep passing after the layout moved and the game stopped
 * being reachable. Importing the renderer instead would drag Phaser into a Node
 * process.
 *
 * Both rows sit in the lower reach band. A child aged 3–5 cannot touch the top
 * of an 86-inch panel, so only the picture goes up there.
 */
export const SYLLABLES_LAYOUT = {
  canvasWidth: 1280,
  canvasHeight: 720,
  pictureY: 210,
  /** The word being built, above the syllables to pick from. */
  slotRowY: 430,
  trayRowY: 610,
  cardWidth: 150,
  cardHeight: 110,
  maximumSpacing: 190,
  rowWidth: 1180
} as const;

/** The centre of the `index`th card in a centred row of `total`. */
export function syllableColumnX(index: number, total: number): number {
  const spacing = Math.min(
    SYLLABLES_LAYOUT.maximumSpacing,
    SYLLABLES_LAYOUT.rowWidth / total
  );
  return SYLLABLES_LAYOUT.canvasWidth / 2 + (index - (total - 1) / 2) * spacing;
}
