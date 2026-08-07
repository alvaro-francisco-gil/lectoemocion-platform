import type { CSSProperties } from "react";
import { chromeSounds } from "../audio/ChromeSounds";
import type { SoundId } from "../audio/sounds";

/**
 * When the reward ceremony's pieces arrive.
 *
 * These were `animation-delay` values written directly into `styles.css`. They
 * are here now because the sounds have to land on the same frames as the
 * things they mark, and a star that pings 40 ms after it lands reads as a
 * glitch rather than as a chime. One declaration, consumed twice: `styles.css`
 * reads these as custom properties through `ceremonyTiming`, and the players
 * below read them as numbers.
 */
export const CEREMONY = {
  /** The first letriestrella lands, then one every `starStepMs` after it. */
  starFirstMs: 120,
  starStepMs: 140,
  /** The duende sets the chests down, left to right. */
  chestFirstMs: 300,
  chestStepMs: 100
} as const;

/**
 * The same numbers as CSS custom properties, for the element the animation
 * runs on.
 *
 * Written as a style attribute rather than into the stylesheet because a
 * stylesheet cannot import a constant, and the alternative — the numbers in
 * both files — is exactly the drift this exists to prevent.
 */
export const ceremonyTiming = {
  "--star-first": `${CEREMONY.starFirstMs}ms`,
  "--star-step": `${CEREMONY.starStepMs}ms`,
  "--chest-first": `${CEREMONY.chestFirstMs}ms`,
  "--chest-step": `${CEREMONY.chestStepMs}ms`
} as CSSProperties;

/**
 * True when the child's system asks for less movement.
 *
 * Treated as a question about the *ceremony*, not only about motion: with the
 * animations off, the stars are simply present, so three chimes spaced across
 * half a second would be marking arrivals that never happen.
 */
function prefersReducedMotion(): boolean {
  if (typeof matchMedia !== "function") return false;
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Plays one sound per arriving item, on the frames they arrive.
 *
 * Returns a cancel function. A child who taps "Seguir" before the last star has
 * landed leaves the screen, and a chime that arrives afterwards would be
 * marking something that is no longer there.
 */
export function playOnArrival(
  id: SoundId,
  count: number,
  firstMs: number,
  stepMs: number
): () => void {
  if (prefersReducedMotion()) {
    chromeSounds.play(id);
    return () => undefined;
  }

  const timers = Array.from({ length: count }, (_, index) =>
    setTimeout(() => chromeSounds.play(id), firstMs + index * stepMs)
  );
  return () => timers.forEach(clearTimeout);
}
