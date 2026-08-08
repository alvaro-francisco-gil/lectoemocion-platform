import type { PrizePresetKey } from "@lectoemocion/domain";

/**
 * What each preset says, in the words an adult reads to a child.
 *
 * A `Record` over the closed key union rather than an array, so a preset added
 * to the union without copy is a compile error rather than a blank card.
 */
export const PRIZE_PRESET_PHRASES: Record<PrizePresetKey, string> = {
  patio: "Encuentra tu regalo en el patio",
  mesa: "Encuentra tu regalo debajo de la mesa",
  puerta: "Encuentra tu regalo detrás de la puerta",
  habitacion: "Encuentra tu regalo en tu habitación"
};

export function prizePresetPhrase(key: PrizePresetKey): string {
  return PRIZE_PRESET_PHRASES[key];
}

/**
 * The same place, named rather than instructed.
 *
 * Every phrase above opens with the same four words, which is right when a
 * child is being told where to go and wrong when an adult is choosing between
 * them: four cards reading "Encuentra tu regalo…" are four cards that look
 * identical until you read to the end of each. These are what the chooser
 * shows; the phrase is still what a child is read, and still what the card
 * announces to a screen reader.
 */
export const PRIZE_PRESET_PLACES: Record<PrizePresetKey, string> = {
  patio: "En el patio",
  mesa: "Debajo de la mesa",
  puerta: "Detrás de la puerta",
  habitacion: "En tu habitación"
};

export function prizePresetPlace(key: PrizePresetKey): string {
  return PRIZE_PRESET_PLACES[key];
}
