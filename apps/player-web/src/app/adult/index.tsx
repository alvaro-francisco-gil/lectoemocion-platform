import type { PrizeContent, PrizeId, PrizeImageId } from "@lectoemocion/domain";
import type { ReactElement } from "react";
import type { PrizeView } from "../../world/prizes";
import { CloseIcon } from "../icons";
import { AdultGate } from "./AdultGate";
import { PrizeSettings } from "./PrizeSettings";

/**
 * The adult area, and the only module outside this directory anything may
 * import.
 *
 * The gate wraps the whole area rather than each control inside it, so every
 * adult-facing thing added here inherits it instead of growing its own.
 * `scripts/check-adult-gate.mjs` is what keeps that true.
 */
export function AdultArea({
  view,
  currentYear,
  onSetGoal,
  onConfigure,
  onPickImage,
  onClose
}: {
  view: PrizeView;
  currentYear: number;
  onSetGoal: (goal: number) => void;
  onConfigure: (id: PrizeId, content: PrizeContent) => void;
  onPickImage: (file: File) => Promise<PrizeImageId | null>;
  onClose: () => void;
}): ReactElement {
  return (
    <main className="adult" role="dialog" aria-modal="true" aria-label="Ajustes">
      <button
        type="button"
        className="menu__close"
        aria-label="Cerrar los ajustes"
        onClick={onClose}
      >
        <CloseIcon />
      </button>
      <AdultGate currentYear={currentYear}>
        <PrizeSettings
          view={view}
          onSetGoal={onSetGoal}
          onConfigure={onConfigure}
          onPickImage={onPickImage}
        />
      </AdultGate>
    </main>
  );
}
