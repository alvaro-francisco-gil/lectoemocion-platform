import { describe, expect, it } from "vitest";
import type { ManifestFor } from "@lectoemocion/resource-schema";
import { createPairsRound, selectPairsCard } from "./pairsGame";

const manifest: ManifestFor<"pairs-game"> = {
  schemaVersion: 1,
  resourceId: "pairs-test",
  template: { id: "pairs-game", version: 1 },
  seed: "lesson-1",
  vocabulary: [
    { vocabularyItemId: "casa", syllables: ["ca", "sa"], imageUrl: "/synthetic/casa.svg" },
    { vocabularyItemId: "sol", syllables: ["sol"], imageUrl: "/synthetic/sol.svg" },
    { vocabularyItemId: "luna", syllables: ["lu", "na"], imageUrl: "/synthetic/luna.svg" }
  ]
};

const pictureCard = (itemId: string) => `${itemId}-picture`;
const wordCard = (itemId: string) => `${itemId}-word`;

describe("createPairsRound", () => {
  it("creates one picture card and one word card per item", () => {
    const round = createPairsRound(manifest);
    expect(round.cards.filter((card) => card.group === "picture")).toHaveLength(3);
    expect(round.cards.filter((card) => card.group === "word")).toHaveLength(3);
    expect(round.status).toBe("playing");
  });

  it("orders word cards independently of picture cards", () => {
    const round = createPairsRound(manifest);
    const pictures = round.cards
      .filter((card) => card.group === "picture")
      .map((card) => card.vocabularyItemId);
    const words = round.cards
      .filter((card) => card.group === "word")
      .map((card) => card.vocabularyItemId);
    expect([...words].sort()).toEqual([...pictures].sort());
  });

  it("is deterministic for a given seed", () => {
    expect(createPairsRound(manifest)).toEqual(createPairsRound(manifest));
  });
});

describe("selectPairsCard", () => {
  it("records a first selection", () => {
    const { round, attempt } = selectPairsCard(
      createPairsRound(manifest),
      pictureCard("casa")
    );
    expect(attempt).toEqual({ kind: "selected" });
    expect(round.selectedCardId).toBe(pictureCard("casa"));
  });

  it("clears the selection when both cards share a group", () => {
    const first = selectPairsCard(createPairsRound(manifest), pictureCard("casa"));
    const { round, attempt } = selectPairsCard(first.round, pictureCard("sol"));
    expect(attempt).toEqual({ kind: "cleared" });
    expect(round.selectedCardId).toBeNull();
    expect(round.matched).toEqual([]);
  });

  it("matches a picture with its own word", () => {
    const first = selectPairsCard(createPairsRound(manifest), pictureCard("casa"));
    const { round, attempt } = selectPairsCard(first.round, wordCard("casa"));
    expect(attempt).toEqual({ kind: "matched", vocabularyItemId: "casa" });
    expect(round.matched).toEqual(["casa"]);
    expect(round.selectedCardId).toBeNull();
  });

  it("clears the selection on a picture paired with the wrong word", () => {
    const opening = createPairsRound(manifest);
    const first = selectPairsCard(opening, pictureCard("casa"));
    const { round, attempt } = selectPairsCard(first.round, wordCard("sol"));
    expect(attempt).toEqual({
      kind: "mismatched",
      cardIds: [pictureCard("casa"), wordCard("sol")]
    });
    /* The board is back to the one they started from: nothing was spent. */
    expect(round).toEqual(opening);
  });

  it("ignores a card that is already matched", () => {
    const first = selectPairsCard(createPairsRound(manifest), pictureCard("casa"));
    const matched = selectPairsCard(first.round, wordCard("casa")).round;
    const { round, attempt } = selectPairsCard(matched, pictureCard("casa"));
    expect(attempt).toEqual({ kind: "ignored" });
    expect(round).toEqual(matched);
  });

  it("wins once every pair is matched", () => {
    let round = createPairsRound(manifest);
    for (const itemId of ["casa", "sol", "luna"]) {
      round = selectPairsCard(round, pictureCard(itemId)).round;
      round = selectPairsCard(round, wordCard(itemId)).round;
    }
    expect(round.status).toBe("won");
    expect(round.matched).toEqual(["casa", "sol", "luna"]);
  });

  it("stays playable however many wrong pairs are tried", () => {
    let round = createPairsRound(manifest);
    for (let attempt = 0; attempt < 12; attempt += 1) {
      round = selectPairsCard(round, pictureCard("casa")).round;
      round = selectPairsCard(round, wordCard("sol")).round;
    }
    expect(round.status).toBe("playing");
    /* And the pair they got wrong a dozen times is still there to be made. */
    round = selectPairsCard(round, pictureCard("casa")).round;
    round = selectPairsCard(round, wordCard("casa")).round;
    expect(round.matched).toEqual(["casa"]);
  });

  it("ignores selections once the round is won", () => {
    let round = createPairsRound(manifest);
    for (const itemId of ["casa", "sol", "luna"]) {
      round = selectPairsCard(round, pictureCard(itemId)).round;
      round = selectPairsCard(round, wordCard(itemId)).round;
    }
    const { round: after, attempt } = selectPairsCard(round, pictureCard("luna"));
    expect(attempt).toEqual({ kind: "ignored" });
    expect(after).toEqual(round);
  });

  it("rejects a card that is not in the round", () => {
    expect(() => selectPairsCard(createPairsRound(manifest), "no-such-card")).toThrow(
      "Unknown pairs card: no-such-card"
    );
  });
});
