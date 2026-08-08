import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

/**
 * Testing Library only auto-cleans when the test globals are injected, and this
 * project does not inject them. Without this, a second render in the same file
 * finds the previous test's DOM still mounted.
 */
afterEach(cleanup);

/**
 * jsdom has no compositor, so `reduce` is the honest answer to every motion
 * query: nothing here can draw a transition, and a test that waited for one
 * would be waiting on a wall clock rather than on the app. A test that is
 * *about* an animation calls `preferMotion("full")` instead, and waits on the
 * real clock for the flight it deliberately turned on.
 */
export function preferMotion(motion: "full" | "reduced"): void {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches:
        motion === "reduced" && query.includes("prefers-reduced-motion: reduce"),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false
    }) as MediaQueryList;
}

beforeEach(() => preferMotion("reduced"));
