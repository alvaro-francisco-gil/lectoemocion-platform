export interface SpelledNumber {
  readonly value: number;
  readonly word: string;
}

export interface AdultChallenge {
  readonly question: string;
  readonly first: SpelledNumber;
  readonly second: SpelledNumber;
  readonly answer: number;
}

/**
 * Two through nine, spelled out.
 *
 * Not zero or one: "cero más uno" invites a lucky guess from a child mashing
 * the pad, and the point is a question a child cannot *read*, asked in a range
 * an adult answers without pausing.
 */
const WORDS: readonly SpelledNumber[] = [
  { value: 2, word: "dos" },
  { value: 3, word: "tres" },
  { value: 4, word: "cuatro" },
  { value: 5, word: "cinco" },
  { value: 6, word: "seis" },
  { value: 7, word: "siete" },
  { value: 8, word: "ocho" },
  { value: 9, word: "nueve" }
];

/**
 * The question that stands between a child and their sibling's profile.
 *
 * Pure, and seeded, so the gate is tested without a DOM and a test can name the
 * exact challenge it is answering.
 *
 * The security here is deliberately shallow. This protects a family's data
 * from the three-year-old holding the tablet, which is the whole threat: it is
 * not authorization, and nothing behind it is a privilege boundary. Real
 * authorization arrives with accounts, in Rules, where invariant 4 requires it.
 */
export function adultChallenge(seed: number): AdultChallenge {
  const index = Math.abs(Math.trunc(seed));
  const first = WORDS[index % WORDS.length]!;
  const second = WORDS[Math.trunc(index / WORDS.length) % WORDS.length]!;

  return {
    question: `¿Cuánto es ${first.word} más ${second.word}?`,
    first,
    second,
    answer: first.value + second.value
  };
}
