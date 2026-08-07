import { describe, expect, it } from "vitest";
import { isPlausibleBirthYear, MAX_ADULT_AGE, MIN_ADULT_AGE } from "./adultGate";

const NOW = 2026;

describe("isPlausibleBirthYear", () => {
  it("accepts a year that would make an adult", () => {
    expect(isPlausibleBirthYear(1988, NOW)).toBe(true);
  });

  it("accepts both ends of the plausible range", () => {
    expect(isPlausibleBirthYear(NOW - MIN_ADULT_AGE, NOW)).toBe(true);
    expect(isPlausibleBirthYear(NOW - MAX_ADULT_AGE, NOW)).toBe(true);
  });

  it("refuses a year that would make a child", () => {
    expect(isPlausibleBirthYear(NOW - MIN_ADULT_AGE + 1, NOW)).toBe(false);
    expect(isPlausibleBirthYear(NOW, NOW)).toBe(false);
  });

  it("refuses a year nobody alive was born in", () => {
    expect(isPlausibleBirthYear(NOW - MAX_ADULT_AGE - 1, NOW)).toBe(false);
  });

  it("refuses what a small hand produces", () => {
    expect(isPlausibleBirthYear(0, NOW)).toBe(false);
    expect(isPlausibleBirthYear(7, NOW)).toBe(false);
    expect(isPlausibleBirthYear(1988.5, NOW)).toBe(false);
    expect(isPlausibleBirthYear(Number.NaN, NOW)).toBe(false);
  });
});
