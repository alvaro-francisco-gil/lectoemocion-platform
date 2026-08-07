import { describe, expect, it } from "vitest";
import {
  ADULT_YEAR_DIGITS,
  isAdultBirthYear,
  MINIMUM_ADULT_AGE
} from "./adultYear";

const TODAY = new Date("2026-08-07");

describe("the year an adult is asked for", () => {
  it("accepts a year that makes the person an adult", () => {
    expect(isAdultBirthYear("1988", TODAY)).toBe(true);
  });

  it("accepts the very year that has just turned adult", () => {
    const year = String(TODAY.getFullYear() - MINIMUM_ADULT_AGE);
    expect(isAdultBirthYear(year, TODAY)).toBe(true);
  });

  it("refuses a year too recent to be an adult's", () => {
    const year = String(TODAY.getFullYear() - MINIMUM_ADULT_AGE + 1);
    expect(isAdultBirthYear(year, TODAY)).toBe(false);
  });

  /* The child's own year of birth is the one they might actually know. */
  it("refuses a year that would be the child's", () => {
    expect(isAdultBirthYear("2021", TODAY)).toBe(false);
  });

  it("refuses a year nobody alive was born in", () => {
    expect(isAdultBirthYear("1850", TODAY)).toBe(false);
  });

  it("refuses anything that is not four digits", () => {
    expect(isAdultBirthYear("198", TODAY)).toBe(false);
    expect(isAdultBirthYear("19888", TODAY)).toBe(false);
    expect(isAdultBirthYear("", TODAY)).toBe(false);
  });

  it("refuses digits that are not digits", () => {
    expect(isAdultBirthYear("19a8", TODAY)).toBe(false);
  });

  /*
   * The gate is only as good as how hard it is to hit by accident, and a small
   * child mashes rather than reasons. Fewer than one in fifty random four-digit
   * entries may pass.
   */
  it("is hard to open by mashing the pad", () => {
    let opened = 0;
    for (let value = 0; value < 10_000; value += 1) {
      const digits = String(value).padStart(ADULT_YEAR_DIGITS, "0");
      if (isAdultBirthYear(digits, TODAY)) opened += 1;
    }

    expect(opened / 10_000).toBeLessThan(0.02);
  });
});
