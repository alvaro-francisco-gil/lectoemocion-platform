import { describe, expect, it } from "vitest";
import type { ManifestFor } from "@lectoemocion/resource-schema";
import { ROUND_LIVES } from "./lives";
import { createSyllablesRound, placeSyllable } from "./syllablesGame";

const manifestFor = (
  vocabularyItemId: string,
  syllables: string[]
): ManifestFor<"syllables-game"> => ({
  schemaVersion: 1,
  resourceId: `syllables-${vocabularyItemId}`,
  template: { id: "syllables-game", version: 1 },
  seed: "lesson-1",
  vocabulary: [
    {
      vocabularyItemId,
      syllables,
      imageUrl: `/synthetic/${vocabularyItemId}.svg`
    }
  ]
});

const mariposa = manifestFor("mariposa", ["ma", "ri", "po", "sa"]);

const cardFor = (round: ReturnType<typeof createSyllablesRound>, slotIndex: number) =>
  round.tray.find((card) => card.slotIndex === slotIndex)!;

describe("createSyllablesRound", () => {
  it("opens one empty slot per syllable", () => {
    const round = createSyllablesRound(mariposa);
    expect(round.word).toBe("mariposa");
    expect(round.imageUrl).toBe("/synthetic/mariposa.svg");
    expect(round.slots).toEqual([null, null, null, null]);
    expect(round.tray).toHaveLength(4);
    expect(round.livesRemaining).toBe(ROUND_LIVES);
    expect(round.status).toBe("playing");
  });

  it("starts no card in the slot it belongs to", () => {
    const round = createSyllablesRound(mariposa);
    round.tray.forEach((card, index) => {
      expect(card.slotIndex).not.toBe(index);
    });
  });

  it("starts no card in place for a word whose syllables repeat", () => {
    const round = createSyllablesRound(manifestFor("caca", ["ca", "ca"]));
    round.tray.forEach((card, index) => {
      expect(card.slotIndex).not.toBe(index);
    });
  });

  it("is deterministic for a given seed", () => {
    expect(createSyllablesRound(mariposa)).toEqual(createSyllablesRound(mariposa));
  });
});

describe("placeSyllable", () => {
  it("keeps a card placed in its own slot", () => {
    const round = createSyllablesRound(mariposa);
    const card = cardFor(round, 0);
    const placed = placeSyllable(round, card.cardId, 0);
    expect(placed.attempt).toEqual({ kind: "placed" });
    expect(placed.round.slots[0]).toEqual(card);
    expect(placed.round.tray.map((each) => each.cardId)).not.toContain(card.cardId);
    expect(placed.round.livesRemaining).toBe(ROUND_LIVES);
  });

  it("returns a card placed in the wrong slot and spends a life", () => {
    const round = createSyllablesRound(mariposa);
    const card = cardFor(round, 0);
    const placed = placeSyllable(round, card.cardId, 1);
    expect(placed.attempt).toEqual({ kind: "rejected" });
    expect(placed.round.slots).toEqual([null, null, null, null]);
    expect(placed.round.tray).toEqual(round.tray);
    expect(placed.round.livesRemaining).toBe(ROUND_LIVES - 1);
  });

  it("rejects a correct card aimed at an occupied slot", () => {
    const round = createSyllablesRound(mariposa);
    const first = placeSyllable(round, cardFor(round, 0).cardId, 0).round;
    const occupier = cardFor(round, 1);
    const second = placeSyllable(first, occupier.cardId, 0);
    expect(second.attempt).toEqual({ kind: "rejected" });
    expect(second.round.livesRemaining).toBe(ROUND_LIVES - 1);
  });

  it("wins once every slot is filled", () => {
    const opening = createSyllablesRound(mariposa);
    let round = opening;
    for (let slotIndex = 0; slotIndex < 4; slotIndex += 1) {
      round = placeSyllable(round, cardFor(opening, slotIndex).cardId, slotIndex).round;
    }
    expect(round.slots.map((slot) => slot?.syllable)).toEqual([
      "ma",
      "ri",
      "po",
      "sa"
    ]);
    expect(round.tray).toEqual([]);
    expect(round.status).toBe("won");
  });

  it("loses once lives run out", () => {
    const opening = createSyllablesRound(mariposa);
    let round = opening;
    const card = cardFor(opening, 0);
    for (let attempt = 0; attempt < ROUND_LIVES; attempt += 1) {
      round = placeSyllable(round, card.cardId, 1).round;
    }
    expect(round.livesRemaining).toBe(0);
    expect(round.status).toBe("lost");
  });

  it("ignores placements once the round has ended", () => {
    const opening = createSyllablesRound(mariposa);
    let round = opening;
    const wrong = cardFor(opening, 0);
    for (let attempt = 0; attempt < ROUND_LIVES; attempt += 1) {
      round = placeSyllable(round, wrong.cardId, 1).round;
    }
    const after = placeSyllable(round, wrong.cardId, 0);
    expect(after.attempt).toEqual({ kind: "ignored" });
    expect(after.round).toEqual(round);
  });

  it("rejects a card that is not in the tray", () => {
    expect(() =>
      placeSyllable(createSyllablesRound(mariposa), "no-such-card", 0)
    ).toThrow("Unknown syllable card: no-such-card");
  });

  it("rejects a slot that does not exist", () => {
    const round = createSyllablesRound(mariposa);
    expect(() => placeSyllable(round, cardFor(round, 0).cardId, 4)).toThrow(
      "Unknown syllable slot: 4"
    );
  });
});
