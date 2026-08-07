import type { PrizeContent, PrizeId, PrizeImageId } from "@lectoemocion/domain";
import { useEffect, useState, type ReactElement } from "react";
import type { PrizePick } from "../../world/prizeImageStore";
import type { PrizeView } from "../../world/prizes";
import { AdultGate } from "../AdultGate";
import { CloseIcon } from "../icons";
import { PrizeSettings } from "./PrizeSettings";

/**
 * The adult area, and the only module outside this directory anything may
 * import.
 *
 * The gate wraps the whole area rather than each control inside it, so every
 * adult-facing thing added here inherits it instead of growing its own.
 * `scripts/check-adult-gate.mjs` is what keeps that true.
 *
 * The gate itself is the shell's one `AdultGate` — the same keypad the profile
 * drawer puts up. It lives outside this directory because it is deliberately
 * reusable, and this area is one of its callers rather than its owner: one
 * question asked in one place, so a stronger mechanism later is one change.
 *
 * Nothing behind the gate is mounted until it is answered, and passing it opens
 * the area for this visit only — `unlocked` is this component's state, and
 * leaving unmounts it. A device left on the map is a device a child cannot get
 * past.
 *
 * Closes on Escape as well as the button, on both sides of the gate: a panel
 * with no way out is a trap on a device with no back button, and the classroom
 * panel this ships to is exactly that device.
 */
export function AdultArea({
  view,
  today,
  muted,
  onToggleMuted,
  onSetGoal,
  onConfigure,
  onPickImage,
  onDiscardImage,
  onClose
}: {
  view: PrizeView;
  today: Date;
  muted: boolean;
  onToggleMuted: () => void;
  onSetGoal: (goal: number) => void;
  onConfigure: (id: PrizeId, content: PrizeContent) => void;
  onPickImage: (file: File) => Promise<PrizePick>;
  onDiscardImage: (id: PrizeImageId) => void;
  onClose: () => void;
}): ReactElement {
  const [unlocked, setUnlocked] = useState(false);

  /*
   * Only once the gate is out of the way. The gate closes itself on Escape
   * through `onCancel`, and a second listener up here would call `onClose`
   * twice for one key.
   */
  useEffect(() => {
    if (!unlocked) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [unlocked, onClose]);

  if (!unlocked) {
    return (
      <AdultGate
        today={today}
        onPass={() => setUnlocked(true)}
        onCancel={onClose}
      />
    );
  }

  return (
    <main className="adult" role="dialog" aria-modal="true" aria-label="Ajustes">
      <button
        type="button"
        className="adult__close"
        aria-label="Cerrar los ajustes"
        onClick={onClose}
      >
        <CloseIcon />
      </button>
      {/*
        One switch for all of it. A teacher with a class in front of them needs
        the room quiet, not a mixer; `docs/plans/ideas/audio.md` settles that
        there is no per-sound volume surface.

        It sits here rather than inside `PrizeSettings` because it is not about
        prizes, and here rather than on the world because a switch a child can
        reach is a world silenced by accident.
      */}
      <label className="adult__setting">
        <input type="checkbox" checked={!muted} onChange={onToggleMuted} />
        <span>Sonido</span>
      </label>
      <PrizeSettings
        view={view}
        onSetGoal={onSetGoal}
        onConfigure={onConfigure}
        onPickImage={onPickImage}
        onDiscardImage={onDiscardImage}
      />
    </main>
  );
}
