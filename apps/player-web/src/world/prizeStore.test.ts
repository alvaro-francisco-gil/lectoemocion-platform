import { prizeId, type PrizeContent } from "@lectoemocion/domain";
import { beforeEach, describe, expect, it } from "vitest";
import { LOCAL_OWNER } from "./progressStore";
import { EMPTY_PRIZES } from "./prizes";
import {
  giftsKey,
  LOCAL_GROUP,
  LocalPrizeStore,
  prizeGoalKey,
  type Minter,
  type PrizeOwners
} from "./prizeStore";

const PATIO: PrizeContent = { kind: "preset", preset: "patio" };

/** The one implicit group, and the child the device starts with. */
const HERE: PrizeOwners = { group: LOCAL_GROUP, child: LOCAL_OWNER };

/** A second child in the same group: their own gifts, the same goal. */
const SIBLING: PrizeOwners = { group: LOCAL_GROUP, child: "vera" };

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

/** A store over a storage a test can inspect, for whoever is named. */
function storeOver(
  storage: ReturnType<typeof memoryStorage>,
  owners: PrizeOwners = HERE
) {
  return new LocalPrizeStore(storage, owners, countingMinter());
}

/** The gifts one child has, as a seeded record. */
function seededGifts(prizes: readonly unknown[]): string {
  return JSON.stringify({ prizes });
}

describe("LocalPrizeStore", () => {
  let storage: ReturnType<typeof memoryStorage>;
  let store: LocalPrizeStore;

  beforeEach(() => {
    storage = memoryStorage();
    store = storeOver(storage);
  });

  it("starts at the default goal with nothing awarded", async () => {
    await expect(store.read()).resolves.toEqual(EMPTY_PRIZES);
  });

  it("awards what is owed and keeps it under the child's own key", async () => {
    const next = await store.awardDue(30);
    expect(next.prizes).toHaveLength(1);
    expect(storage.entries.get(giftsKey(LOCAL_OWNER))).toContain("p-1");
    /* The goal is the group's: awarding a gift is not a change to it. */
    expect(storage.entries.has(prizeGoalKey(LOCAL_GROUP))).toBe(false);
  });

  it("keeps the goal under the group's key, apart from anyone's gifts", async () => {
    await store.setGoal(10);
    expect(storage.entries.get(prizeGoalKey(LOCAL_GROUP))).toBe(
      JSON.stringify({ goal: 10 })
    );
    expect(storage.entries.has(giftsKey(LOCAL_OWNER))).toBe(false);
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

  it("reads back a stored goal and a stored list", async () => {
    const seeded = storeOver(
      memoryStorage({
        [prizeGoalKey(LOCAL_GROUP)]: JSON.stringify({ goal: 12 }),
        [giftsKey(LOCAL_OWNER)]: seededGifts([
          {
            id: "p-9",
            state: "ready",
            awardedAt: "2026-08-01T10:00:00.000Z",
            costStars: 12,
            content: { kind: "preset", preset: "mesa" }
          }
        ])
      })
    );
    const read = await seeded.read();
    expect(read.goal).toBe(12);
    expect(read.prizes).toHaveLength(1);
  });

  /*
   * The whole point of the split. An adult sets one goal for the family or the
   * class; each child fills their own meter against it and owns what they earn.
   */
  describe("two children in one group", () => {
    it("shares the goal and keeps the gifts apart", async () => {
      const shared = memoryStorage();
      const mine = storeOver(shared, HERE);
      const theirs = storeOver(shared, SIBLING);

      await mine.setGoal(10);
      await mine.awardDue(10);

      const sibling = await theirs.read();
      expect(sibling.goal).toBe(10);
      expect(sibling.prizes).toEqual([]);
      await expect(mine.read()).resolves.toMatchObject({
        goal: 10,
        prizes: [{ id: prizeId("p-1") }]
      });
    });

    it("lets either child change the goal for both", async () => {
      const shared = memoryStorage();
      await storeOver(shared, SIBLING).setGoal(15);
      await expect(storeOver(shared, HERE).read()).resolves.toMatchObject({
        goal: 15
      });
    });
  });

  /*
   * What a device that played before the split has on it: one record holding
   * both halves, keyed by nobody in particular. It belonged to the device
   * rather than to a child, and nothing can say which child earned what — so it
   * is read by nothing and written by nothing. A gift an adult already promised
   * is one they can still hand over; a gift resurfacing under the wrong child's
   * name is not recoverable at all.
   */
  it("neither adopts nor destroys a record from before the split", async () => {
    const before = JSON.stringify({
      goal: 12,
      prizes: [
        {
          id: "p-old",
          state: "ready",
          awardedAt: "2026-07-01T10:00:00.000Z",
          costStars: 12,
          content: { kind: "preset", preset: "mesa" }
        }
      ]
    });
    const seeded = memoryStorage({ "lectoemocion.prizes.local": before });

    await expect(storeOver(seeded).read()).resolves.toEqual(EMPTY_PRIZES);
    expect(seeded.entries.get("lectoemocion.prizes.local")).toBe(before);
  });

  it("drops a corrupt prize rather than the whole list", async () => {
    const seeded = storeOver(
      memoryStorage({
        [giftsKey(LOCAL_OWNER)]: seededGifts([
          { id: "p-1", state: "unconfigured", awardedAt: "x", costStars: 30 },
          { id: "p-2", state: "ready", awardedAt: "x", costStars: 30 },
          { id: "p-3", state: "ready", awardedAt: "x", costStars: 30,
            content: { kind: "preset", preset: "garaje" } },
          { id: "p-4", state: "ready", awardedAt: "x", costStars: 30,
            content: { kind: "custom", text: "un helado", imageId: null } }
        ])
      })
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
    const seeded = storeOver(
      memoryStorage({
        [giftsKey(LOCAL_OWNER)]: seededGifts([
          { id: "", state: "unconfigured", awardedAt: "x", costStars: 30 },
          { id: " p-2 ", state: "unconfigured", awardedAt: "x", costStars: 30 },
          { id: "p-3", state: "unconfigured", awardedAt: "x", costStars: 30 }
        ])
      })
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
    const seeded = storeOver(
      memoryStorage({
        [giftsKey(LOCAL_OWNER)]: seededGifts([
          {
            id: "p-1",
            state: "ready",
            awardedAt: "x",
            costStars: 30,
            content: { kind: "custom", text: "un helado", imageId: "   " }
          }
        ])
      })
    );
    const read = await seeded.read();
    expect(read.prizes).toHaveLength(1);
    expect(read.prizes[0]).toMatchObject({
      content: { kind: "custom", text: "un helado", imageId: null }
    });
  });

  it("falls back to a goal it can trust when the stored one is nonsense", async () => {
    const seeded = storeOver(
      memoryStorage({
        [prizeGoalKey(LOCAL_GROUP)]: JSON.stringify({ goal: -4 })
      })
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
      HERE,
      countingMinter()
    );
    const awarded = await denied.awardDue(30);
    expect(awarded.prizes).toHaveLength(1);
    await expect(denied.read()).resolves.toEqual(awarded);

    /* And the goal a denied store was told stays true for the session too. */
    await expect(denied.setGoal(10)).resolves.toMatchObject({
      goal: 10,
      prizes: awarded.prizes
    });
  });
});
