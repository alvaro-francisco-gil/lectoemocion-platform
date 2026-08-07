import type { PrizeContent, PrizeId, PrizeImageId } from "@lectoemocion/domain";
import { useEffect, type ReactElement } from "react";
import type { PrizePick } from "../../world/prizeImageStore";
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
 *
 * Closes on Escape as well as the button: a panel with no way out is a trap
 * on a device with no back button, and the classroom panel this ships to is
 * exactly that device.
 */
export function AdultArea({
  view,
  currentYear,
  onSetGoal,
  onConfigure,
  onPickImage,
  onDiscardImage,
  onClose
}: {
  view: PrizeView;
  currentYear: number;
  onSetGoal: (goal: number) => void;
  onConfigure: (id: PrizeId, content: PrizeContent) => void;
  onPickImage: (file: File) => Promise<PrizePick>;
  onDiscardImage: (id: PrizeImageId) => void;
  onClose: () => void;
}): ReactElement {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

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
          onDiscardImage={onDiscardImage}
        />
      </AdultGate>
    </main>
  );
}
