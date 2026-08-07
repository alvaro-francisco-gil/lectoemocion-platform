import { describe, expect, it } from "vitest";
import { childRecordId, groupId, prizeId, prizeImageId } from "./ids";

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

describe("prize identifiers", () => {
  it("keeps the value it was given", () => {
    expect(prizeId("p-1")).toBe("p-1");
    expect(prizeImageId("img-1")).toBe("img-1");
  });

  it("refuses an empty identifier", () => {
    expect(() => prizeId("")).toThrow("PrizeId must not be empty");
  });

  it("refuses surrounding whitespace", () => {
    expect(() => prizeImageId(" img-1")).toThrow(
      "PrizeImageId must not have surrounding whitespace"
    );
  });
});
