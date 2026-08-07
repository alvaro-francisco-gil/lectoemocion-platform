import { useEffect, useState } from "react";
import {
  ADULT_YEAR_DIGITS,
  isAdultBirthYear
} from "../profiles/adultYear";

/** The pad, in reading order, with zero alone under the middle column. */
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * The lock in front of anything a child must not change.
 *
 * It takes the whole screen rather than sitting inside the panel that summoned
 * it, so that it can be put in front of *any* feature: the caller says what
 * happens on the way through and nothing about how the asking looks. It is the
 * one control in this app deliberately built to be reused.
 *
 * The question is a year of birth, and the answer is judged by
 * `isAdultBirthYear`, which checks plausibility rather than truth — read its
 * comment before trusting this with anything. What defeats a preschooler is
 * the shape of the answer: four digits is beyond a child still learning
 * letters, and their own year of birth, the one year they might have heard, is
 * refused by construction.
 *
 * No submit button. Four digits is the whole answer, so a confirming tap
 * afterwards would be one more thing to find for nothing.
 */
export function AdultGate({
  today,
  onPass,
  onCancel
}: {
  today: Date;
  onPass: () => void;
  onCancel: () => void;
}) {
  const [digits, setDigits] = useState("");
  const [refused, setRefused] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  const press = (key: string) => {
    if (digits.length >= ADULT_YEAR_DIGITS) return;
    const next = digits + key;
    setRefused(false);

    if (next.length < ADULT_YEAR_DIGITS) {
      setDigits(next);
      return;
    }

    if (isAdultBirthYear(next, today)) {
      onPass();
      return;
    }
    /* Cleared rather than corrected: a wrong year is not a typo to fix, and
       leaving three digits up invites a child to keep poking at the fourth. */
    setDigits("");
    setRefused(true);
  };

  return (
    <div
      className="adult-gate"
      role="dialog"
      aria-modal="true"
      aria-label="Sólo para adultos"
    >
      <button
        type="button"
        className="adult-gate__close"
        aria-label="Cerrar"
        onClick={onCancel}
      >
        <CloseGlyph />
      </button>

      <div className="adult-gate__ask">
        {/* The one character this world already has, standing in as the adult
            being addressed. No new art, and nothing invented. */}
        <img className="adult-gate__duende" src="/world/duende.webp" alt="" />
        <h1 className="adult-gate__title">Sólo para adultos</h1>
        <p className="adult-gate__prompt">Escribe tu año de nacimiento</p>

        <div className="adult-gate__digits">
          {Array.from({ length: ADULT_YEAR_DIGITS }, (_, index) => (
            <span
              key={index}
              className="adult-gate__digit"
              data-testid="adult-gate-digit"
            >
              {digits[index] ?? ""}
            </span>
          ))}
        </div>

        {/* Announced, because an adult who mistyped may be looking at the pad. */}
        {refused ? (
          <p className="adult-gate__refused" role="alert">
            Ese año no puede ser. Inténtalo otra vez.
          </p>
        ) : null}
      </div>

      <div className="adult-gate__pad">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className="adult-gate__key"
            onClick={() => press(key)}
          >
            {key}
          </button>
        ))}
        <button
          type="button"
          className="adult-gate__key adult-gate__key--zero"
          onClick={() => press("0")}
        >
          0
        </button>
        <button
          type="button"
          className="adult-gate__key adult-gate__key--back"
          aria-label="Borrar"
          onClick={() => {
            setRefused(false);
            setDigits(digits.slice(0, -1));
          }}
        >
          <BackGlyph />
        </button>
      </div>
    </div>
  );
}

function CloseGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BackGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <path
        d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9L3 12z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M12 9.5l5 5M17 9.5l-5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
