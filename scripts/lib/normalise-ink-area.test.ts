import { describe, expect, it } from "vitest";
// @ts-expect-error -- plain .mjs script module, deliberately untyped
import { TARGET_COVERAGE, inkArea, squareCanvas } from "./normalise-ink-area.mjs";

/** A `w`×`h` frame whose pixels are opaque wherever `solid` says so. */
function frame(
  width: number,
  height: number,
  solid: (x: number, y: number) => boolean
): Buffer {
  const raw = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      raw[(y * width + x) * 4 + 3] = solid(x, y) ? 255 : 0;
    }
  }
  return raw;
}

/** What share of a canvas of `size` the ink would then cover. */
const coverage = (ink: number, size: number): number => ink / (size * size);

describe("inkArea", () => {
  it("counts opaque pixels and ignores transparent ones", () => {
    const raw = frame(10, 10, (x) => x < 4);

    expect(inkArea(raw)).toBe(40);
  });

  it("weighs a half-transparent pixel as half a pixel", () => {
    const raw = Buffer.alloc(4);
    raw[3] = 128;

    expect(inkArea(raw)).toBeCloseTo(128 / 255, 6);
  });
});

describe("squareCanvas", () => {
  it("gives two differently shaped subjects the same ink coverage", () => {
    const wide = squareCanvas({ width: 400, height: 200, ink: 400 * 200 });
    const tall = squareCanvas({ width: 150, height: 500, ink: 150 * 500 });

    expect(coverage(400 * 200, wide.size)).toBeCloseTo(TARGET_COVERAGE, 3);
    expect(coverage(150 * 500, tall.size)).toBeCloseTo(TARGET_COVERAGE, 3);
  });

  it("takes ink rather than bounding box as the measure of size", () => {
    /* Same box, half the ink: a sparse subject gets the smaller canvas. */
    const solid = squareCanvas({ width: 400, height: 400, ink: 400 * 400 });
    const sparse = squareCanvas({ width: 400, height: 400, ink: 400 * 200 });

    expect(sparse.size).toBeLessThan(solid.size);
    expect(coverage(400 * 200, sparse.size)).toBeCloseTo(TARGET_COVERAGE, 3);
  });

  it("never crops a subject too thin to reach the target", () => {
    /* A pencil: its ink cannot fill 30% of any square that contains it. */
    const pencil = squareCanvas({ width: 90, height: 440, ink: 90 * 440 * 0.2 });

    expect(pencil.size).toBe(440);
    expect(pencil.left).toBe(175);
    expect(pencil.top).toBe(0);
  });

  it("centres the subject on the canvas", () => {
    const { size, left, top } = squareCanvas({
      width: 300,
      height: 200,
      ink: 300 * 200
    });

    expect(left).toBe(Math.round((size - 300) / 2));
    expect(top).toBe(Math.round((size - 200) / 2));
    expect(left).toBeGreaterThan(0);
    expect(top).toBeGreaterThan(0);
  });

  it("returns whole pixels, since a canvas cannot be a fraction wide", () => {
    const { size, left, top } = squareCanvas({
      width: 331,
      height: 217,
      ink: 331 * 217 * 0.61
    });

    for (const value of [size, left, top]) {
      expect(Number.isInteger(value)).toBe(true);
    }
    expect(left * 2 + 331).toBeLessThanOrEqual(size + 1);
  });

  it("refuses a picture with no ink at all rather than dividing by zero", () => {
    expect(() => squareCanvas({ width: 10, height: 10, ink: 0 })).toThrow(
      /no ink/i
    );
  });
});
