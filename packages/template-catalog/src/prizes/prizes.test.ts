import { PRIZE_PRESET_KEYS, MAX_PRIZE_TEXT_LENGTH } from "@lectoemocion/domain";
import { describe, expect, it } from "vitest";
import { PRIZE_PRESET_PHRASES, prizePresetPhrase } from "./index";

describe("prize presets", () => {
  it("gives every shipped preset a phrase", () => {
    for (const key of PRIZE_PRESET_KEYS) {
      expect(prizePresetPhrase(key).length).toBeGreaterThan(0);
    }
  });

  it("keeps every phrase to the one line an adult reads aloud", () => {
    for (const phrase of Object.values(PRIZE_PRESET_PHRASES)) {
      expect(phrase.length).toBeLessThanOrEqual(MAX_PRIZE_TEXT_LENGTH);
    }
  });

  it("names the place, so the words tell a child where to go", () => {
    expect(prizePresetPhrase("patio")).toBe("Encuentra tu regalo en el patio");
  });
});
