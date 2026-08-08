/**
 * Gives every picture the same visual weight.
 *
 * Trimming a picture to its subject equalises the *box* around it, and the
 * surfaces that draw these all scale that box to fit. But a box is not what a
 * child sees. A llama fills its box; a kite is string and a diamond, and fills a
 * third of it. Trimmed and fitted to the same square, one came out more than
 * twice the size of the other, and a page of collected animals read as a
 * jumble of sizes rather than as a set.
 *
 * What is held constant here instead is how much ink the picture puts on the
 * paper: the subject is centred on a transparent square chosen so that its
 * opaque area is always the same share of it. Two stickers then carry the same
 * weight whatever their shape.
 *
 * The subject is only ever *padded* — never scaled — so this costs no
 * resolution. The canvas grows around a picture that needs to read smaller.
 */

/**
 * The share of a picture its subject's ink is made to cover.
 *
 * Measured against the imported collection, where coverage ran from 0.156 to
 * 0.876. Ninety-four of a hundred and nine pictures reach this figure exactly;
 * the fifteen below it are genuinely thin things — a pencil, a flamingo, a bone
 * — and keep their own box (see `squareCanvas`). Raising it to 0.34 would clamp
 * twenty-eight; lowering it to 0.26 would shrink the majority for the sake of
 * eight outliers.
 */
export const TARGET_COVERAGE = 0.3;

/**
 * How many pixels of ink an image carries, counting a half-transparent pixel as
 * half a pixel. Antialiased edges are most of the boundary of these cartoons, so
 * treating them as either fully present or fully absent would misjudge a fine
 * subject — a spider's legs — by a good deal more than rounding error.
 *
 * @param {Buffer} raw RGBA pixels.
 * @returns {number} opaque pixels, fractional.
 */
export function inkArea(raw) {
  let ink = 0;
  for (let at = 3; at < raw.length; at += 4) ink += raw[at] / 255;
  return ink;
}

/**
 * The square to centre a trimmed subject on, so that its ink covers
 * `TARGET_COVERAGE` of it.
 *
 * A subject too thin to reach the target on any square that contains it keeps
 * its own bounding box. It cannot be made denser, only surrounded by more
 * emptiness, and padding a pencil until it matched a pumpkin's density would
 * shrink every other picture on the page to no one's benefit. So the floor is
 * the subject's long edge, which also makes cropping arithmetically impossible.
 *
 * @param {{ width: number, height: number, ink: number }} subject
 * @param {number} [coverage]
 * @returns {{ size: number, left: number, top: number }} whole pixels.
 */
export function squareCanvas({ width, height, ink }, coverage = TARGET_COVERAGE) {
  if (!(ink > 0)) {
    throw new Error(`A ${width}×${height} picture has no ink to measure.`);
  }
  const size = Math.max(Math.round(Math.sqrt(ink / coverage)), width, height);
  return {
    size,
    left: Math.round((size - width) / 2),
    top: Math.round((size - height) / 2)
  };
}
