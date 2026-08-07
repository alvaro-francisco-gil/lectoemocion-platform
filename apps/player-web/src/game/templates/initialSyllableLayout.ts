/**
 * Where the initial-syllable game puts its target and its three choices, in
 * logical canvas units.
 *
 * Its own Phaser-free module for the same reason as `lettersLayout.ts`: the
 * end-to-end suite has to know where to press, and a test that hard-coded these
 * numbers would keep passing after the layout moved and the game stopped being
 * reachable.
 *
 * Only the choices need to be reachable. The target is shown, not touched, so
 * it sits above the child reach band and the row of choices sits inside it.
 */
export const INITIAL_SYLLABLE_LAYOUT = {
  canvasWidth: 1280,
  canvasHeight: 720,
  bannerY: 42,
  targetY: 200,
  targetSize: 220,
  /** Where the target's word appears once the answer is revealed. */
  targetWordY: 335,
  choiceRowY: 540,
  choiceSize: 190,
  /** Where the chosen word appears beneath it, on the reveal. */
  choiceWordY: 672,
  maximumSpacing: 260,
  rowWidth: 1180
} as const;

/** The centre of the `index`th card in a centred row of `total`. */
export function choiceColumnX(index: number, total: number): number {
  const spacing = Math.min(
    INITIAL_SYLLABLE_LAYOUT.maximumSpacing,
    INITIAL_SYLLABLE_LAYOUT.rowWidth / total
  );
  return (
    INITIAL_SYLLABLE_LAYOUT.canvasWidth / 2 + (index - (total - 1) / 2) * spacing
  );
}
