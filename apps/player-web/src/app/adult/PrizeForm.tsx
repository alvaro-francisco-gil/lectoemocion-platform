import {
  assertNever,
  checkCustomPrize,
  checkPrizeGoal,
  PRIZE_PRESET_KEYS,
  type Prize,
  type PrizeContent,
  type PrizeId,
  type PrizeImageId,
  type PrizePresetKey
} from "@lectoemocion/domain";
import { prizePresetPhrase } from "@lectoemocion/template-catalog";
import { useId, useState } from "react";
import type {
  PrizePick,
  PrizePickProblem
} from "../../world/prizeImageStore";

/**
 * The goal an adult sets, in letriestrellas.
 *
 * Its own form rather than a field inside the settings body: the goal is
 * saved on its own submit, independent of whatever gifts are waiting below
 * it, so typing a new goal never risks half-filling out a gift by accident.
 */
export function GoalForm({
  goal,
  onSetGoal
}: {
  goal: number;
  onSetGoal: (goal: number) => void;
}) {
  const [value, setValue] = useState(String(goal));
  const [error, setError] = useState<string | null>(null);
  const fieldId = useId();

  return (
    <form
      className="prize-goal"
      onSubmit={(event) => {
        event.preventDefault();
        const checked = checkPrizeGoal(Number.parseInt(value, 10));
        if (checked.ok) {
          setError(null);
          onSetGoal(checked.goal);
          return;
        }
        switch (checked.problem) {
          case "not-a-whole-number":
            setError("Elige un número entero");
            return;
          case "out-of-range":
            setError("Elige un número entre 5 y 200");
            return;
          default:
            return assertNever(checked.problem, "prize goal problem");
        }
      }}
    >
      <label htmlFor={fieldId}>Letriestrellas para el próximo regalo</label>
      <input
        id={fieldId}
        className="prize-goal__field"
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      {error ? (
        <p className="prize-goal__error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="prize-goal__submit">
        Guardar
      </button>
    </form>
  );
}

type Selection = PrizePresetKey | "custom";

/**
 * Why a picture did not work, in words an adult can act on.
 *
 * Both messages end the same way on purpose: the picture is the optional half
 * and losing it must never read as losing the gift.
 */
function pickProblemMessage(problem: PrizePickProblem): string {
  switch (problem) {
    case "unreadable-picture":
      return "No se pudo usar esa foto. Puedes guardar el regalo sin ella.";
    case "no-room":
      return "No hay sitio para esa foto. Puedes guardar el regalo sin ella.";
    default:
      return assertNever(problem, "prize picture problem");
  }
}

/** What a prize already says about itself, so the form opens on it. */
function chosenContent(prize: Prize): PrizeContent | null {
  return prize.state === "unconfigured" ? null : prize.content;
}

function initialSelection(prize: Prize): Selection | null {
  const content = chosenContent(prize);
  if (content === null) return null;
  switch (content.kind) {
    case "preset":
      return content.preset;
    case "custom":
      return "custom";
    default:
      return assertNever(content, "prize content kind");
  }
}

function initialText(prize: Prize): string {
  const content = chosenContent(prize);
  return content?.kind === "custom" ? content.text : "";
}

function initialImageId(prize: Prize): PrizeImageId | null {
  const content = chosenContent(prize);
  return content?.kind === "custom" ? content.imageId : null;
}

/**
 * What an adult decides is inside one gift.
 *
 * One radio group rather than two separate flows for a preset and for the
 * adult's own words: a gift has exactly one content, so the choice of which
 * kind it is belongs beside the choice of which one, not above it as a
 * separate step an adult could skip.
 *
 * The form opens on whatever the prize already says, so a gift already filled
 * in shows what was chosen instead of an empty form that says a second gift is
 * owed. State is seeded once per mount, and a prize moving between the lists
 * in `PrizeSettings` remounts it, which is what keeps the two in step.
 */
export function PrizeForm({
  prize,
  onConfigure,
  onPickImage,
  onDiscardImage
}: {
  prize: Prize;
  onConfigure: (id: PrizeId, content: PrizeContent) => void;
  onPickImage: (file: File) => Promise<PrizePick>;
  /** Says a kept picture is now unreachable, so it is not left behind. */
  onDiscardImage: (id: PrizeImageId) => void;
}) {
  const [selection, setSelection] = useState<Selection | null>(() =>
    initialSelection(prize)
  );
  const [text, setText] = useState(() => initialText(prize));
  const [imageId, setImageId] = useState<PrizeImageId | null>(() =>
    initialImageId(prize)
  );
  /*
   * Set the instant a file is picked and cleared only once `onPickImage`
   * settles. Downscaling a photo is not instant, and without this a save
   * pressed mid-decode would go through with `imageId` still `null` — the
   * photo silently dropped rather than attached.
   */
  const [imagePending, setImagePending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /*
   * The picture the *saved* prize points at, as opposed to one picked here and
   * not saved yet. The difference is what decides when a picture may be
   * discarded: a draft is unreachable the moment it is replaced, but a saved
   * one is still the picture a child would see, right up until the save that
   * replaces it. Discarding it any earlier empties a gift for an adult who
   * changes their mind and closes the panel.
   */
  const storedImageId = initialImageId(prize);
  /** Drops every picture this form has held that the saved prize will not use. */
  const discardAllBut = (kept: PrizeImageId | null) => {
    for (const id of new Set([imageId, storedImageId])) {
      if (id !== null && id !== kept) onDiscardImage(id);
    }
  };
  const groupName = useId();
  const textFieldId = useId();
  const fileFieldId = useId();

  return (
    <form
      className="prize-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (selection === null) {
          setError("Elige qué hay dentro del regalo");
          return;
        }
        /* Belt and braces alongside the disabled button below: a picked
           photo still being processed must never be dropped by a submit
           that slips through. */
        if (imagePending) return;

        if (selection === "custom") {
          const checked = checkCustomPrize(text);
          if (!checked.ok) {
            switch (checked.problem) {
              case "empty-text":
                setError("Escribe qué hay dentro");
                return;
              case "text-too-long":
                setError("Son demasiadas palabras");
                return;
              default:
                return assertNever(checked.problem, "custom prize problem");
            }
          }
          setError(null);
          discardAllBut(imageId);
          onConfigure(prize.id, {
            kind: "custom",
            text: checked.text,
            imageId
          });
          return;
        }

        setError(null);
        /*
         * A gift that ends up being a hiding place keeps no picture, so every
         * one this form has held is now a key nothing points at.
         */
        discardAllBut(null);
        setImageId(null);
        onConfigure(prize.id, { kind: "preset", preset: selection });
      }}
    >
      <fieldset className="prize-form__presets">
        <legend>¿Qué hay dentro del regalo?</legend>
        {PRIZE_PRESET_KEYS.map((key) => (
          <label key={key}>
            <input
              type="radio"
              name={groupName}
              checked={selection === key}
              onChange={() => setSelection(key)}
            />
            {prizePresetPhrase(key)}
          </label>
        ))}
        <label>
          <input
            type="radio"
            name={groupName}
            checked={selection === "custom"}
            onChange={() => setSelection("custom")}
          />
          Escribirlo yo
        </label>
      </fieldset>
      {selection === "custom" ? (
        <div className="prize-form__custom">
          <label htmlFor={textFieldId}>¿Qué hay dentro?</label>
          <input
            id={textFieldId}
            type="text"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <label htmlFor={fileFieldId}>Añadir una foto</label>
          <input
            id={fileFieldId}
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file === undefined) return;
              const replaced = imageId;
              setImagePending(true);
              void onPickImage(file).then((pick) => {
                setImagePending(false);
                if (!pick.ok) {
                  setError(pickProblemMessage(pick.problem));
                  return;
                }
                setError(null);
                setImageId(pick.id);
                /*
                 * A draft this one replaces is unreachable at once. A saved
                 * picture is not: it waits for the save that replaces it.
                 */
                if (replaced !== null && replaced !== storedImageId) {
                  onDiscardImage(replaced);
                }
              });
            }}
          />
        </div>
      ) : null}
      {error ? (
        <p className="prize-form__error" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        className="prize-form__submit"
        disabled={imagePending}
      >
        Guardar el regalo
      </button>
    </form>
  );
}
