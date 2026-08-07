import {
  assertNever,
  type PrizeContent,
  type PrizeId,
  type PrizeImageId
} from "@lectoemocion/domain";
import { prizePresetPhrase } from "@lectoemocion/template-catalog";
import type { PrizeView } from "../../world/prizes";
import { GoalForm, PrizeForm } from "./PrizeForm";

/**
 * The adult area's body, once the gate has been passed.
 *
 * The goal, then a form per gift waiting to be filled, then a read-only record
 * of what has already been given. In that order because that is the order an
 * adult acts in: set the bar, fill what is waiting, and only then look back.
 */
export function PrizeSettings({
  view,
  onSetGoal,
  onConfigure,
  onPickImage
}: {
  view: PrizeView;
  onSetGoal: (goal: number) => void;
  onConfigure: (id: PrizeId, content: PrizeContent) => void;
  onPickImage: (file: File) => Promise<PrizeImageId | null>;
}) {
  return (
    <div className="prize-settings">
      <GoalForm goal={view.goal} onSetGoal={onSetGoal} />
      {view.pending.length > 0 ? (
        <section className="prize-settings__pending" aria-label="Regalos por preparar">
          <h2>
            {view.pending.length === 1
              ? "Un regalo esperando"
              : `${view.pending.length} regalos esperando`}
          </h2>
          <ul>
            {view.pending.map((prize) => (
              <li key={prize.id}>
                <PrizeForm
                  prize={prize}
                  onConfigure={onConfigure}
                  onPickImage={onPickImage}
                />
              </li>
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
