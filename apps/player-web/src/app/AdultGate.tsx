import { useId, useMemo, useState, type FormEvent } from "react";
import { adultChallenge } from "../profiles/adultChallenge";

/**
 * The question between a child and the controls that change their profile.
 *
 * Not authorization, and never described as such: it protects a family's data
 * from the three-year-old holding the tablet, which is the entire threat model
 * on a device with no accounts. Invariant 4's real boundary arrives with
 * Firebase Rules, and this must never be mistaken for it.
 *
 * A fresh challenge per mount, so a child who watched an adult answer once
 * cannot repeat the tap sequence.
 */
export function AdultGate({
  onPass,
  onCancel
}: {
  onPass: () => void;
  onCancel: () => void;
}) {
  const challenge = useMemo(
    () => adultChallenge(Math.floor(Math.random() * 64)),
    []
  );
  const [answer, setAnswer] = useState("");
  const [wrong, setWrong] = useState(false);
  const answerId = useId();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (Number(answer) === challenge.answer) {
      onPass();
      return;
    }
    setWrong(true);
    setAnswer("");
  };

  return (
    <div
      className="adult-gate"
      role="dialog"
      aria-modal="true"
      aria-label="Sólo para adultos"
    >
      <p className="adult-gate__question">{challenge.question}</p>
      <form className="adult-gate__form" onSubmit={submit}>
        <label className="adult-gate__label" htmlFor={answerId}>
          Respuesta
        </label>
        {/*
          `inputMode` rather than `type="number"`: a phone should offer a keypad,
          but a spinner with arrows is one more thing for a child to poke.
        */}
        <input
          id={answerId}
          className="adult-gate__answer"
          inputMode="numeric"
          autoComplete="off"
          value={answer}
          onChange={(event) => {
            setAnswer(event.target.value);
            setWrong(false);
          }}
        />
        <div className="adult-gate__actions">
          <button type="button" className="button button--quiet" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className="button">
            Comprobar
          </button>
        </div>
      </form>
      {/* Announced, because an adult who mistyped may not be looking at it. */}
      {wrong ? (
        <p className="adult-gate__wrong" role="alert">
          Esa no es. Inténtalo otra vez.
        </p>
      ) : null}
    </div>
  );
}
