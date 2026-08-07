import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdultGate } from "./AdultGate";

const TODAY = new Date("2026-08-07");

function open(onPass = vi.fn(), onCancel = vi.fn()) {
  render(<AdultGate today={TODAY} onPass={onPass} onCancel={onCancel} />);
  return { onPass, onCancel };
}

/** Taps the pad, one digit at a time, the way a thumb would. */
function type(digits: string): void {
  for (const digit of digits) {
    fireEvent.click(screen.getByRole("button", { name: digit }));
  }
}

function blanks(): string[] {
  return screen
    .getAllByTestId("adult-gate-digit")
    .map((slot) => slot.textContent ?? "");
}

describe("the adult gate", () => {
  it("shows one blank per digit of a year, empty to begin with", () => {
    open();
    expect(blanks()).toEqual(["", "", "", ""]);
  });

  it("fills the blanks as the pad is tapped", () => {
    open();
    type("19");
    expect(blanks()).toEqual(["1", "9", "", ""]);
  });

  /*
   * No submit button. Four digits is the whole answer, so asking for a
   * confirming tap afterwards would be a second thing to find for no gain.
   */
  it("opens as soon as an adult's year is complete", () => {
    const { onPass } = open();

    type("1988");

    expect(onPass).toHaveBeenCalledTimes(1);
  });

  it("refuses a year too recent to be an adult's, and starts again", () => {
    const { onPass } = open();

    type("2021");

    expect(onPass).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(blanks()).toEqual(["", "", "", ""]);
  });

  it("takes a digit back", () => {
    open();
    type("198");

    fireEvent.click(screen.getByRole("button", { name: "Borrar" }));

    expect(blanks()).toEqual(["1", "9", "", ""]);
  });

  it("closes without opening anything", () => {
    const { onPass, onCancel } = open();

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onPass).not.toHaveBeenCalled();
  });

  it("closes on Escape, like every other way out in this app", () => {
    const { onCancel } = open();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  /* A pad a child cannot read still has to be one an adult can hear. */
  it("names itself and every key for a screen reader", () => {
    open();

    expect(
      screen.getByRole("dialog", { name: "Sólo para adultos" })
    ).toBeInTheDocument();
    for (const digit of "0123456789") {
      expect(screen.getByRole("button", { name: digit })).toBeInTheDocument();
    }
  });
});
