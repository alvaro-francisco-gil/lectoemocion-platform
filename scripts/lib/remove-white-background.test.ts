import { describe, expect, it } from "vitest";
// @ts-expect-error -- plain .mjs script module, deliberately untyped
import { removeWhiteBackground } from "./remove-white-background.mjs";

const SIZE = 64;

interface Painted {
  readonly raw: Buffer;
  readonly at: (x: number, y: number) => readonly number[];
}

/**
 * A frame of `backdrop`, with a `fill` disc outlined in near-black — the shape
 * every one of these cartoons has.
 */
function paint(backdrop: readonly number[], fill: readonly number[]): Painted {
  const raw = Buffer.alloc(SIZE * SIZE * 4);
  const centre = SIZE / 2;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const distance = Math.hypot(x - centre, y - centre);
      const colour =
        distance > 20 ? backdrop : distance > 17 ? [20, 20, 20] : fill;
      const at = (y * SIZE + x) * 4;
      raw[at] = colour[0] as number;
      raw[at + 1] = colour[1] as number;
      raw[at + 2] = colour[2] as number;
      raw[at + 3] = 255;
    }
  }
  return {
    raw,
    at: (x, y) => [...raw.subarray((y * SIZE + x) * 4, (y * SIZE + x) * 4 + 4)]
  };
}

const alphaAt = (image: Painted, x: number, y: number): number =>
  image.at(x, y)[3] as number;

describe("removeWhiteBackground", () => {
  it("clears a white card and keeps white inside the silhouette", () => {
    const image = paint([255, 255, 255], [255, 255, 255]);

    removeWhiteBackground(image.raw, { width: SIZE, height: SIZE });

    expect(alphaAt(image, 0, 0)).toBe(0);
    expect(alphaAt(image, SIZE - 1, SIZE - 1)).toBe(0);
    /* The subject is white too, and must survive being unreachable. */
    expect(alphaAt(image, 32, 32)).toBe(255);
  });

  it("clears a faintly grey card, which keying against pure white would not", () => {
    const image = paint([243, 243, 246], [90, 160, 220]);

    removeWhiteBackground(image.raw, { width: SIZE, height: SIZE });

    expect(alphaAt(image, 0, 0)).toBe(0);
    expect(alphaAt(image, 32, 32)).toBe(255);
  });

  it("crosses a white margin into the grey vignette it surrounds", () => {
    const image = paint([243, 243, 246], [90, 160, 220]);
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const margin = x < 6 || y < 6 || x >= SIZE - 6 || y >= SIZE - 6;
        if (!margin) continue;
        const at = (y * SIZE + x) * 4;
        image.raw[at] = 255;
        image.raw[at + 1] = 255;
        image.raw[at + 2] = 255;
      }
    }

    removeWhiteBackground(image.raw, { width: SIZE, height: SIZE });

    expect(alphaAt(image, 0, 0)).toBe(0);
    /* Inside the margin, on the vignette: still backdrop. */
    expect(alphaAt(image, 8, 8)).toBe(0);
    expect(alphaAt(image, 32, 32)).toBe(255);
  });

  it("leaves a picture that bleeds to its edge alone", () => {
    const image = paint([40, 120, 60], [255, 255, 255]);

    const cleared = removeWhiteBackground(image.raw, {
      width: SIZE,
      height: SIZE
    });

    expect(cleared).toBe(0);
    expect(alphaAt(image, 0, 0)).toBe(255);
  });
});
