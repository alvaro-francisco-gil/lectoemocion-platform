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
