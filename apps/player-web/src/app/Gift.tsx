import {
  assertNever,
  type Prize,
  type PrizeContent,
  type PrizeId
} from "@lectoemocion/domain";
import { prizePresetPhrase } from "@lectoemocion/template-catalog";
import type { ReactElement } from "react";
import { GiftIcon } from "./icons";
import { PrizeIllustration } from "./prizeIllustration";

/**
 * The reveal's contents, switched on `content.kind` and closed with
 * `assertNever` so a third kind of prize fails to compile here rather than
 * rendering nothing.
 */
function GiftContent({
  content,
  imageUrl
}: {
  content: PrizeContent;
  imageUrl: string | null;
}): ReactElement {
  switch (content.kind) {
    case "preset":
      return (
        <>
          <PrizeIllustration preset={content.preset} />
          <p className="reveal__name">{prizePresetPhrase(content.preset)}</p>
        </>
      );
    case "custom":
      return (
        <>
          {imageUrl !== null ? <img src={imageUrl} alt="" /> : null}
          <p className="reveal__name">{content.text}</p>
        </>
      );
    default:
      return assertNever(content, "prize content");
  }
}

/**
 * The gift ceremony: waiting, opening, and what was inside.
 *
 * Three states, one screen, because to a child it is one gift throughout —
 * only what it shows changes. `unconfigured` never renders an open button:
 * there is nothing to open yet. `ready` renders nothing of the content, so
 * the surprise survives until the child presses `¡Ábrelo!` themselves.
 */
export function Gift({
  prize,
  imageUrl,
  onOpen,
  onPrepare,
  onContinue
}: {
  prize: Prize;
  imageUrl: string | null;
  onOpen: (id: PrizeId) => void;
  onPrepare: () => void;
  onContinue: () => void;
}): ReactElement {
  switch (prize.state) {
    case "unconfigured":
      return (
        <main className="award">
          <div className="award__prize" role="status">
            <div className="gift__box">
              <GiftIcon />
            </div>
            <p className="award__count">Un regalo te está esperando</p>
          </div>
          <button type="button" className="gift__prepare" onClick={onPrepare}>
            Preparar el regalo
          </button>
          <button type="button" className="reveal__continue" onClick={onContinue}>
            Seguir
          </button>
        </main>
      );
    case "ready":
      return (
        <main className="award">
          <div className="award__prize" role="status">
            <div className="gift__box">
              <GiftIcon />
            </div>
          </div>
          <button
            type="button"
            className="reveal__continue"
            onClick={() => onOpen(prize.id)}
          >
            ¡Ábrelo!
          </button>
        </main>
      );
    case "opened":
      return (
        <main className="reveal">
          <div className="gift__reveal reveal__prize" role="status">
            <GiftContent content={prize.content} imageUrl={imageUrl} />
          </div>
          <button type="button" className="reveal__continue" onClick={onContinue}>
            Seguir
          </button>
        </main>
      );
    default:
      return assertNever(prize, "gift state");
  }
}
