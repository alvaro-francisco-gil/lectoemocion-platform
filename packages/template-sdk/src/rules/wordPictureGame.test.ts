import { describe, expect, it } from "vitest";
import type { ManifestFor } from "@lectoemocion/resource-schema";
import { chooseWordPicture, createWordPictureRound } from "./wordPictureGame";

const manifest: ManifestFor<"word-picture-game"> = {
  schemaVersion: 1,
  resourceId: "word-picture-test",
  template: {
    id: "word-picture-game",
    version: 1,
    targetVocabularyItemId: "casa"
  },
  seed: "lesson-1",
  vocabulary: [
    { vocabularyItemId: "casa", syllables: ["ca", "sa"], imageUrl: "/synthetic/casa.svg" },
    { vocabularyItemId: "sol", syllables: ["sol"], imageUrl: "/synthetic/sol.svg" },
    { vocabularyItemId: "luna", syllables: ["lu", "na"], imageUrl: "/synthetic/luna.svg" }
  ]
};

describe("createWordPictureRound", () => {
  it("shows the target word and every picture as a choice", () => {
    const round = createWordPictureRound(manifest);
    expect(round.word).toBe("casa");
    expect(round.choices.map((choice) => choice.vocabularyItemId).sort()).toEqual([
      "casa",
      "luna",
      "sol"
    ]);
    expect(round.status).toBe("playing");
  });

  it("is deterministic for a given seed", () => {
    expect(createWordPictureRound(manifest)).toEqual(
      createWordPictureRound(manifest)
    );
  });

  it("fails closed when the target is absent from the vocabulary", () => {
    expect(() =>
      createWordPictureRound({
        ...manifest,
        template: { ...manifest.template, targetVocabularyItemId: "gato" }
      })
    ).toThrow("Word-picture target is not in the vocabulary: gato");
  });
});

describe("chooseWordPicture", () => {
  it("wins on the target picture", () => {
    const { round, attempt } = chooseWordPicture(
      createWordPictureRound(manifest),
      "casa"
    );
    expect(attempt).toEqual({ kind: "correct" });
    expect(round.status).toBe("won");
  });

  it("keeps playing after a distractor, changing nothing", () => {
    const opening = createWordPictureRound(manifest);
    const { round, attempt } = chooseWordPicture(opening, "sol");
    expect(attempt).toEqual({ kind: "incorrect" });
    expect(round).toEqual(opening);
  });

  it("still offers the target after a dozen distractors", () => {
    let round = createWordPictureRound(manifest);
    for (let attempt = 0; attempt < 12; attempt += 1) {
      round = chooseWordPicture(round, "sol").round;
    }
    expect(round.status).toBe("playing");
    expect(chooseWordPicture(round, "casa").round.status).toBe("won");
  });

  it("ignores choices once the round is won", () => {
    const won = chooseWordPicture(createWordPictureRound(manifest), "casa").round;
    const { round, attempt } = chooseWordPicture(won, "sol");
    expect(attempt).toEqual({ kind: "ignored" });
    expect(round).toEqual(won);
  });

  it("rejects a choice that is not in the round", () => {
    expect(() =>
      chooseWordPicture(createWordPictureRound(manifest), "gato")
    ).toThrow("Unknown word-picture choice: gato");
  });
});
