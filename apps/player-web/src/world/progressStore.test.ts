import { beforeEach, describe, expect, it } from "vitest";
import { EMPTY_PROGRESS } from "./mapView";
import { LOCAL_OWNER, LocalProgressStore, storageKey } from "./progressStore";

const store = () => new LocalProgressStore(localStorage, LOCAL_OWNER);

describe("local progress", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts empty", async () => {
    expect(await store().read()).toEqual(EMPTY_PROGRESS);
  });

  it("round-trips a completion", async () => {
    const written = await store().recordCompletion("encuentro");
    expect(written.completedNodes).toEqual(["encuentro"]);
    expect(written.lastPlayedNode).toBe("encuentro");
    expect(await store().read()).toEqual(written);
  });

  it("records a replay without duplicating the completion", async () => {
    const subject = store();
    await subject.recordCompletion("encuentro");
    await subject.recordCompletion("iniciales");
    const replayed = await subject.recordCompletion("encuentro");

    expect(replayed.completedNodes).toEqual(["encuentro", "iniciales"]);
    expect(replayed.lastPlayedNode).toBe("encuentro");
  });

  it("resets to empty when the stored value is corrupt", async () => {
    localStorage.setItem(storageKey(LOCAL_OWNER), "{not json");
    expect(await store().read()).toEqual(EMPTY_PROGRESS);
  });

  it("resets to empty when the stored value has the wrong shape", async () => {
    localStorage.setItem(
      storageKey(LOCAL_OWNER),
      JSON.stringify({ completedNodes: "encuentro" })
    );
    expect(await store().read()).toEqual(EMPTY_PROGRESS);
  });

  it("drops entries that are not strings rather than failing", async () => {
    localStorage.setItem(
      storageKey(LOCAL_OWNER),
      JSON.stringify({ completedNodes: ["encuentro", 7], lastPlayedNode: null })
    );
    expect((await store().read()).completedNodes).toEqual(["encuentro"]);
  });

  it("keeps one owner's progress out of another's", async () => {
    await new LocalProgressStore(localStorage, "owner-a").recordCompletion("x");
    const other = await new LocalProgressStore(localStorage, "owner-b").read();
    expect(other).toEqual(EMPTY_PROGRESS);
  });

  it("survives storage being unavailable", async () => {
    const denied: Pick<Storage, "getItem" | "setItem"> = {
      getItem() {
        throw new Error("denied");
      },
      setItem() {
        throw new Error("denied");
      }
    };
    const subject = new LocalProgressStore(denied, LOCAL_OWNER);

    expect(await subject.read()).toEqual(EMPTY_PROGRESS);
    expect((await subject.recordCompletion("x")).completedNodes).toEqual(["x"]);
  });
});
