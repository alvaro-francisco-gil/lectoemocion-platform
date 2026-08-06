import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDragScroll } from "./useDragScroll";

function Scroller({ onPress }: { onPress?: () => void }) {
  return (
    <div data-testid="track" ref={useDragScroll()}>
      <button type="button" onClick={onPress}>
        Jugar
      </button>
    </div>
  );
}

/** The element the hook pans, with a scroll position tests can read. */
function track(): HTMLElement {
  return screen.getByTestId("track");
}

describe("drag scrolling", () => {
  afterEach(cleanup);

  it("pans by the distance the pointer travelled", () => {
    render(<Scroller />);
    track().scrollLeft = 40;

    fireEvent.pointerDown(track(), { pointerType: "mouse", clientX: 300 });
    fireEvent.pointerMove(window, { pointerType: "mouse", clientX: 220 });

    expect(track().scrollLeft).toBe(120);
  });

  it("stops panning once the pointer is released", () => {
    render(<Scroller />);

    fireEvent.pointerDown(track(), { pointerType: "mouse", clientX: 300 });
    fireEvent.pointerMove(window, { pointerType: "mouse", clientX: 250 });
    fireEvent.pointerUp(window, { pointerType: "mouse", clientX: 250 });
    fireEvent.pointerMove(window, { pointerType: "mouse", clientX: 100 });

    expect(track().scrollLeft).toBe(50);
  });

  /*
   * A path is dragged by grabbing whatever is under the finger, and what is
   * under the finger is usually a chapter. Without this, panning the world
   * would open one.
   */
  it("swallows the click that ends a drag", () => {
    const onPress = vi.fn();
    render(<Scroller onPress={onPress} />);
    const button = screen.getByRole("button", { name: "Jugar" });

    fireEvent.pointerDown(button, { pointerType: "mouse", clientX: 300 });
    fireEvent.pointerMove(window, { pointerType: "mouse", clientX: 200 });
    fireEvent.pointerUp(window, { pointerType: "mouse", clientX: 200 });
    fireEvent.click(button);

    expect(onPress).not.toHaveBeenCalled();
  });

  it("leaves a tap that never moved alone", () => {
    const onPress = vi.fn();
    render(<Scroller onPress={onPress} />);
    const button = screen.getByRole("button", { name: "Jugar" });

    fireEvent.pointerDown(button, { pointerType: "mouse", clientX: 300 });
    fireEvent.pointerMove(window, { pointerType: "mouse", clientX: 298 });
    fireEvent.pointerUp(window, { pointerType: "mouse", clientX: 298 });
    fireEvent.click(button);

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(track().scrollLeft).toBe(0);
  });

  /* Touch already pans natively, with momentum this could not reproduce. */
  it("leaves touch to the browser", () => {
    render(<Scroller />);

    fireEvent.pointerDown(track(), { pointerType: "touch", clientX: 300 });
    fireEvent.pointerMove(window, { pointerType: "touch", clientX: 100 });

    expect(track().scrollLeft).toBe(0);
  });
});
