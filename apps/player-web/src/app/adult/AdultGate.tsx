import { isPlausibleBirthYear } from "@lectoemocion/domain";
import { useId, useState, type ReactNode } from "react";

/**
 * The one door into the adult area.
 *
 * A birth year rather than a PIN: there is nothing to set up, nothing to
 * forget, and nothing to write on the back of the panel. It is not security and
 * is not described as such — it is sized to a curious three-year-old, and
 * anything stronger belongs with accounts.
 *
 * Passing it opens the area for this visit only. Leaving closes it again, so a
 * device left on the map is a device a child cannot get past.
 */
export function AdultGate({
  currentYear,
  children
}: {
  currentYear: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState("");
  const [refused, setRefused] = useState(false);
  const fieldId = useId();

  if (open) return <>{children}</>;

  return (
    <form
      className="adult-gate"
      onSubmit={(event) => {
        event.preventDefault();
        if (isPlausibleBirthYear(Number.parseInt(year, 10), currentYear)) {
          setOpen(true);
          return;
        }
        setRefused(true);
        setYear("");
      }}
    >
      <label className="adult-gate__label" htmlFor={fieldId}>
        ¿En qué año naciste?
      </label>
      <input
        id={fieldId}
        className="adult-gate__field"
        type="number"
        inputMode="numeric"
        autoComplete="off"
        value={year}
        onChange={(event) => setYear(event.target.value)}
      />
      {refused ? (
        <p className="adult-gate__refusal" role="alert">
          Ese año no puede ser. Inténtalo otra vez.
        </p>
      ) : null}
      <button type="submit" className="adult-gate__submit">
        Entrar
      </button>
    </form>
  );
}
