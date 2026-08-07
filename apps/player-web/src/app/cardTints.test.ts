import { describe, expect, it } from "vitest";
import { CARD_TINT_COUNT, cardTint } from "./cardTints";

/** The body colour every template and the shell draw text in. */
const INK = "#241133";

describe("cardTint", () => {
  /* Cycling by position is what keeps two neighbours from matching. */
  it("cycles the palette by position", () => {
    for (let position = 0; position < CARD_TINT_COUNT * 3; position += 1) {
      expect(cardTint(position)).toEqual(cardTint(position % CARD_TINT_COUNT));
      if (position > 0) {
        expect(cardTint(position)).not.toEqual(cardTint(position - 1));
      }
    }
  });

  /*
   * The wash is the card's colour, not a colour chosen to go with it. A child
   * opening the pink card has to arrive somewhere pink, so the one thing that
   * may differ between the two is how much of it there is.
   *
   * A few degrees rather than none: mixing towards white is affine, so it
   * preserves hue exactly in arithmetic, but the result is rounded back to
   * eight bits per channel and the wash has only a tenth of the card's span for
   * that rounding to land in.
   */
  it("keeps each card's hue in its wash", () => {
    for (let position = 0; position < CARD_TINT_COUNT; position += 1) {
      const { card, wash } = cardTint(position);
      expect(Math.abs(hue(wash) - hue(card)), card).toBeLessThan(4);
    }
  });

  /*
   * The wash fills a whole screen behind templates written against a pale
   * shell. Every one of them keeps the contrast it was drawn with.
   */
  it("gives every wash enough contrast for body text", () => {
    for (let position = 0; position < CARD_TINT_COUNT; position += 1) {
      const { card, wash } = cardTint(position);
      expect(contrast(wash, INK), card).toBeGreaterThanOrEqual(4.5);
      /* And white shapes still read as white against it. */
      expect(contrast(wash, "#ffffff"), card).toBeLessThan(1.2);
    }
  });

  /* A chapter with no colour is a broken invariant, not a chapter painted grey. */
  it("refuses a position the palette cannot have", () => {
    expect(() => cardTint(-1)).toThrow(/-1/);
  });
});

function channels(hex: string): readonly number[] {
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
}

/** Hue in degrees, as HSL reads it. */
function hue(hex: string): number {
  const [red = 0, green = 0, blue = 0] = channels(hex);
  const max = Math.max(red, green, blue);
  const span = max - Math.min(red, green, blue);
  if (span === 0) return 0;
  const sixth =
    max === red
      ? ((green - blue) / span) % 6
      : max === green
        ? (blue - red) / span + 2
        : (red - green) / span + 4;
  return (sixth * 60 + 360) % 360;
}

/** WCAG 2.1 contrast ratio. */
function contrast(one: string, other: string): number {
  const [light, dark] = [luminance(one), luminance(other)].sort((a, b) => b - a);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

function luminance(hex: string): number {
  const [red = 0, green = 0, blue = 0] = channels(hex).map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}
