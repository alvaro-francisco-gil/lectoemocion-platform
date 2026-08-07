import { describe, expect, it } from "vitest";
import { adultChallenge } from "./adultChallenge";

describe("the adult challenge", () => {
  /*
   * The whole mechanism. A five-year-old who can count to twenty still cannot
   * read `siete`, so spelling the operands out is what separates an adult from
   * a child — not the arithmetic, which is deliberately easy.
   */
  it("writes its numbers as words, never as digits", () => {
    for (let seed = 0; seed < 50; seed += 1) {
      expect(adultChallenge(seed).question).not.toMatch(/\d/);
    }
  });

  it("asks for the sum of the two numbers it names", () => {
    const challenge = adultChallenge(0);

    expect(challenge.question).toContain(challenge.first.word);
    expect(challenge.question).toContain(challenge.second.word);
    expect(challenge.answer).toBe(challenge.first.value + challenge.second.value);
  });

  it("gives the same challenge for the same seed", () => {
    expect(adultChallenge(7)).toEqual(adultChallenge(7));
  });

  it("does not ask the same question every time", () => {
    const questions = new Set(
      Array.from({ length: 50 }, (_, seed) => adultChallenge(seed).question)
    );

    expect(questions.size).toBeGreaterThan(5);
  });

  it("stays within arithmetic an adult does not have to think about", () => {
    for (let seed = 0; seed < 50; seed += 1) {
      expect(adultChallenge(seed).answer).toBeLessThanOrEqual(18);
      expect(adultChallenge(seed).answer).toBeGreaterThanOrEqual(4);
    }
  });
});
