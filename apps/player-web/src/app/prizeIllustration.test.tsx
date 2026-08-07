import { PRIZE_PRESET_KEYS } from "@lectoemocion/domain";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PrizeIllustration } from "./prizeIllustration";

describe("PrizeIllustration", () => {
  it("draws a picture for every shipped preset", () => {
    for (const preset of PRIZE_PRESET_KEYS) {
      const { unmount } = render(<PrizeIllustration preset={preset} />);
      expect(screen.getByTestId(`prize-illustration-${preset}`)).toBeVisible();
      unmount();
    }
  });

  it("hides the picture from a screen reader, because the phrase says it", () => {
    render(<PrizeIllustration preset="patio" />);
    expect(screen.getByTestId("prize-illustration-patio")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
  });
});
