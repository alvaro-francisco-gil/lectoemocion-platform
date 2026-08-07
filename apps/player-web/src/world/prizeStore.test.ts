import { prizeId, type PrizeContent, type PrizeId } from "@lectoemocion/domain";
import { beforeEach, describe, expect, it } from "vitest";
import { LOCAL_OWNER } from "./progressStore";
import { EMPTY_PRIZES } from "./prizes";
import { LocalPrizeStore, prizeStorageKey, type Minter } from "./prizeStore";

const PATIO: PrizeContent = { kind: "preset", preset: "patio" };

/** A storage that a test can read, seed and break. */
function memoryStorage(seed: Record<string, string> = {}) {
  const entries = new Map(Object.entries(seed));
  return {
    entries,
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    }
  };
}

/** Names every id and moment, so assertions are about values the test chose. */
function countingMinter(): Minter {
  let minted = 0;
  return {
    prizeId: () => prizeId(`p-${++minted}`),
    now: () => "2026-08-07T10:00:00.000Z"
  };
}

describe("LocalPrizeStore", () => {
  let storage: ReturnType<typeof memoryStorage>;
  let store: LocalPrizeStore;

  beforeEach(() => {
    storage = memoryStorage();
    store = new LocalPrizeStore(storage, LOCAL_OWNER, countingMinter());
  });

  it("starts at the default goal with nothing awarded", async () => {
    await expect(store.read()).resolves.toEqual(EMPTY_PRIZES);
  });

  it("awards what is owed and persists it under the owner's key", async () => {
    const next = await store.awardDue(30);
    expect(next.prizes).toHaveLength(1);
    expect(storage.entries.get(prizeStorageKey(LOCAL_OWNER))).toContain("p-1");
  });

  it("configures and opens a prize", async () => {
    await store.awardDue(30);
    await store.configure(prizeId("p-1"), PATIO);
    const opened = await store.open(prizeId("p-1"));
    expect(opened.prizes[0]).toMatchObject({
      state: "opened",
      openedAt: "2026-08-07T10:00:00.000Z"
    });
  });

  it("refuses a goal outside the typo guard and keeps the old one", async () => {
    await expect(store.setGoal(0)).resolves.toMatchObject({ goal: 30 });
    await expect(store.setGoal(10)).resolves.toMatchObject({ goal: 10 });
  });

  it("reads back a stored list", async () => {
    const seeded = new LocalPrizeStore(
      memoryStorage({
        [prizeStorageKey(LOCAL_OWNER)]: JSON.stringify({
          goal: 12,
          prizes: [
            {
              id: "p-9",
              state: "ready",
              awardedAt: "2026-08-01T10:00:00.000Z",
              costStars: 12,
              content: { kind: "preset", preset: "mesa" }
            }
          ]
        })
      }),
      LOCAL_OWNER,
      countingMinter()
    );
    const read = await seeded.read();
    expect(read.goal).toBe(12);
    expect(read.prizes).toHaveLength(1);
  });

  it("drops a corrupt prize rather than the whole list", async () => {
    const seeded = new LocalPrizeStore(
      memoryStorage({
        [prizeStorageKey(LOCAL_OWNER)]: JSON.stringify({
          goal: 30,
          prizes: [
            { id: "p-1", state: "unconfigured", awardedAt: "x", costStars: 30 },
            { id: "p-2", state: "ready", awardedAt: "x", costStars: 30 },
            { id: "p-3", state: "ready", awardedAt: "x", costStars: 30,
              content: { kind: "preset", preset: "garaje" } },
            { id: "p-4", state: "ready", awardedAt: "x", costStars: 30,
              content: { kind: "custom", text: "un helado", imageId: null } }
          ]
        })
      }),
      LOCAL_OWNER,
      countingMinter()
    );
    const read = await seeded.read();
    expect(read.prizes.map((prize) => prize.id)).toEqual([
      prizeId("p-1"),
      prizeId("p-4")
    ]);
  });

  /*
   * An id is a string the identifier constructor still refuses — empty, or
   * padded. It throws, and a throw here escapes the whole parse: the ledger
   * would read as empty and the next write would overwrite every prize an
   * adult had promised. One entry is the price of a corrupt entry.
   */
  it("drops a prize whose id is not an id, and keeps the rest", async () => {
    const seeded = new LocalPrizeStore(
      memoryStorage({
        [prizeStorageKey(LOCAL_OWNER)]: JSON.stringify({
          goal: 30,
          prizes: [
            { id: "", state: "unconfigured", awardedAt: "x", costStars: 30 },
            { id: " p-2 ", state: "unconfigured", awardedAt: "x", costStars: 30 },
            { id: "p-3", state: "unconfigured", awardedAt: "x", costStars: 30 }
          ]
        })
      }),
      LOCAL_OWNER,
      countingMinter()
    );
    const read = await seeded.read();
    expect(read.prizes.map((prize) => prize.id)).toEqual([prizeId("p-3")]);
    expect(read.goal).toBe(30);
  });

  /*
   * The picture is the optional half of a custom prize. A corrupt image id
   * costs the picture; the words the adult promised to read aloud survive.
   */
  it("keeps a prize whose image id is corrupt, without its picture", async () => {
    const seeded = new LocalPrizeStore(
      memoryStorage({
        [prizeStorageKey(LOCAL_OWNER)]: JSON.stringify({
          goal: 30,
          prizes: [
            {
              id: "p-1",
              state: "ready",
              awardedAt: "x",
              costStars: 30,
              content: { kind: "custom", text: "un helado", imageId: "   " }
            }
          ]
        })
      }),
      LOCAL_OWNER,
      countingMinter()
    );
    const read = await seeded.read();
    expect(read.prizes).toHaveLength(1);
    expect(read.prizes[0]).toMatchObject({
      content: { kind: "custom", text: "un helado", imageId: null }
    });
  });

  it("falls back to a goal it can trust when the stored one is nonsense", async () => {
    const seeded = new LocalPrizeStore(
      memoryStorage({
        [prizeStorageKey(LOCAL_OWNER)]: JSON.stringify({ goal: -4, prizes: [] })
      }),
      LOCAL_OWNER,
      countingMinter()
    );
    await expect(seeded.read()).resolves.toMatchObject({ goal: 30 });
  });

  it("keeps playing when storage denies a write", async () => {
    const denied = new LocalPrizeStore(
      {
        getItem: () => null,
        setItem: () => {
          throw new Error("QuotaExceededError");
        }
      },
      LOCAL_OWNER,
      countingMinter()
    );
    const awarded = await denied.awardDue(30);
    expect(awarded.prizes).toHaveLength(1);
    await expect(denied.read()).resolves.toEqual(awarded);
  });
});
