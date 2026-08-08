import { useEffect, useId, useState, type FormEvent } from "react";
import {
  ageInYears,
  type Birth,
  type Month,
  type PlayerProfile,
  type PlayerProfileId
} from "@lectoemocion/domain";
import {
  AVATARS,
  avatarImageUrl,
  DEFAULT_AVATAR_ID
} from "../profiles/avatarCatalogue";
import type { ProfileBook, ProfileDraft } from "../profiles/profileStore";
import { MAX_PROFILES } from "../profiles/profileStore";
import { AdultGate } from "./AdultGate";

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];

/**
 * How far back the year list goes.
 *
 * The product is for three- to five-year-olds; eight years covers that with
 * room for an older sibling sharing the tablet, and a short list is faster to
 * pick from than a free-text year nobody can mistype.
 */
const YEARS_OFFERED = 8;

/** What the drawer is doing. Exclusive: one thing is on screen at a time. */
type View =
  | { readonly kind: "list" }
  | { readonly kind: "gate"; readonly then: PlayerProfile | "new" }
  | { readonly kind: "edit"; readonly target: PlayerProfile | "new" }
  | { readonly kind: "confirm-delete"; readonly target: PlayerProfile };

function ageLabel(birth: Birth, today: Date): string {
  const age = ageInYears(birth, today);
  if (age === null) return "Añadir fecha";
  return age === 1 ? "1 año" : `${age} años`;
}

/**
 * Who is playing, and the way to change it.
 *
 * A drawer over the world rather than a screen replacing it. The world staying
 * visible tells a child the game is still there and they are coming back,
 * which matters more at three years old than the one-screen-at-a-time rule
 * this deliberately breaks. The mis-tap that rule was protecting against is
 * handled by the scrim, and by the shell refusing to open a chapter while this
 * is up — a stylesheet alone is not a guarantee.
 *
 * Switching is open to anyone. Adding, editing and deleting are behind
 * `AdultGate`: a child picking their own face is the point of the drawer, and
 * a child deleting their brother is not.
 *
 * It is also the way into the adult area, which used to have a button of its
 * own in the world's corner. One door rather than two: everything an adult
 * does is now reached from here, and the world keeps the avatar alone.
 */
