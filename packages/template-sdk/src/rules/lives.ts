/**
 * Attempts a child may get wrong before a round ends.
 *
 * Round state, not progress state: templates never read or write progress
 * (invariant 2). Every minigame spends from the same budget so the rule reads
 * the same across the world.
 */
export const ROUND_LIVES = 3;

export type RoundStatus = "playing" | "won" | "lost";
