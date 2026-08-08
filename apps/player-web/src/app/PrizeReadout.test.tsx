import { render, screen } from "@testing-library/react";
import { act, createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FLARE_MS,
  PrizeCount,
  PrizeRing,
  StarFlight,
  STAR_STAGGER_MS,
  STAR_TRAVEL_MS
} from "./PrizeReadout";

describe("the counter in the corner", () => {
  /* Nothing to say, and nothing on screen saying it. */
  it("draws nothing before the first letriestrella", () => {
    render(
      <PrizeCount
        shown={0}
        arriving={false}
        landings={0}
        pill={createRef<HTMLParagraphElement>()}
      />
    );
    expect(document.querySelector(".prize-count")).toBeNull();
  });

  /*
   * The first flight has to aim somewhere. The pill is laid out so it can be
   * measured, and hidden so no child is shown a nought.
   */
  it("is laid out but unseen while the first stars are still flying", () => {
    render(
      <PrizeCount
        shown={0}
        arriving
        landings={0}
        pill={createRef<HTMLParagraphElement>()}
      />
    );
    const pill = document.querySelector(".prize-count");
    expect(pill).not.toBeNull();
    expect(pill).toHaveAttribute("data-waiting");
  });

  it("shows the count once a star has landed", () => {
    render(
      <PrizeCount
        shown={1}
        arriving
        landings={1}
        pill={createRef<HTMLParagraphElement>()}
      />
    );
    const pill = document.querySelector(".prize-count");
    expect(pill).toHaveTextContent("1");
    expect(pill).not.toHaveAttribute("data-waiting");
  });

  /* Hidden from a screen reader: the ring says the same thing, in words. */
  it("stays out of the accessibility tree", () => {
    render(
      <PrizeCount
        shown={3}
        arriving={false}
        landings={0}
        pill={createRef<HTMLParagraphElement>()}
      />
    );
    expect(document.querySelector(".prize-count")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
  });
});

describe("the flare", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("marks the pill for one beat after a landing, then lets it settle", () => {
    const pill = createRef<HTMLParagraphElement>();
    const { rerender } = render(
      <PrizeCount shown={3} arriving landings={0} pill={pill} />
    );
    expect(document.querySelector(".prize-count")).not.toHaveAttribute(
      "data-flaring"
    );

    rerender(<PrizeCount shown={4} arriving landings={1} pill={pill} />);
    expect(document.querySelector(".prize-count")).toHaveAttribute(
      "data-flaring"
    );

    act(() => {
      vi.advanceTimersByTime(FLARE_MS);
    });
    expect(document.querySelector(".prize-count")).not.toHaveAttribute(
      "data-flaring"
    );
  });

  it("flares the ring on the same landing", () => {
    const { rerender } = render(
      <PrizeRing shown={3} goal={30} landings={0} />
    );
    rerender(<PrizeRing shown={4} goal={30} landings={1} />);
    expect(document.querySelector(".prize-meter")).toHaveAttribute(
      "data-flaring"
    );
  });
});

describe("the ring", () => {
  it("draws nothing before the first letriestrella", () => {
    render(<PrizeRing shown={0} goal={30} landings={0} />);
    expect(screen.queryByRole("meter")).toBeNull();
  });

  /* The picture and the attributes state the same fraction. */
  it("fills in proportion to the goal it is measured against", () => {
    render(<PrizeRing shown={15} goal={30} landings={0} />);
    const meter = screen.getByRole("meter", {
      name: "Letriestrellas hacia el próximo regalo"
    });
    expect(meter).toHaveAttribute("aria-valuenow", "15");
    expect(meter).toHaveAttribute("aria-valuemax", "30");
    expect(
      meter.querySelector(".prize-meter__fill")?.getAttribute("stroke-dasharray")
    ).toBe("50 50");
  });
});

describe("the flight to the counter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /*
   * The world screen is the only thing that renders this, so its mount is how
   * the reducer learns the world is on screen. Deriving that in `App` from the
   * screens that precede it would be a second copy of their ordering.
   */
  it("reports that the world has arrived, once", () => {
    const onArrive = vi.fn();
    const { rerender } = render(
      <StarFlight
        flight={null}
        pill={createRef<HTMLParagraphElement>()}
        onArrive={onArrive}
        onLanded={vi.fn()}
      />
    );
    rerender(
      <StarFlight
        flight={{ id: 1, count: 3, landed: 0 }}
        pill={createRef<HTMLParagraphElement>()}
        onArrive={onArrive}
        onLanded={vi.fn()}
      />
    );
    expect(onArrive).toHaveBeenCalledTimes(1);
  });

  it("draws one star per letriestrella still in the air", () => {
    render(
      <StarFlight
        flight={{ id: 1, count: 3, landed: 0 }}
        pill={createRef<HTMLParagraphElement>()}
        onArrive={vi.fn()}
        onLanded={vi.fn()}
      />
    );
    expect(document.querySelectorAll(".star-flight__star")).toHaveLength(3);
  });

  /* Staggered, so three stars are three arrivals rather than one. */
  it("lands them one at a time", () => {
    const onLanded = vi.fn();
    render(
      <StarFlight
        flight={{ id: 1, count: 3, landed: 0 }}
        pill={createRef<HTMLParagraphElement>()}
        onArrive={vi.fn()}
        onLanded={onLanded}
      />
    );

    act(() => {
      vi.advanceTimersByTime(STAR_TRAVEL_MS);
    });
    expect(onLanded).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(STAR_STAGGER_MS * 2);
    });
    expect(onLanded).toHaveBeenCalledTimes(3);
  });

  /* Decoration only: it must not be read out, and it must not eat a tap. */
  it("is hidden from a screen reader", () => {
    render(
      <StarFlight
        flight={{ id: 1, count: 3, landed: 0 }}
        pill={createRef<HTMLParagraphElement>()}
        onArrive={vi.fn()}
        onLanded={vi.fn()}
      />
    );
    expect(document.querySelector(".star-flight")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
  });

  it("draws nothing when nothing is in the air", () => {
    render(
      <StarFlight
        flight={null}
        pill={createRef<HTMLParagraphElement>()}
        onArrive={vi.fn()}
        onLanded={vi.fn()}
      />
    );
    expect(document.querySelector(".star-flight")).toBeNull();
  });
});
