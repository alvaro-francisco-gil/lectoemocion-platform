/** How the book's stickers are laid out on the paper. */
export interface BookShape {
  readonly columns: number;
  readonly rows: number;
}

/**
 * How many rows the paper wants before the chapters are divided among them.
 *
 * A wide sheet — a classroom panel, a tablet held long-ways — reads in one look
 * and stays as few rows as it can. A tall one, a phone held upright, has the
 * opposite problem: two rows across a narrow screen makes every sticker small
 * and leaves most of the page empty, so it takes more rows and fewer columns.
 *
 * The step past twelve is where two rows of a growing world would start making
 * stickers too small to recognise across a room.
 */
function targetRows(count: number, portrait: boolean): number {
  if (portrait) return count > 12 ? 5 : 4;
  if (count > 12) return 3;
  return count > 4 ? 2 : 1;
}

/**
 * Where the rows of the book fall, for a world of `count` chapters.
 *
 * The columns come from the target rows and the rows are then taken back from
 * the columns, which is what keeps the last row the only short one: asking for
 * four rows of five chapters and getting two columns would leave a whole row of
 * blank paper below the stickers.
 *
 * A short last row is what a page of a collection looks like. Forcing a
 * rectangle would mean either an empty place that promises nothing or a chapter
 * with nowhere to go.
 *
 * This is the only place the shape is decided. `styles.css` sizes the cells from
 * it and never counts anything itself.
 */
export function bookShape(count: number, portrait = false): BookShape {
  const rows = Math.max(1, Math.min(count, targetRows(count, portrait)));
  const columns = Math.max(1, Math.ceil(count / rows));
  return { columns, rows: Math.ceil(count / columns) };
}
