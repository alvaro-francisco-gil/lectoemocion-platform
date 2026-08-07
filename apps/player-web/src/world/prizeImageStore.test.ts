import { prizeImageId } from "@lectoemocion/domain";
import { describe, expect, it } from "vitest";
import { LOCAL_OWNER } from "./progressStore";
import {
  fittedSize,
  LocalPrizeImageStore,
  MAX_PRIZE_IMAGE_EDGE,
  prizeImageKey
} from "./prizeImageStore";

const ID = prizeImageId("img-1");
const DATA_URL = "data:image/jpeg;base64,AAAA";

function memoryStorage(seed: Record<string, string> = {}) {
  const entries = new Map(Object.entries(seed));
  return {
    entries,
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
    removeItem: (key: string) => {
      entries.delete(key);
    }
  };
}

describe("fittedSize", () => {
  it("leaves a picture already within the limit alone", () => {
    expect(fittedSize(400, 300, MAX_PRIZE_IMAGE_EDGE)).toEqual({
      width: 400,
      height: 300
    });
  });

  it("fits a landscape photo by its long edge", () => {
    expect(fittedSize(4000, 3000, 512)).toEqual({ width: 512, height: 384 });
  });

  it("fits a portrait photo by its long edge", () => {
    expect(fittedSize(3000, 4000, 512)).toEqual({ width: 384, height: 512 });
  });

  it("never rounds an edge away to nothing", () => {
    expect(fittedSize(2000, 1, 512).height).toBe(1);
  });
});

describe("LocalPrizeImageStore", () => {
  it("keeps each picture under a key of its own", async () => {
    const storage = memoryStorage();
    const store = new LocalPrizeImageStore(storage, LOCAL_OWNER);
    await expect(store.save(ID, DATA_URL)).resolves.toBe(true);
    expect(storage.entries.get(prizeImageKey(LOCAL_OWNER, ID))).toBe(DATA_URL);
    await expect(store.read(ID)).resolves.toBe(DATA_URL);
  });

  it("reports a refused write rather than throwing, so the words survive", async () => {
    const store = new LocalPrizeImageStore(
      {
        getItem: () => null,
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
        removeItem: () => undefined
      },
      LOCAL_OWNER
    );
    await expect(store.save(ID, DATA_URL)).resolves.toBe(false);
  });

  it("reads nothing for a picture that was never stored", async () => {
    const store = new LocalPrizeImageStore(memoryStorage(), LOCAL_OWNER);
    await expect(store.read(ID)).resolves.toBeNull();
  });

  it("removes a picture", async () => {
    const storage = memoryStorage();
    const store = new LocalPrizeImageStore(storage, LOCAL_OWNER);
    await store.save(ID, DATA_URL);
    await store.remove(ID);
    expect(storage.entries.size).toBe(0);
  });
});
