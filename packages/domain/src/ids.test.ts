import { describe, expect, it } from "vitest";
import { childRecordId, groupId } from "./ids";

describe("identifier constructors", () => {
  it("returns the same string value", () => {
    expect(childRecordId("child-1")).toBe("child-1");
  });

  it("rejects an empty identifier", () => {
    expect(() => childRecordId("   ")).toThrow("ChildRecordId must not be empty");
  });

  it("rejects surrounding whitespace", () => {
    expect(() => groupId(" class-a")).toThrow(
      "GroupId must not have surrounding whitespace"
    );
  });
});
