import { beforeEach, describe, expect, it } from "vitest";
import { avatarId, playerProfileId } from "@lectoemocion/domain";
import { LOCAL_OWNER, LocalProgressStore, storageKey } from "../world/progressStore";
import {
  LocalProfileStore,
  MAX_PROFILES,
  ProfileStoreError,
  PROFILES_KEY,
  STARTER_PROFILE_NAME
} from "./profileStore";

class FakeStorage {
  readonly items = new Map<string, string>();

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }

  removeItem(key: string): void {
    this.items.delete(key);
  }
}

let storage: FakeStorage;
let nextId: number;

function store(): LocalProfileStore {
  return new LocalProfileStore(storage, () => `generated-${(nextId += 1)}`);
}

beforeEach(() => {
  storage = new FakeStorage();
  nextId = 0;
});

describe("the first read of an empty store", () => {
  it("makes one profile so that a child can always play", async () => {
    const book = await store().read();

    expect(book.profiles).toHaveLength(1);
    expect(book.profiles[0]?.name).toBe(STARTER_PROFILE_NAME);
    expect(book.selectedId).toBe(book.profiles[0]?.id);
  });

  it("does not claim to know when that child was born", async () => {
    const book = await store().read();

    expect(book.profiles[0]?.birth).toEqual({ known: false });
  });

  /*
   * The regression that matters most. Every device that has ever run the
   * player has progress under the owner `local`; giving the starter profile
   * that same id is what makes those stars survive this change. If this ever
   * fails, a family silently loses everything they have played.
   */
  it("inherits the progress that already exists on the device", async () => {
    storage.setItem(
      storageKey(LOCAL_OWNER),
      JSON.stringify({ completedNodes: ["gallo"], lastPlayedNode: "gallo", rewards: [], stars: 27 })
    );

    const book = await store().read();
    const progress = await new LocalProgressStore(
      storage,
      book.selectedId
    ).read();

    expect(progress.stars).toBe(27);
    expect(progress.completedNodes).toEqual(["gallo"]);
  });
});

describe("adding a profile", () => {
  it("keeps the profiles already there and selects the new one", async () => {
    const subject = store();
    const before = await subject.read();

    const after = await subject.add({
      name: "Vera",
      avatarId: avatarId("panda"),
      birth: { known: true, month: 6, year: 2021 }
    });

    expect(after.profiles).toHaveLength(2);
    expect(after.profiles[0]?.id).toBe(before.profiles[0]?.id);
    expect(after.profiles[1]?.name).toBe("Vera");
    expect(after.selectedId).toBe(after.profiles[1]?.id);
  });

  it("gives the new profile a progress namespace of its own", async () => {
    const subject = store();
    await subject.read();
    await new LocalProgressStore(storage, LOCAL_OWNER).recordCompletion("gallo");

    const after = await subject.add({
      name: "Vera",
      avatarId: avatarId("panda"),
      birth: { known: false }
    });
    const fresh = await new LocalProgressStore(storage, after.selectedId).read();

    expect(fresh.stars).toBe(0);
    expect(fresh.completedNodes).toEqual([]);
  });

  it("refuses a name that is only whitespace", async () => {
    const subject = store();
    await subject.read();

    await expect(
      subject.add({ name: "   ", avatarId: avatarId("panda"), birth: { known: false } })
    ).rejects.toThrow(ProfileStoreError);
  });

  it("refuses more profiles than the drawer can show", async () => {
    const subject = store();
    await subject.read();
    for (let index = 1; index < MAX_PROFILES; index += 1) {
      await subject.add({
        name: `Niño ${index}`,
        avatarId: avatarId("panda"),
        birth: { known: false }
      });
    }

    await expect(
      subject.add({ name: "Uno más", avatarId: avatarId("panda"), birth: { known: false } })
    ).rejects.toThrow(ProfileStoreError);
  });
});

describe("editing a profile", () => {
  it("changes what an adult corrected and leaves the id alone", async () => {
    const subject = store();
    const before = await subject.read();
    const id = before.profiles[0]!.id;

    const after = await subject.update(id, {
      name: "Vera",
      avatarId: avatarId("buho"),
      birth: { known: true, month: 3, year: 2022 }
    });

    expect(after.profiles[0]).toEqual({
      id,
      name: "Vera",
      avatarId: avatarId("buho"),
      birth: { known: true, month: 3, year: 2022 }
    });
  });

  it("refuses to edit a profile that is not there", async () => {
    const subject = store();
    await subject.read();

    await expect(
      subject.update(playerProfileId("ghost"), {
        name: "Vera",
        avatarId: avatarId("buho"),
        birth: { known: false }
      })
    ).rejects.toThrow(ProfileStoreError);
  });
});

describe("deleting a profile", () => {
  it("takes that child's progress with it", async () => {
    const subject = store();
    await subject.read();
    const added = await subject.add({
      name: "Vera",
      avatarId: avatarId("panda"),
      birth: { known: false }
    });
    const veraId = added.selectedId;
    await new LocalProgressStore(storage, veraId).recordCompletion("gallo");

    await subject.remove(veraId);

    expect(storage.getItem(storageKey(veraId))).toBeNull();
  });

  it("selects someone else when the deleted profile was the selected one", async () => {
    const subject = store();
    const first = await subject.read();
    const added = await subject.add({
      name: "Vera",
      avatarId: avatarId("panda"),
      birth: { known: false }
    });

    const after = await subject.remove(added.selectedId);

    expect(after.selectedId).toBe(first.profiles[0]?.id);
  });

  /* There is always someone playing. An empty drawer has no way back. */
  it("refuses to delete the last profile", async () => {
    const subject = store();
    const book = await subject.read();

    await expect(subject.remove(book.profiles[0]!.id)).rejects.toThrow(
      ProfileStoreError
    );
  });
});

describe("switching profile", () => {
  it("remembers who was chosen", async () => {
    const subject = store();
    const first = await subject.read();
    await subject.add({
      name: "Vera",
      avatarId: avatarId("panda"),
      birth: { known: false }
    });

    const after = await subject.select(first.profiles[0]!.id);

    expect(after.selectedId).toBe(first.profiles[0]?.id);
    expect(await store().read()).toEqual(after);
  });

  it("refuses to select a profile that is not there", async () => {
    const subject = store();
    await subject.read();

    await expect(subject.select(playerProfileId("ghost"))).rejects.toThrow(
      ProfileStoreError
    );
  });
});

/*
 * Deliberately unlike the progress store, which degrades to an empty world.
 * Progress can be replayed; a profile cannot be re-derived from anything, so
 * quietly resetting would destroy the only copy of a family's profiles and
 * their progress with it. This fails closed and asks an adult.
 */
describe("a store that cannot be read", () => {
  it("raises rather than resetting a family's profiles", async () => {
    storage.setItem(PROFILES_KEY, "{ not json");

    await expect(store().read()).rejects.toThrow(ProfileStoreError);
  });

  it("raises when the saved shape is not a profile book", async () => {
    storage.setItem(PROFILES_KEY, JSON.stringify({ profiles: "everyone" }));

    await expect(store().read()).rejects.toThrow(ProfileStoreError);
  });

  it("leaves the unreadable data alone so it can be recovered", async () => {
    storage.setItem(PROFILES_KEY, "{ not json");

    await expect(store().read()).rejects.toThrow(ProfileStoreError);
    expect(storage.getItem(PROFILES_KEY)).toBe("{ not json");
  });
});
