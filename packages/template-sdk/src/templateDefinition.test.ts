import { describe, expect, it } from "vitest";
import {
  TEMPLATES_NEEDING_ROSTER,
  TEMPLATE_KINDS,
  templateKind,
  templateNeedsRoster
} from "./templateDefinition";

describe("what kind of thing each template is", () => {
  it("calls the book of names cinematic", () => {
    expect(templateKind("name-book")).toBe("cinematic");
  });
});

/**
 * The record is total over `TemplateIdentifier`, so a template added without
 * deciding this fails to compile. These tests prove the decision that was made:
 * exactly one template requires a roster, and every other one plays on
 * product-authored defaults with no uploads.
 */
describe("which templates cannot play without a roster", () => {
  it("names the book of names, and only it", () => {
    const needing = Object.entries(TEMPLATES_NEEDING_ROSTER)
      .filter(([, needed]) => needed)
      .map(([id]) => id);
    expect(needing).toEqual(["name-book"]);
  });

  it("agrees with the accessor", () => {
    expect(templateNeedsRoster("name-book")).toBe(true);
    expect(templateNeedsRoster("illustrated-story")).toBe(false);
    expect(templateNeedsRoster("name-story")).toBe(false);
  });

  it("has an answer for every template there is", () => {
    expect(Object.keys(TEMPLATES_NEEDING_ROSTER).sort()).toEqual(
      Object.keys(TEMPLATE_KINDS).sort()
    );
  });
});
