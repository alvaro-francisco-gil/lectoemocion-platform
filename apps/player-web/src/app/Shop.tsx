import type { CouponId } from "@lectoemocion/domain";
import type { ShopView } from "../world/incentives";
import { CloseIcon, StarIcon } from "./icons";
import { PurchaseHistory } from "./PurchaseHistory";
import { useDragScroll } from "./useDragScroll";

/**
 * What the letriestrellas buy.
 *
 * A screen of its own, like every other screen here, so nothing a child can
 * touch sits over the map. It shows the balance rather than the lifetime total:
 * on this screen the question is what they can have now, and the total that
 * only ever climbs belongs in the corner of the map where it means "look how
 * far you have come".
 *
 * A coupon they cannot afford stays on the shelf, dimmed and disabled rather
 * than hidden. Seeing the thing you are saving for is the whole mechanism; a
 * shop that only shows what you can already have teaches nothing about waiting.
 */
export function Shop({
  view,
  onBuy,
  onClose
}: {
  view: ShopView;
  onBuy: (couponId: CouponId) => void;
  onClose: () => void;
}) {
  return (
    <main className="shop" aria-label="Premios">
      <header className="shop__header">
        <h1 className="shop__title">Premios</h1>
        <p className="shop__balance" aria-label="Letriestrellas para gastar">
          <StarIcon />
          <span className="shop__balance-count">{view.balance}</span>
        </p>
      </header>

      <div className="shop__scroll" ref={useDragScroll()}>
        {view.items.length === 0 ? (
          <p className="shop__empty">Todavía no hay premios.</p>
        ) : (
          <ul className="shop__items">
            {view.items.map((item) => (
              <li key={item.coupon.id}>
                <button
                  type="button"
                  className="coupon"
                  data-affordable={item.affordable}
                  disabled={!item.affordable}
                  /*
                   * The price is part of the name, not a description: a child
                   * who cannot see the card is choosing between rewards, and
                   * what one costs is the thing that decides.
                   */
                  aria-label={`${item.coupon.label}, ${item.coupon.cost} letriestrellas`}
                  onClick={() => onBuy(item.coupon.id)}
                >
                  <span className="coupon__label" aria-hidden="true">
                    {item.coupon.label}
                  </span>
                  <span className="coupon__cost" aria-hidden="true">
                    <StarIcon />
                    {item.coupon.cost}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <PurchaseHistory
          entries={view.history}
          showDates={false}
          label="Ya conseguidos"
          empty="Todavía nada."
        />
      </div>

      {/*
        The way out sits at the bottom of the screen, unlike the map's corners:
        this one is for the child, and a child of three cannot reach the top of
        a classroom panel.
      */}
      <button type="button" className="shop__close" onClick={onClose}>
        <CloseIcon />
        Volver al mapa
      </button>
    </main>
  );
}