export function ProfileMenu({
  book,
  today,
  onSelect,
  onAdd,
  onUpdate,
  onRemove,
  onOpenAdultArea,
  onClose
}: {
  book: ProfileBook;
  today: Date;
  onSelect: (id: PlayerProfileId) => void;
  onAdd: (draft: ProfileDraft) => void;
  onUpdate: (id: PlayerProfileId, draft: ProfileDraft) => void;
  onRemove: (id: PlayerProfileId) => void;
  onOpenAdultArea: () => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<View>({ kind: "list" });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <>
      {/*
        Not a button and not focusable: it is the world's own surface refusing to
        be touched, and a screen reader already has the dialog. Sighted mouse
        and touch users get the dismissal they expect from a dimmed backdrop.
      */}
      <div
        className="profile-menu__scrim"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="profile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Quién juega"
      >
        <button
          type="button"
          className="profile-menu__close"
          aria-label="Cerrar el menú"
          onClick={onClose}
        >
          <CloseGlyph />
        </button>

        {/* Rendered from here but not *within* here: the gate takes the whole
            screen, so the drawer is behind it rather than around it. */}
        {view.kind === "gate" ? (
          <AdultGate
            today={today}
            onPass={() => setView({ kind: "edit", target: view.then })}
            onCancel={() => setView({ kind: "list" })}
          />
        ) : null}

        {view.kind === "edit" ? (
          <ProfileForm
            target={view.target}
            today={today}
            deletable={view.target !== "new" && book.profiles.length > 1}
            onDelete={() => {
              if (view.target !== "new") {
                setView({ kind: "confirm-delete", target: view.target });
              }
            }}
            onCancel={() => setView({ kind: "list" })}
            onSave={(draft) => {
              if (view.target === "new") onAdd(draft);
              else onUpdate(view.target.id, draft);
              setView({ kind: "list" });
              onClose();
            }}
          />
        ) : null}

        {view.kind === "confirm-delete" ? (
          <div className="profile-delete">
            <p className="profile-delete__warning">
              Se borrará {view.target.name} y todas sus letriestrellas. No se
              puede deshacer.
            </p>
            <div className="profile-menu__actions">
              <button
                type="button"
                className="button button--quiet"
                onClick={() => setView({ kind: "edit", target: view.target })}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="button button--danger"
                onClick={() => {
                  onRemove(view.target.id);
                  setView({ kind: "list" });
                  onClose();
                }}
              >
                Sí, borrar a {view.target.name}
              </button>
            </div>
          </div>
        ) : null}

        {view.kind === "list" ? (
          <>
            <ul className="profile-list">
              {book.profiles.map((profile) => (
                <li
                  key={profile.id}
                  className="profile-list__row"
                  data-current={profile.id === book.selectedId}
                >
                  {profile.id === book.selectedId ? (
                    <span className="profile-list__who">
                      <Face profile={profile} />
                      <span className="profile-list__text">
                        <span className="profile-list__name">{profile.name}</span>
                        <span className="profile-list__age">
                          {ageLabel(profile.birth, today)}
                        </span>
                      </span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="profile-list__who profile-list__who--pressable"
                      aria-label={`Jugar como ${profile.name}`}
                      onClick={() => {
                        onSelect(profile.id);
                        onClose();
                      }}
                    >
                      <Face profile={profile} />
                      <span className="profile-list__text">
                        <span className="profile-list__name">{profile.name}</span>
                        <span className="profile-list__age">
                          {ageLabel(profile.birth, today)}
                        </span>
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="profile-list__edit"
                    aria-label={`Editar a ${profile.name}`}
                    onClick={() => setView({ kind: "gate", then: profile })}
                  >
                    <PencilGlyph />
                  </button>
                </li>
              ))}
            </ul>

            <button
              type="button"
              className="profile-menu__add"
              disabled={book.profiles.length >= MAX_PROFILES}
              onClick={() => setView({ kind: "gate", then: "new" })}
            >
              <span className="profile-menu__plus" aria-hidden="true">
                +
              </span>
              Añadir niño
            </button>

            {/*
              Planned, and shown as planned. It has a scoped document under
              `docs/plans/ideas/`; a disabled row that says "próximamente" is a
              promise the repository can be held to, where a row that silently
              did nothing would be a lie.
            */}
            <hr className="profile-menu__rule" />
            <SoonRow label="Progreso" />
            {/*
              The one door into the adult area, and no gate of its own: the area
              carries `AdultGate` around itself, so a second keypad here would
              ask the same question twice and be the second place it could be
              got wrong.
            */}
            <button
              type="button"
              className="profile-menu__adults"
              onClick={onOpenAdultArea}
            >
              Zona de adultos
            </button>
          </>
        ) : null}
      </div>
    </>
  );
}

function SoonRow({ label }: { label: string }) {
  return (
    <button type="button" className="profile-menu__soon" disabled>
      <span className="profile-menu__soon-label">{label}</span>
      <span className="profile-menu__soon-note">próximamente</span>
    </button>
  );
}

function Face({ profile }: { profile: PlayerProfile }) {
  return (
    <img
      className="profile-face"
      src={avatarImageUrl(profile.avatarId)}
      alt=""
      width={44}
      height={44}
    />
  );
}

/**
 * Adding a child, or correcting one.
 *
 * One form for both, because they ask for exactly the same four things and a
 * second nearly-identical form is a second place for them to drift apart.
 */
function ProfileForm({
  target,
  today,
  deletable,
  onSave,
  onDelete,
  onCancel
}: {
  target: PlayerProfile | "new";
  today: Date;
  deletable: boolean;
  onSave: (draft: ProfileDraft) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const existing = target === "new" ? null : target;
  const [name, setName] = useState(existing?.name ?? "");
  const [avatar, setAvatar] = useState(existing?.avatarId ?? DEFAULT_AVATAR_ID);
  const [month, setMonth] = useState(
    existing?.birth.known === true ? String(existing.birth.month) : ""
  );
  const [year, setYear] = useState(
    existing?.birth.known === true ? String(existing.birth.year) : ""
  );
  const nameId = useId();
  const monthId = useId();
  const yearId = useId();
  const avatarGroup = useId();

  const thisYear = today.getFullYear();
  const years = Array.from(
    { length: YEARS_OFFERED },
    (_, index) => thisYear - index
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim().length === 0) return;

    /*
     * A month without a year says nothing, so the date is known only when both
     * are given. This is the one place `Birth` is constructed from a form, and
     * the union is what stops a half-filled date reaching the store.
     */
    const birth: Birth =
      month !== "" && year !== ""
        ? { known: true, month: Number(month) as Month, year: Number(year) }
        : { known: false };

    onSave({ name: name.trim(), avatarId: avatar, birth });
  };

  return (
    <form className="profile-form" onSubmit={submit}>
      <label className="profile-form__label" htmlFor={nameId}>
        Nombre
      </label>
      <input
        id={nameId}
        className="profile-form__name"
        value={name}
        autoComplete="off"
        onChange={(event) => setName(event.target.value)}
      />

      <fieldset className="profile-form__avatars">
        <legend className="profile-form__label">Dibujo</legend>
        {AVATARS.map((option) => (
          <label key={option.id} className="profile-form__avatar">
            <input
              type="radio"
              name={avatarGroup}
              value={option.id}
              aria-label={option.label}
              checked={avatar === option.id}
              onChange={() => setAvatar(option.id)}
            />
            <img
              src={avatarImageUrl(option.id)}
              alt=""
              width={56}
              height={56}
            />
          </label>
        ))}
      </fieldset>

      <div className="profile-form__birth">
        <span className="profile-form__label">Cumpleaños</span>
        <label className="profile-form__sub" htmlFor={monthId}>
          Mes
        </label>
        <select
          id={monthId}
          value={month}
          onChange={(event) => setMonth(event.target.value)}
        >
          <option value="">—</option>
          {MONTHS.map((label, index) => (
            <option key={label} value={index + 1}>
              {label}
            </option>
          ))}
        </select>

        <label className="profile-form__sub" htmlFor={yearId}>
          Año
        </label>
        <select
          id={yearId}
          value={year}
          onChange={(event) => setYear(event.target.value)}
        >
          <option value="">—</option>
          {years.map((each) => (
            <option key={each} value={each}>
              {each}
            </option>
          ))}
        </select>
      </div>

      <div className="profile-menu__actions">
        {deletable ? (
          <button
            type="button"
            className="button button--danger-quiet"
            onClick={onDelete}
          >
            Borrar
          </button>
        ) : null}
        <button type="button" className="button button--quiet" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="button">
          Guardar
        </button>
      </div>
    </form>
  );
}

function CloseGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PencilGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M4 20h4L19 9l-4-4L4 16v4zM15 5l4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
