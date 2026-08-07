import { describe, expect, it } from "vitest";
import type { ManifestFor, VocabularyItem } from "@lectoemocion/resource-schema";
import {
  chooseInitialSyllable,
  createInitialSyllableRound,
  initialSyllable,
  sharesInitialSyllable
} from "./initialSyllableGame";

const item = (id: string, syllables: readonly string[]): VocabularyItem => ({
  vocabularyItemId: id,
  syllables: [...syllables],
  imageUrl: `/synthetic/${id}.svg`
});

const casa = item("casa", ["ca", "sa"]);
const caballo = item("caballo", ["ca", "ba", "llo"]);
const luna = item("luna", ["lu", "na"]);
const sol = item("sol", ["sol"]);

const manifest: ManifestFor<"initial-syllable-game"> = {
  schemaVersion: 1,
  resourceId: "initial-syllable-test",
  template: {
    id: "initial-syllable-game",
    version: 1,
    targetVocabularyItemId: "casa",
    matchVocabularyItemId: "caballo"
  },
  seed: "lesson-1",
  vocabulary: [casa, caballo, luna, sol]
};

describe("initialSyllable", () => {
  it("is the first syllable, folded for comparison", () => {
    expect(initialSyllable(caballo)).toBe("ca");
    expect(initialSyllable(item("Ñu", ["Ñu"]))).toBe("ñu");
  });

  it("fails closed on an item with no syllables", () => {
    expect(() => initialSyllable(item("vacio", []))).toThrow(
      "vacio has no syllables"
    );
  });
});

describe("sharesInitialSyllable", () => {
  it("matches on the whole syllable, not the first letter", () => {
    expect(sharesInitialSyllable(casa, caballo)).toBe(true);
    expect(sharesInitialSyllable(casa, item("coche", ["co", "che"]))).toBe(false);
  });

  /*
   * `ni` and `ní` are not folded together. Whether they are the same sound is a
   * phonetic claim, and this repository has no basis to make one; an accent is
   * a difference a Spanish reader sees, so the rule leaves it visible.
   */
  it("does not fold accents away", () => {
    expect(
      sharesInitialSyllable(item("nido", ["ni", "do"]), item("nino", ["ní", "no"]))
    ).toBe(false);
  });
});

describe("createInitialSyllableRound", () => {
  it("shows the target above three choices, one of which matches", () => {
    const round = createInitialSyllableRound(manifest);
    expect(round.target.vocabularyItemId).toBe("casa");
    expect(round.initialSyllable).toBe("ca");
    expect(round.matchVocabularyItemId).toBe("caballo");
    expect(round.choices.map((choice) => choice.vocabularyItemId).sort()).toEqual([
      "caballo",
      "luna",
      "sol"
    ]);
    expect(round.status).toBe("playing");
  });

  it("is deterministic for a given seed", () => {
    expect(createInitialSyllableRound(manifest)).toEqual(
      createInitialSyllableRound(manifest)
    );
  });

  it("fails closed when the target is absent from the vocabulary", () => {
    expect(() =>
      createInitialSyllableRound({
        ...manifest,
        template: { ...manifest.template, targetVocabularyItemId: "gato" }
      })
    ).toThrow("Initial-syllable target is not in the vocabulary: gato");
  });

  it("fails closed when the match is absent from the vocabulary", () => {
    expect(() =>
      createInitialSyllableRound({
        ...manifest,
        template: { ...manifest.template, matchVocabularyItemId: "gato" }
      })
    ).toThrow("Initial-syllable match is not in the vocabulary: gato");
  });

  it("fails closed when the named match does not open with the target's syllable", () => {
    expect(() =>
      createInitialSyllableRound({
        ...manifest,
        template: { ...manifest.template, matchVocabularyItemId: "luna" }
      })
    ).toThrow('luna does not open with "ca"');
  });

  it("fails closed when the match is the target itself", () => {
    expect(() =>
      createInitialSyllableRound({
        ...manifest,
        template: { ...manifest.template, matchVocabularyItemId: "casa" }
      })
    ).toThrow("Initial-syllable match cannot be the target: casa");
  });

  /* Two right answers is a round a child can lose by being right. */
  it("fails closed when a distractor also opens with the target's syllable", () => {
    expect(() =>
      createInitialSyllableRound({
        ...manifest,
        vocabulary: [casa, caballo, item("cama", ["ca", "ma"]), sol]
      })
    ).toThrow('cama also opens with "ca"');
  });
});

describe("chooseInitialSyllable", () => {
  it("wins on the matching picture", () => {
    const { round, attempt } = chooseInitialSyllable(
      createInitialSyllableRound(manifest),
      "caballo"
    );
    expect(attempt).toEqual({ kind: "correct" });
    expect(round.status).toBe("won");
  });

  it("keeps playing after a distractor, changing nothing", () => {
    const opening = createInitialSyllableRound(manifest);
    const { round, attempt } = chooseInitialSyllable(opening, "luna");
    expect(attempt).toEqual({ kind: "incorrect" });
    expect(round).toEqual(opening);
  });

  it("still offers the match after a dozen distractors", () => {
    let round = createInitialSyllableRound(manifest);
    for (let attempt = 0; attempt < 12; attempt += 1) {
      round = chooseInitialSyllable(round, "luna").round;
    }
    expect(round.status).toBe("playing");
    expect(chooseInitialSyllable(round, "caballo").round.status).toBe("won");
  });

  it("ignores choices once the round is won", () => {
    const won = chooseInitialSyllable(
      createInitialSyllableRound(manifest),
      "caballo"
    ).round;
    const { round, attempt } = chooseInitialSyllable(won, "luna");
    expect(attempt).toEqual({ kind: "ignored" });
    expect(round).toEqual(won);
  });

  it("rejects a choice that is not in the round", () => {
    expect(() =>
      chooseInitialSyllable(createInitialSyllableRound(manifest), "gato")
    ).toThrow("Unknown initial-syllable choice: gato");
  });

  /* The target is shown, not offered: tapping it is not an answer. */
  it("rejects the target itself as a choice", () => {
    expect(() =>
      chooseInitialSyllable(createInitialSyllableRound(manifest), "casa")
    ).toThrow("Unknown initial-syllable choice: casa");
  });
});
