import type { ManifestFor, VocabularyItem } from "@lectoemocion/resource-schema";
import { vocabularyWord } from "@lectoemocion/resource-schema";
import { seededShuffle } from "../seededRandom";
import { type RoundStatus } from "./roundStatus";

export type InitialLetterCardGroup = "picture" | "letter";

/**
 * A card in one of the two columns.
 *
 * A union rather than one shape with optional fields: a letter card has no
 * picture and a picture card has no standalone letter, so neither state is
 * expressible. The renderer switches on `group` and ends in `assertNever`.
 */
export type InitialLetterCard =
  | {
      readonly cardId: string;
      readonly group: "picture";
      readonly initial: string;
      readonly vocabularyItemId: string;
      readonly imageUrl: string;
    }
  | {
      readonly cardId: string;
      readonly group: "letter";
      readonly initial: string;
    };

export interface InitialLetterRound {
  readonly cards: readonly InitialLetterCard[];
  /** The initials already connected, which is also what "won" counts. */
  readonly matched: readonly string[];
  readonly selectedCardId: string | null;
  readonly status: RoundStatus;
}

/** What a selection did, so presentation reacts without re-deriving the rules. */
export type InitialLetterAttempt =
  | { kind: "selected" }
  | { kind: "cleared" }
  | { kind: "matched"; initial: string }
  | { kind: "mismatched"; cardIds: readonly [string, string] }
  | { kind: "ignored" };

export interface InitialLetterSelection {
  readonly round: InitialLetterRound;
  readonly attempt: InitialLetterAttempt;
}

/**
 * The letter a word begins with, as it is shown on a card.
 *
 * `Array.from` iterates code points, so a word starting with `ñ` yields one
 * letter rather than half a broken one, and the Spanish locale is what maps it
 * to `Ñ`. Derived from the syllables like every other spelling in this SDK, so
 * a picture cannot be filed under a letter its own word does not start with.
 */
export function wordInitial(item: VocabularyItem): string {
  const [first] = Array.from(vocabularyWord(item));
  if (first === undefined) {
    throw new Error(`${item.vocabularyItemId} has no letters`);
  }
  return first.toLocaleUpperCase("es-ES");
}

/**
 * Fails closed on a board this game cannot pose (invariant 6).
 *
 * Two pictures sharing an initial would put one letter card in front of two
 * right answers: whichever the child connects it to, the other picture is left
 * with nothing to reach, and the round becomes unwinnable through no mistake
 * of theirs. Exported so the catalogue refuses such a set while a world is
 * being authored, rather than only when a child opens the chapter — the same
 * rule at both boundaries instead of written down twice.
 */
export function assertDistinctInitials(
  items: readonly VocabularyItem[]
): void {
  const seen = new Map<string, string>();
  for (const item of items) {
    const initial = wordInitial(item);
    const owner = seen.get(initial);
    if (owner !== undefined) {
      throw new Error(
        `${owner} and ${item.vocabularyItemId} both start with ${initial}`
      );
    }
    seen.set(initial, item.vocabularyItemId);
  }
}

export function createInitialLetterRound(
  manifest: ManifestFor<"initial-letter-game">
): InitialLetterRound {
  assertDistinctInitials(manifest.vocabulary);

  const pictures = seededShuffle(
    manifest.vocabulary,
    `${manifest.seed}-pictures`
  ).map(
    (item): InitialLetterCard => ({
      cardId: `${item.vocabularyItemId}-picture`,
      group: "picture",
      initial: wordInitial(item),
      vocabularyItemId: item.vocabularyItemId,
      imageUrl: item.imageUrl
    })
  );

  const letters = seededShuffle(
    manifest.vocabulary,
    `${manifest.seed}-letters`
  ).map(
    (item): InitialLetterCard => ({
      cardId: `${wordInitial(item)}-letter`,
      group: "letter",
      initial: wordInitial(item)
    })
  );

  return {
    cards: [...pictures, ...letters],
    matched: [],
    selectedCardId: null,
    status: "playing"
  };
}

export function selectInitialLetterCard(
  round: InitialLetterRound,
  cardId: string
): InitialLetterSelection {
  const card = round.cards.find((candidate) => candidate.cardId === cardId);
  if (!card) {
    throw new Error(`Unknown initial-letter card: ${cardId}`);
  }

  const ignored: InitialLetterSelection = { round, attempt: { kind: "ignored" } };
  if (round.status !== "playing") return ignored;
  if (round.matched.includes(card.initial)) return ignored;

  const selected = round.cards.find(
    (candidate) => candidate.cardId === round.selectedCardId
  );
  if (!selected) {
    return {
      round: { ...round, selectedCardId: card.cardId },
      attempt: { kind: "selected" }
    };
  }

  /*
   * A second tap in the same column clears the selection, exactly as the pairs
   * game does: changing your mind about which picture you meant is not a wrong
   * answer, and is reported as its own attempt rather than as a mismatch.
   */
  if (selected.group === card.group) {
    return {
      round: { ...round, selectedCardId: null },
      attempt: { kind: "cleared" }
    };
  }

  if (selected.initial === card.initial) {
    const matched = [...round.matched, card.initial];
    const complete = matched.length * 2 === round.cards.length;
    return {
      round: {
        ...round,
        matched,
        selectedCardId: null,
        status: complete ? "won" : "playing"
      },
      attempt: { kind: "matched", initial: card.initial }
    };
  }

  /* A picture filed under the wrong letter costs the selection and nothing else. */
  return {
    round: { ...round, selectedCardId: null },
    attempt: { kind: "mismatched", cardIds: [selected.cardId, card.cardId] }
  };
}
