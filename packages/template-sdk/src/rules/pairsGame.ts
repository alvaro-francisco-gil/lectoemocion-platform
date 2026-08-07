import type { ManifestFor } from "@lectoemocion/resource-schema";
import { seededShuffle } from "../seededRandom";
import { type RoundStatus } from "./roundStatus";

export type PairsCardGroup = "picture" | "word";

export interface PairsCard {
  readonly cardId: string;
  readonly group: PairsCardGroup;
  readonly vocabularyItemId: string;
  readonly imageUrl: string;
  readonly word: string;
}

export interface PairsRound {
  readonly cards: readonly PairsCard[];
  readonly matched: readonly string[];
  readonly selectedCardId: string | null;
  readonly status: RoundStatus;
}

/** What a selection did, so presentation reacts without re-deriving the rules. */
export type PairsAttempt =
  | { kind: "selected" }
  | { kind: "cleared" }
  | { kind: "matched"; vocabularyItemId: string }
  | { kind: "mismatched"; cardIds: readonly [string, string] }
  | { kind: "ignored" };

export interface PairsSelection {
  readonly round: PairsRound;
  readonly attempt: PairsAttempt;
}

export function createPairsRound(
  manifest: ManifestFor<"pairs-game">
): PairsRound {
  const card = (
    item: ManifestFor<"pairs-game">["vocabulary"][number],
    group: PairsCardGroup
  ): PairsCard => ({
    cardId: `${item.vocabularyItemId}-${group}`,
    group,
    vocabularyItemId: item.vocabularyItemId,
    imageUrl: item.imageUrl,
    word: item.syllables.join("")
  });

  const pictures = seededShuffle(manifest.vocabulary, `${manifest.seed}-pictures`)
    .map((item) => card(item, "picture"));
  const words = seededShuffle(manifest.vocabulary, `${manifest.seed}-words`)
    .map((item) => card(item, "word"));

  return {
    cards: [...pictures, ...words],
    matched: [],
    selectedCardId: null,
    status: "playing"
  };
}

export function selectPairsCard(
  round: PairsRound,
  cardId: string
): PairsSelection {
  const card = round.cards.find((candidate) => candidate.cardId === cardId);
  if (!card) {
    throw new Error(`Unknown pairs card: ${cardId}`);
  }

  const ignored: PairsSelection = { round, attempt: { kind: "ignored" } };
  if (round.status !== "playing") return ignored;
  if (round.matched.includes(card.vocabularyItemId)) return ignored;

  const selected = round.cards.find(
    (candidate) => candidate.cardId === round.selectedCardId
  );
  if (!selected) {
    return {
      round: { ...round, selectedCardId: card.cardId },
      attempt: { kind: "selected" }
    };
  }

  if (selected.group === card.group) {
    return {
      round: { ...round, selectedCardId: null },
      attempt: { kind: "cleared" }
    };
  }

  if (selected.vocabularyItemId === card.vocabularyItemId) {
    const matched = [...round.matched, card.vocabularyItemId];
    const complete = matched.length * 2 === round.cards.length;
    return {
      round: {
        ...round,
        matched,
        selectedCardId: null,
        status: complete ? "won" : "playing"
      },
      attempt: { kind: "matched", vocabularyItemId: card.vocabularyItemId }
    };
  }

  /* Two cards that do not pair cost the selection and nothing else. */
  return {
    round: { ...round, selectedCardId: null },
    attempt: { kind: "mismatched", cardIds: [selected.cardId, card.cardId] }
  };
}
