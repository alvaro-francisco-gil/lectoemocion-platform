import {
  assertNever,
  checkCustomPrize,
  checkPrizeGoal,
  DEFAULT_PRIZE_GOAL,
  MAX_PRIZE_GOAL,
  MIN_PRIZE_GOAL,
  PRIZE_PRESET_KEYS,
  type Prize,
  type PrizeContent,
  type PrizeId,
  type PrizeImageId,
  type PrizePresetKey
} from "@lectoemocion/domain";
import { STARS_PER_COMPLETION } from "../../world/worldView";
import {
  prizePresetPhrase,
  prizePresetPlace
} from "@lectoemocion/template-catalog";
import { PrizeIllustration } from "../prizeIllustration";
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
/**
 * One chapter's worth, clamped to what the validator would accept.
 *
 * Stepping is the forgiving way in, so it never lands somewhere the adult
 * would then be told off for: the typed field is still there for anyone who
 * wants a number the steps do not reach.
 */
function stepGoal(value: string, direction: -1 | 1): number {
  const current = Number.parseInt(value, 10);
  const from = Number.isSafeInteger(current) ? current : DEFAULT_PRIZE_GOAL;
  const next = from + direction * STARS_PER_COMPLETION;
  return Math.min(MAX_PRIZE_GOAL, Math.max(MIN_PRIZE_GOAL, next));
}

/**
 * The goal said in the unit an adult plans in.
 *
 * A number of letriestrellas is the child's unit; how many chapters it takes
 * to get there is the adult's, and it is the difference between setting 30
 * and knowing what setting 30 asks for.
 */
function goalInChapters(value: string): string {
  const goal = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(goal) || goal < MIN_PRIZE_GOAL) return "";
  const chapters = Math.ceil(goal / STARS_PER_COMPLETION);
  return chapters === 1 ? "Un capítulo" : `Unos ${chapters} capítulos`;
}

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
      <label className="prize-goal__label" htmlFor={fieldId}>
        Letriestrellas para el próximo regalo
      </label>
      {/*
        Stepped as well as typed, in chapters rather than stars: an adult on a
        classroom panel is touching, not typing, and the number only means
        something once it is said in the unit they actually plan in — a
        chapter pays three, so the step is three.
      */}
      <div className="prize-goal__set">
        <button
          type="button"
          className="prize-goal__step"
          aria-label="Menos letriestrellas"
          onClick={() => setValue(String(stepGoal(value, -1)))}
        >
          −
        </button>
        <input
          id={fieldId}
          className="prize-goal__field"
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <button
          type="button"
          className="prize-goal__step"
          aria-label="Más letriestrellas"
          onClick={() => setValue(String(stepGoal(value, 1)))}
        >
          +
        </button>
        <button type="submit" className="prize-goal__submit">
          Guardar
        </button>
      </div>
      <p className="prize-goal__hint">{goalInChapters(value)}</p>
      {error ? (
        <p className="prize-goal__error" role="alert">
          {error}
        </p>
      ) : null}
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
        {/*
          The picture carries the choice and the place names it. The full
          phrase is still the card's accessible name — it is what a child is
          read, and reading four cards that all open "Encuentra tu regalo…" is
          exactly what the eye should not have to do.
        */}
        {PRIZE_PRESET_KEYS.map((key) => (
          <label key={key} className="prize-choice">
            <input
              type="radio"
              name={groupName}
              checked={selection === key}
              onChange={() => setSelection(key)}
            />
            <span className="prize-choice__art">
              <PrizeIllustration preset={key} />
            </span>
            <span className="prize-choice__place" aria-hidden="true">
              {prizePresetPlace(key)}
            </span>
            <span className="visually-hidden">{prizePresetPhrase(key)}</span>
          </label>
        ))}
        <label className="prize-choice prize-choice--own">
          <input
            type="radio"
            name={groupName}
            checked={selection === "custom"}
            onChange={() => setSelection("custom")}
          />
          <span className="prize-choice__art" aria-hidden="true">
            ✏️
          </span>
          <span className="prize-choice__place">Escribirlo yo</span>
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
