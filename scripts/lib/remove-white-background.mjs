/**
 * Turns a plain studio backdrop into transparency.
 *
 * Half the prototype's stock pictures were cut out and half were shot on a flat
 * card. On the map hub they sit on painted scenery, so an opaque square reads as
 * a sticker rather than a collected animal. This is the step that makes the two
 * halves look like one set.
 *
 * It grows a region inward from the border rather than keying every pale pixel
 * in the frame, because plenty of these subjects *are* white — a seal, a whale's
 * belly, a unicorn. Interior white is unreachable from outside the silhouette,
 * so it survives.
 *
 * Growth compares each pixel to its *neighbour*, not to one global colour, so a
 * white margin around a faintly grey vignette is one continuous backdrop and
 * both go. It stops at the dark outline every one of these cartoons is drawn
 * with, and never crosses into a pixel too dark to be a card.
 *
 * Edge pixels are antialiased against the backdrop, so removing it alone would
 * leave a pale fringe. Frontier pixels are unpremultiplied against the backdrop
 * colour that reached them, recovering the subject's own colour.
 */

/** Per-channel distance from the neighbouring backdrop pixel, at 8 bits. */
const BACKDROP_WITHIN = 6;
const SUBJECT_BEYOND = 20;

/** Darker than this is artwork, never a card to cut away. */
const PALE_ENOUGH = 232;

/** Below this share of the frame, the border is not a backdrop at all. */
const MINIMUM_SHARE = 0.1;

/**
 * @param {Buffer} raw RGBA pixels, mutated in place.
 * @param {{ width: number, height: number }} size
 * @returns {number} how many pixels were made fully or partly transparent
 */
export function removeWhiteBackground(raw, { width, height }) {
  const count = width * height;
  /* 0 unseen, 1 queued as backdrop, 2 frontier: transparent but not grown from. */
  const state = new Uint8Array(count);
  const queue = new Int32Array(count);
  /* The backdrop colour that reached each pixel, for the fringe correction. */
  const cameFrom = new Uint8Array(count * 3);
  let head = 0;
  let tail = 0;

  const isPale = (at) =>
    raw[at] >= PALE_ENOUGH &&
    raw[at + 1] >= PALE_ENOUGH &&
    raw[at + 2] >= PALE_ENOUGH;

  const consider = (index, from) => {
    if (state[index] !== 0) return;
    const at = index * 4;
    if (isPale(at)) {
      /* Pale is pale: a white margin and the faint vignette it surrounds are
         one backdrop, even though the step between them is not a gradient. */
      state[index] = 1;
      queue[tail++] = index;
    } else {
      const distance = Math.max(
        Math.abs(raw[at] - from[0]),
        Math.abs(raw[at + 1] - from[1]),
        Math.abs(raw[at + 2] - from[2])
      );
      if (distance >= SUBJECT_BEYOND) return;
      state[index] = 2;
    }
    cameFrom[index * 3] = from[0];
    cameFrom[index * 3 + 1] = from[1];
    cameFrom[index * 3 + 2] = from[2];
  };

  /* The border ring seeds the region: any pale pixel on it is outside. */
  const seed = (index) => {
    const at = index * 4;
    if (!isPale(at)) return;
    consider(index, [raw[at], raw[at + 1], raw[at + 2]]);
  };
  for (let x = 0; x < width; x++) {
    seed(x);
    seed((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    seed(y * width);
    seed(y * width + width - 1);
  }

  while (head < tail) {
    const index = queue[head++];
    const at = index * 4;
    const here = [raw[at], raw[at + 1], raw[at + 2]];
    const x = index % width;
    const y = (index - x) / width;
    if (x > 0) consider(index - 1, here);
    if (x < width - 1) consider(index + 1, here);
    if (y > 0) consider(index - width, here);
    if (y < height - 1) consider(index + width, here);
  }

  /* A sliver means the picture bleeds to its edge; leave such a file alone. */
  if (tail < count * MINIMUM_SHARE) return 0;

  let cleared = 0;
  for (let index = 0; index < count; index++) {
    if (state[index] === 0) continue;
    const at = index * 4;
    const from = cameFrom.subarray(index * 3, index * 3 + 3);
    let backdropness = 1;
    if (state[index] === 2) {
      const distance = Math.max(
        Math.abs(raw[at] - from[0]),
        Math.abs(raw[at + 1] - from[1]),
        Math.abs(raw[at + 2] - from[2])
      );
      backdropness =
        distance <= BACKDROP_WITHIN
          ? 1
          : (SUBJECT_BEYOND - distance) / (SUBJECT_BEYOND - BACKDROP_WITHIN);
    }
    const alpha = Math.round(255 * (1 - backdropness));
    raw[at + 3] = alpha;
    cleared++;
    if (alpha === 0 || alpha === 255) continue;
    /* Observed = alpha * subject + (1 - alpha) * backdrop. Solve for subject. */
    const opacity = alpha / 255;
    for (let channel = 0; channel < 3; channel++) {
      const subject = (raw[at + channel] - from[channel] * (1 - opacity)) / opacity;
      raw[at + channel] = Math.max(0, Math.min(255, Math.round(subject)));
    }
  }
  return cleared;
}
