import { useCallback, type RefCallback } from "react";

/**
 * How far a pointer must travel before it counts as a drag rather than a tap.
 *
 * A finger on a touchscreen and a hand on a mouse both wobble on the way down.
 * Below this, the gesture is still a press on whatever is underneath.
 */
const DRAG_THRESHOLD_PX = 5;

/**
 * Grab-and-pan for a horizontally scrolling band.
 *
 * The world path is wider than the screen, and a scrollbar is the wrong control
 * for it: it is a thin adult target at the edge of the band, it says nothing to
 * a child about what it does, and on the classroom panel it is not reachable at
 * all. Dragging the path itself is what the gesture already is on a touchscreen,
 * so this only teaches the mouse and the stylus the same move — touch is left to
 * the browser, whose momentum and rubber-banding this could not reproduce.
 *
 * The click that ends a drag is swallowed, because the thing under the hand is
 * almost always a chapter and panning the world must never open one.
 */
export function useDragScroll(): RefCallback<HTMLElement> {
  return useCallback((element: HTMLElement | null) => {
    if (element === null) return;

    let origin: { readonly x: number; readonly scrollLeft: number } | null =
      null;
    let dragged = false;

    const move = (event: PointerEvent): void => {
      if (origin === null) return;
      const travelled = origin.x - event.clientX;
      if (!dragged && Math.abs(travelled) < DRAG_THRESHOLD_PX) return;
      dragged = true;
      element.scrollLeft = origin.scrollLeft + travelled;
    };

    const release = (): void => {
      origin = null;
      element.removeAttribute("data-dragging");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };

    const down = (event: PointerEvent): void => {
      if (event.pointerType === "touch" || event.button !== 0) return;
      origin = { x: event.clientX, scrollLeft: element.scrollLeft };
      dragged = false;
      element.setAttribute("data-dragging", "");
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", release);
      window.addEventListener("pointercancel", release);
    };

    /*
     * Capture phase, so the chapter's own handler never runs. `dragged` is
     * cleared here rather than on release: this listener is what consumes the
     * flag, and clearing it earlier would let the click through.
     */
    const swallowClick = (event: MouseEvent): void => {
      if (!dragged) return;
      dragged = false;
      event.stopPropagation();
      event.preventDefault();
    };

    /* The browser's native image drag would otherwise fight the pan. */
    const preventNativeDrag = (event: DragEvent): void => event.preventDefault();

    element.addEventListener("pointerdown", down);
    element.addEventListener("click", swallowClick, { capture: true });
    element.addEventListener("dragstart", preventNativeDrag);

    return () => {
      release();
      element.removeEventListener("pointerdown", down);
      element.removeEventListener("click", swallowClick, { capture: true });
      element.removeEventListener("dragstart", preventNativeDrag);
    };
  }, []);
}
