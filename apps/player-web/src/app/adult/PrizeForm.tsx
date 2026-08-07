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
 * What an adult decides is inside one waiting gift.
 *
 * One radio group rather than two separate flows for a preset and for the
 * adult's own words: a gift has exactly one content, so the choice of which
 * kind it is belongs beside the choice of which one, not above it as a
 * separate step an adult could skip.
 */
export function PrizeForm({
  prize,
  onConfigure,
  onPickImage
}: {
  prize: Prize;
  onConfigure: (id: PrizeId, content: PrizeContent) => void;
  onPickImage: (file: File) => Promise<PrizeImageId | null>;
}) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [text, setText] = useState("");
  const [imageId, setImageId] = useState<PrizeImageId | null>(null);
  /*
   * Set the instant a file is picked and cleared only once `onPickImage`
   * settles. Downscaling a photo is not instant, and without this a save
   * pressed mid-decode would go through with `imageId` still `null` — the
   * photo silently dropped rather than attached.
   */
  const [imagePending, setImagePending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const groupName = useId();
  const textFieldId = useId();
  const fileFieldId = useId();

  return (
    <form
      className="prize-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (selection === null) return;
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
          onConfigure(prize.id, {
            kind: "custom",
            text: checked.text,
            imageId
          });
          return;
        }

        setError(null);
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
              setImagePending(true);
              void onPickImage(file).then((id) => {
                setImageId(id);
                setImagePending(false);
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
