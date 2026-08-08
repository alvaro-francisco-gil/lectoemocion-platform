import {
  assertNever,
  type Prize,
  type PrizeContent,
  type PrizeId,
  type PrizeImageId
} from "@lectoemocion/domain";
import { prizePresetPhrase } from "@lectoemocion/template-catalog";
import { useState } from "react";
import type { PrizePick } from "../../world/prizeImageStore";
import type { PrizeView } from "../../world/prizes";
import { GoalForm, PrizeForm } from "./PrizeForm";

/**
 * The adult area's body, once the gate has been passed.
 *
 * The goal, then the gifts still to fill in, then the ones already filled in,
 * then a read-only record of what has been given. In that order because that
 * is the order an adult acts in: set the bar, fill what is waiting, check what
 * is done, and only then look back.
 *
 * The two waiting lists come from `PrizeView` rather than from a filter here:
 * "waiting for the child" and "waiting for me" are different questions, and
 * `derivePrizeView` is the one place a prize's state is given a meaning.
 */
export function PrizeSettings({
  view,
  onSetGoal,
  onConfigure,
  onPickImage,
  onDiscardImage
}: {
  view: PrizeView;
  onSetGoal: (goal: number) => void;
  onConfigure: (id: PrizeId, content: PrizeContent) => void;
  onPickImage: (file: File) => Promise<PrizePick>;
  onDiscardImage: (id: PrizeImageId) => void;
}) {
  /*
   * Saving moves a gift from one list to the next, which unmounts the form
   * that saved it — so the confirmation belongs here, above both lists, or it
   * would be announced and removed in the same render.
   *
   * `savedCount` is a counter, not a flag: it never goes back to zero, so
   * every save gets a number no earlier save has used. That number is the
   * confirmation's `key`, which forces React to mount a fresh node each time
   * — resaving a gift that stays in the same list (a prepared one, edited
   * again) does not remount its form, so without a fresh key the second
   * confirmation would have unchanged text in an unchanged node, and
   * aria-live announces nothing for that.
   *
   * It is a `status` rather than an `alert`, and that is what lets it simply
   * stay: `alert` is for something gone wrong and is announced assertively, so
   * a confirmation wearing that role both overstates itself and competes with
   * the panel's real errors for `role="alert"`. As a status it can sit beside
   * a later validation error without either becoming ambiguous, which means
   * nothing has to dismiss it — and nothing may, because dismissing it on the
   * way through an interaction re-renders this panel mid-event and React then
   * reverts the controlled radio that interaction was selecting.
   */
  const [savedCount, setSavedCount] = useState(0);
  const configure = (id: PrizeId, content: PrizeContent) => {
    setSavedCount((count) => count + 1);
    onConfigure(id, content);
  };

  const form = (prize: Prize) => (
    <PrizeForm
      prize={prize}
      onConfigure={configure}
      onPickImage={onPickImage}
      onDiscardImage={onDiscardImage}
    />
  );

  return (
    <div className="prize-settings">
      <GoalForm goal={view.goal} onSetGoal={onSetGoal} />
      {savedCount > 0 ? (
        <p key={savedCount} className="prize-settings__saved" role="status">
          Regalo guardado
        </p>
      ) : null}
      {view.unprepared.length > 0 ? (
        <section className="prize-settings__pending" aria-label="Regalos por preparar">
          <h2>
            {view.unprepared.length === 1
              ? "Un regalo esperando"
              : `${view.unprepared.length} regalos esperando`}
          </h2>
          <ul>
            {view.unprepared.map((prize) => (
              <li key={prize.id}>{form(prize)}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {view.prepared.length > 0 ? (
        <section className="prize-settings__ready" aria-label="Regalos listos">
          <h2>
            {view.prepared.length === 1
              ? "Un regalo listo"
              : `${view.prepared.length} regalos listos`}
          </h2>
          <ul>
            {view.prepared.map((prize) => (
              <li key={prize.id}>{form(prize)}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {view.history.length > 0 ? (
        <section className="prize-settings__history" aria-label="Regalos ya entregados">
          <h2>Regalos entregados</h2>
          <ul>
            {view.history.map((prize) =>
              prize.state === "opened" ? (
                <li key={prize.id}>
                  <GiftSummary content={prize.content} />
                </li>
              ) : null
            )}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** What was inside a gift already given, in the words an adult reads aloud. */
function GiftSummary({ content }: { content: PrizeContent }) {
  switch (content.kind) {
    case "preset":
      return <>{prizePresetPhrase(content.preset)}</>;
    case "custom":
      return <>{content.text}</>;
    default:
      return assertNever(content, "prize content kind");
  }
}
