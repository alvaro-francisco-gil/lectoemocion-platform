import { describe, expect, it } from "vitest";
import { rosterForBuild } from "./devRoster";

/**
 * The one line standing between a school and a screen full of invented
 * children. It is a pure function precisely so this test can exist.
 */
describe("the roster a build ships with", () => {
  it("gives a production build nobody", () => {
    expect(rosterForBuild(false)).toEqual([]);
  });

  it("gives a development build the synthetic class to work against", () => {
    expect(rosterForBuild(true).length).toBeGreaterThan(0);
  });
});
