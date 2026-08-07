import type { Purchase } from "@lectoemocion/domain";
import { StarIcon } from "./icons";

/**
 * What has already been bought, newest first.
 *
 * One list, two readers. A child sees what they got and what it cost, because
 * that is the record of their own effort. An adult additionally sees when —
 * they are the one who has to honour "media hora de fútbol", and a promise
 * without a date is one nobody can settle.
 *
 * Entries are the purchase's own snapshot of the coupon, so re-pricing or
 * deleting a coupon never rewrites what a child is looking at here.
 */
export function PurchaseHistory({
  entries,
  showDates,
  label,
  empty
}: {
  entries: readonly Purchase[];
  showDates: boolean;
  label: string;
  empty: string;
}) {
  return (
    <section className="history" aria-label={label}>
      <h2 className="history__title">{label}</h2>
      {entries.length === 0 ? (
        <p className="history__empty">{empty}</p>
      ) : (
        <ul className="history__entries">
          {entries.map((entry) => (
            <li key={entry.id} className="history__entry">
              <span className="history__label">{entry.label}</span>
              <span className="history__cost">
                <StarIcon />
                {entry.cost}
              </span>
              {showDates ? (
                <time
                  className="history__date"
                  dateTime={entry.purchasedAt}
                >
                  {formatDay(entry.purchasedAt)}
                </time>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const DAY = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  year: "numeric"
});

/**
 * The day, not the minute.
 *
 * An adult settling a promise needs to know it was Tuesday; the exact second is
 * noise. An unparseable timestamp shows the string it was stored as rather than
 * "Invalid Date" — the entry is still a real purchase, and the label and cost
 * beside it are what the promise actually is.
 */
function formatDay(iso: string): string {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? iso : DAY.format(at);
}
