import { describe, expect, it } from "vitest";
import { deriveInitial } from "./initial";

describe("deriveInitial", () => {
  it.each([
    ["Ana", "A"],
    ["álex", "A"],
    ["Érika", "E"],
    ["Íñigo", "I"],
    ["Óscar", "O"],
    ["Úrsula", "U"],
    ["ñora", "Ñ"]
  ])("derives %s as %s", (name, expected) => {
    expect(deriveInitial(name)).toBe(expected);
  });

  it("rejects an empty name", () => {
    expect(() => deriveInitial("   ")).toThrow("Name must not be empty");
  });
});
