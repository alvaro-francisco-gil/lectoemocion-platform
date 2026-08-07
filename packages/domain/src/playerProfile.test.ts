import { describe, expect, it } from "vitest";
import { ageInYears } from "./playerProfile";

describe("ageInYears", () => {
  it("has no age when the birth month is not known", () => {
    expect(ageInYears({ known: false }, new Date("2026-08-07"))).toBeNull();
  });

  it("counts whole years since the birth month", () => {
    expect(
      ageInYears({ known: true, month: 6, year: 2021 }, new Date("2026-08-07"))
    ).toBe(5);
  });

  it("has not counted the year yet in the months before the birth month", () => {
    expect(
      ageInYears({ known: true, month: 9, year: 2021 }, new Date("2026-08-07"))
    ).toBe(4);
  });

  it("counts the year during the birth month itself", () => {
    expect(
      ageInYears({ known: true, month: 8, year: 2021 }, new Date("2026-08-07"))
    ).toBe(5);
  });

  it("is zero for a child born earlier this year", () => {
    expect(
      ageInYears({ known: true, month: 2, year: 2026 }, new Date("2026-08-07"))
    ).toBe(0);
  });
});
