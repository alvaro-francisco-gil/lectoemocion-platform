import { useState } from "react";
import {
  assertNever,
  checkCouponDraft,
  MAX_COUPON_COST,
  MAX_COUPON_LABEL_LENGTH,
  MIN_COUPON_COST,
  type Coupon,
  type CouponDraft,
  type CouponDraftProblem,
  type CouponId,
  type Purchase
} from "@lectoemocion/domain";
import { PurchaseHistory } from "./PurchaseHistory";

/**
 * The adult's side of the incentives: what a letriestrella is worth here.
 *
 * Nothing is shipped with this list. A reward has to be something *these*
 * adults can actually give — half an hour of football, choosing Friday's film —
 * so there is no default set to fall back to, and an empty list is the honest
 * starting state rather than a fault.
 *
 * Deleting asks twice. There is no adult gate on the menu yet, so the only
 * thing between a curious three-year-old and a wiped list is a second,
 * differently-worded tap. Editing does not ask, because an edit is visible and
 * reversible; a delete is neither.
 */
export function Coupons({
  coupons,
  history,
  onAdd,
  onEdit,
  onRemove
}: {
  coupons: readonly Coupon[];
  history: readonly Purchase[];
  onAdd: (draft: CouponDraft) => void;
  onEdit: (id: CouponId, draft: CouponDraft) => void;
  onRemove: (id: CouponId) => void;
}) {
  /* Which coupon the form is rewriting, or `null` when it is writing a new one. */
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [confirming, setConfirming] = useState<CouponId | null>(null);

  return (
    <section className="coupons" aria-label="Premios">
      <h1 className="coupons__title">Premios</h1>
      <p className="coupons__lead">
        Escribe lo que se puede conseguir con las letriestrellas y cuánto cuesta.
      </p>

      <CouponForm
        key={editing?.id ?? "new"}
        editing={editing}
        onSubmit={(draft) => {
          if (editing === null) onAdd(draft);
          else onEdit(editing.id, draft);
          setEditing(null);
        }}
        onCancel={() => setEditing(null)}
      />

      {coupons.length === 0 ? (
        <p className="coupons__empty">Todavía no has creado ningún premio.</p>
      ) : (
        <ul className="coupons__list">
          {coupons.map((coupon) => (
            <li key={coupon.id} className="coupons__item">
              <span className="coupons__label">{coupon.label}</span>
              <span className="coupons__cost">
                {coupon.cost} letriestrellas
              </span>
              {confirming === coupon.id ? (
                <span className="coupons__confirm" role="group">
                  <span>¿Borrar «{coupon.label}»?</span>
                  <button
                    type="button"
                    className="coupons__danger"
                    onClick={() => {
                      onRemove(coupon.id);
                      setConfirming(null);
                      /* A row being rewritten cannot also be the row just deleted. */
                      if (editing?.id === coupon.id) setEditing(null);
                    }}
                  >
                    Sí, borrar
                  </button>
                  <button type="button" onClick={() => setConfirming(null)}>
                    No
                  </button>
                </span>
              ) : (
                <span className="coupons__actions">
                  <button
                    type="button"
                    aria-label={`Editar ${coupon.label}`}
                    onClick={() => {
                      setEditing(coupon);
                      setConfirming(null);
                    }}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    aria-label={`Borrar ${coupon.label}`}
                    onClick={() => setConfirming(coupon.id)}
                  >
                    Borrar
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <PurchaseHistory
        entries={history}
        showDates
        label="Premios conseguidos"
        empty="Todavía no se ha conseguido ninguno."
      />
    </section>
  );
}

/**
 * One form for both writing and rewriting a coupon.
 *
 * The caller remounts it with a `key` when the target changes, so the fields
 * always start from the coupon being edited and a half-typed draft never
 * survives into a different row.
 */
function CouponForm({
  editing,
  onSubmit,
  onCancel
}: {
  editing: Coupon | null;
  onSubmit: (draft: CouponDraft) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(editing?.label ?? "");
  /*
   * Held as text, not as a number. A number input that is mid-edit is empty,
   * and a state that cannot hold "empty" would silently rewrite what an adult
   * is typing.
   */
  const [cost, setCost] = useState(
    editing === null ? "" : String(editing.cost)
  );
  const [problem, setProblem] = useState<CouponDraftProblem | null>(null);

  return (
    <form
      className="coupon-form"
      onSubmit={(event) => {
        event.preventDefault();
        const checked = checkCouponDraft(label, Number(cost));
        if (!checked.ok) {
          setProblem(checked.problem);
          return;
        }
        setProblem(null);
        onSubmit(checked.draft);
      }}
    >
      <label className="coupon-form__field">
        <span>Premio</span>
        <input
          type="text"
          value={label}
          maxLength={MAX_COUPON_LABEL_LENGTH}
          placeholder="30 minutos de fútbol"
          onChange={(event) => setLabel(event.target.value)}
        />
      </label>
      <label className="coupon-form__field">
        <span>Letriestrellas</span>
        {/*
          A text field with a numeric keypad, not `type="number"`.
          A number input runs its own constraint validation first and blocks the
          submit with a browser bubble, which puts a second, untranslated
          rulebook in front of `checkCouponDraft` — the one place that decides
          what a price may be. Refusing here and saying so in our own words
          keeps that single source of truth, and the keypad still comes up.
        */}
        <input
          type="text"
          inputMode="numeric"
          value={cost}
          placeholder={`${MIN_COUPON_COST}–${MAX_COUPON_COST}`}
          onChange={(event) => setCost(event.target.value)}
        />
      </label>
      {/*
        Announced when it appears: an adult who has just submitted needs to be
        told what is wrong, not to hunt for red text.
      */}
      {problem === null ? null : (
        <p className="coupon-form__problem" role="alert">
          {problemMessage(problem)}
        </p>
      )}
      <div className="coupon-form__actions">
        <button type="submit">{editing === null ? "Crear" : "Guardar"}</button>
        {editing === null ? null : (
          <button type="button" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

/** Adult-facing and recoverable: it names the fault and says what to do. */
function problemMessage(problem: CouponDraftProblem): string {
  switch (problem) {
    case "empty-label":
      return "Escribe qué se puede conseguir.";
    case "label-too-long":
      return `El premio no puede pasar de ${MAX_COUPON_LABEL_LENGTH} letras.`;
    case "cost-not-a-whole-number":
      return "El precio son letriestrellas enteras.";
    case "cost-out-of-range":
      return `El precio va de ${MIN_COUPON_COST} a ${MAX_COUPON_COST} letriestrellas.`;
    default:
      return assertNever(problem, "coupon draft problem");
  }
}
