import { describe, expect, it } from "vitest";
import { bookShape } from "./bookShape";

describe("bookShape", () => {
  /*
   * Two rows while the world is small, because a book is wider than it is tall
   * and a child reads it in one look.
   */
  it("lays a small world out in two rows", () => {
    expect(bookShape(10)).toEqual({ columns: 5, rows: 2 });
    expect(bookShape(11)).toEqual({ columns: 6, rows: 2 });
    expect(bookShape(12)).toEqual({ columns: 6, rows: 2 });
  });

  /* Past twelve, a third row rather than stickers too small to recognise. */
  it("takes a third row once two would make the stickers tiny", () => {
    expect(bookShape(13)).toEqual({ columns: 5, rows: 3 });
    expect(bookShape(24)).toEqual({ columns: 8, rows: 3 });
  });

  /* The last row may be short; no row may be empty. */
  it("never asks for a row it cannot fill at all", () => {
    for (const portrait of [false, true]) {
      for (let count = 1; count <= 40; count += 1) {
        const where = `${count}${portrait ? " tall" : " wide"}`;
        const { columns, rows } = bookShape(count, portrait);
        expect(columns * rows, where).toBeGreaterThanOrEqual(count);
        expect(columns * (rows - 1), where).toBeLessThan(count);
      }
    }
  });

  /*
   * Upright, the page turns the other way. Two rows of eleven across a phone is
   * a thin band of tiny stickers with the screen empty above and below it.
   */
  it("stands the book up on a tall screen", () => {
    expect(bookShape(11, true)).toEqual({ columns: 3, rows: 4 });
    expect(bookShape(10, true)).toEqual({ columns: 3, rows: 4 });
    expect(bookShape(24, true)).toEqual({ columns: 5, rows: 5 });
  });

  /* A handful is one row: a second row of two would waste half the paper. */
  it("holds up at the very small end", () => {
    expect(bookShape(1)).toEqual({ columns: 1, rows: 1 });
    expect(bookShape(4)).toEqual({ columns: 4, rows: 1 });
    expect(bookShape(5)).toEqual({ columns: 3, rows: 2 });
  });
});
