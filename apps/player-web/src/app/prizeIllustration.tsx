import { assertNever, type PrizePresetKey } from "@lectoemocion/domain";
import type { ReactElement } from "react";

/**
 * Where the prize is, drawn.
 *
 * A switch closed with `assertNever` rather than a lookup table, so a preset
 * added to the union fails to compile until it has a picture. The phrase
 * beside it is what a screen reader announces, so every drawing here is
 * decoration.
 */
export function PrizeIllustration({
  preset
}: {
  preset: PrizePresetKey;
}): ReactElement {
  switch (preset) {
    case "patio":
      return (
        <svg
          data-testid="prize-illustration-patio"
          viewBox="0 0 120 100"
          width="100%"
          height="100%"
          aria-hidden="true"
        >
          <rect x="0" y="70" width="120" height="30" fill="#cfe3a8" />
          <circle cx="30" cy="45" r="22" fill="#5d9b4b" />
          <rect x="27" y="60" width="6" height="16" fill="#8a5a2b" />
          <path d="M70 76V44l22-10v32Z" fill="#d98c3f" />
          <circle cx="98" cy="22" r="10" fill="#f4c95d" />
        </svg>
      );
    case "mesa":
      return (
        <svg
          data-testid="prize-illustration-mesa"
          viewBox="0 0 120 100"
          width="100%"
          height="100%"
          aria-hidden="true"
        >
          <rect x="10" y="34" width="100" height="10" rx="4" fill="#b5651d" />
          <rect x="18" y="44" width="8" height="42" fill="#8a4712" />
          <rect x="94" y="44" width="8" height="42" fill="#8a4712" />
          <rect x="48" y="58" width="26" height="26" rx="4" fill="#e05a72" />
          <rect x="58" y="58" width="6" height="26" fill="#f4c95d" />
        </svg>
      );
    case "puerta":
      return (
        <svg
          data-testid="prize-illustration-puerta"
          viewBox="0 0 120 100"
          width="100%"
          height="100%"
          aria-hidden="true"
        >
          <rect x="24" y="12" width="52" height="80" rx="4" fill="#b5651d" />
          <circle cx="68" cy="54" r="4" fill="#f4c95d" />
          <path d="M76 12h20v80H76Z" fill="#8a4712" />
          <rect x="92" y="66" width="22" height="24" rx="4" fill="#e05a72" />
          <rect x="100" y="66" width="6" height="24" fill="#f4c95d" />
        </svg>
      );
    case "habitacion":
      return (
        <svg
          data-testid="prize-illustration-habitacion"
          viewBox="0 0 120 100"
          width="100%"
          height="100%"
          aria-hidden="true"
        >
          <rect x="8" y="52" width="72" height="32" rx="6" fill="#8fb8e0" />
          <rect x="8" y="44" width="26" height="14" rx="5" fill="#fdfdfd" />
          <rect x="0" y="84" width="120" height="8" fill="#cfe3a8" />
          <rect x="88" y="58" width="26" height="26" rx="4" fill="#e05a72" />
          <rect x="98" y="58" width="6" height="26" fill="#f4c95d" />
        </svg>
      );
    default:
      return assertNever(preset, "prize preset illustration");
  }
}
