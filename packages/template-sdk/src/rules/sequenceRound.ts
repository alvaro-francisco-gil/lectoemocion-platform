import { seededDerangement } from "../seededRandom";
import { ROUND_LIVES, type RoundStatus } from "./lives";

/**
 * The rules shared by every "rebuild this in order" game.
 *
 * Syllables and letters differ only in what a card carries. The rules — deal a
 * derangement, charge a life for a wrong or occupied slot, win when the tray
 * empties — are one thing, so they are written once here and the games name
 * their own cards on top. A second copy would be a second place for the lives
 * budget to drift.
 *
 * Generic over the card so `SyllableCard.syllable` and `LetterCard.letter`
 * stay the words their readers expect; this layer only needs an identity and
 * the slot a card belongs to.
 */
export interface SequenceCard {
  readonly cardId: string;
  readonly slotIndex: number;
}

export interface SequenceRound<Card extends SequenceCard> {
  readonly slots: readonly (Card | null)[];
  readonly tray: readonly Card[];
  readonly livesRemaining: number;
  readonly status: RoundStatus;
}

export type SequenceAttempt =
  | { kind: "placed" }
  | { kind: "rejected" }
  | { kind: "ignored" };

export interface SequencePlacement<Card extends SequenceCard> {
  readonly round: SequenceRound<Card>;
  readonly attempt: SequenceAttempt;
}

/**
 * Deals the cards, with no card starting in the slot it belongs to.
 *
 * The derangement is over *positions*, not values: a word whose parts repeat
 * (`ca-ca`) has no arrangement in which every value has moved, so a
 * shuffle-until-different loop would never terminate on it.
 */
export function dealSequence<Card extends SequenceCard>(
  cards: readonly Card[],
  seed: string
): SequenceRound<Card> {
  return {
    slots: cards.map(() => null),
    tray: seededDerangement(cards, seed),
    livesRemaining: ROUND_LIVES,
    status: "playing"
  };
}

/**
 * Places a card into a slot.
 *
 * `noun` names the thing in the failure messages, so a caller passing an
 * identifier the round has never heard of gets an error that says which game
 * rejected it.
 */
export function placeSequenceCard<Card extends SequenceCard>(
  round: SequenceRound<Card>,
  cardId: string,
  slotIndex: number,
  noun: string
): SequencePlacement<Card> {
  const card = round.tray.find((candidate) => candidate.cardId === cardId);
  if (!card) {
    throw new Error(`Unknown ${noun} card: ${cardId}`);
  }
  if (slotIndex < 0 || slotIndex >= round.slots.length) {
    throw new Error(`Unknown ${noun} slot: ${slotIndex}`);
  }

  if (round.status !== "playing") {
    return { round, attempt: { kind: "ignored" } };
  }

  const occupied = round.slots[slotIndex] !== null;
  if (occupied || card.slotIndex !== slotIndex) {
    const livesRemaining = round.livesRemaining - 1;
    return {
      round: {
        ...round,
        livesRemaining,
        status: livesRemaining === 0 ? "lost" : "playing"
      },
      attempt: { kind: "rejected" }
    };
  }

  const slots = round.slots.map((slot, index) =>
    index === slotIndex ? card : slot
  );
  const tray = round.tray.filter((candidate) => candidate.cardId !== cardId);
  return {
    round: {
      ...round,
      slots,
      tray,
      status: tray.length === 0 ? "won" : "playing"
    },
    attempt: { kind: "placed" }
  };
}
