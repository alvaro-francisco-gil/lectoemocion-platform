import {
  playerProfileId,
  avatarId as toAvatarId,
  type AvatarId,
  type Birth,
  type Month,
  type PlayerProfile,
  type PlayerProfileId
} from "@lectoemocion/domain";
import { LOCAL_OWNER, storageKey } from "../world/progressStore";
import { DEFAULT_AVATAR_ID } from "./avatarCatalogue";

/** What an adult fills in; the id is the store's to give. */
export interface ProfileDraft {
  readonly name: string;
  readonly avatarId: AvatarId;
  readonly birth: Birth;
}

/** Everyone who plays on this device, and who is playing now. */
export interface ProfileBook {
  readonly profiles: readonly PlayerProfile[];
  readonly selectedId: PlayerProfileId;
}

/**
 * Where profiles live.
 *
 * Async for the same reason as `ProgressStore`: stage 4 puts Firestore behind
 * this interface without changing a caller.
 */
export interface ProfileStore {
  read(): Promise<ProfileBook>;
  add(draft: ProfileDraft): Promise<ProfileBook>;
  update(id: PlayerProfileId, draft: ProfileDraft): Promise<ProfileBook>;
  remove(id: PlayerProfileId): Promise<ProfileBook>;
  select(id: PlayerProfileId): Promise<ProfileBook>;
}

export const PROFILES_KEY = "lectoemocion.profiles";

/**
 * What the one profile every device starts with is called.
 *
 * Deliberately not a real name. Nobody was there to ask when it was created,
 * and inventing a child's name would be worse than admitting we do not know
 * one.
 */
export const STARTER_PROFILE_NAME = "Peque";

/**
 * As many children as the drawer can show without scrolling on a phone.
 *
 * A cap rather than a scroller because a family tablet with forty profiles on
 * it is a data-entry accident, not a use case.
 */
export const MAX_PROFILES = 8;

/**
 * A profile operation that cannot be carried out.
 *
 * Its own class so the shell can tell it from a programming error and show an
 * adult something recoverable, per invariant 6.
 */
export class ProfileStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProfileStoreError";
  }
}

type ProfileStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function isMonth(value: unknown): value is Month {
  return (
    typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 12
  );
}

function parseBirth(value: unknown): Birth {
  if (typeof value !== "object" || value === null) {
    throw new ProfileStoreError("A saved profile has no birth information.");
  }
  const candidate = value as Record<string, unknown>;
  if (candidate["known"] !== true) return { known: false };

  const month = candidate["month"];
  const year = candidate["year"];
  if (!isMonth(month) || typeof year !== "number" || !Number.isInteger(year)) {
    throw new ProfileStoreError("A saved profile has an unreadable birth date.");
  }
  return { known: true, month, year };
}

function parseProfile(value: unknown): PlayerProfile {
  if (typeof value !== "object" || value === null) {
    throw new ProfileStoreError("A saved profile is not a profile.");
  }
  const candidate = value as Record<string, unknown>;
  const id = candidate["id"];
  const name = candidate["name"];
  const avatar = candidate["avatarId"];

  if (
    typeof id !== "string" ||
    typeof name !== "string" ||
    typeof avatar !== "string"
  ) {
    throw new ProfileStoreError("A saved profile is missing its name or picture.");
  }

  return {
    id: playerProfileId(id),
    name,
    avatarId: toAvatarId(avatar),
    birth: parseBirth(candidate["birth"])
  };
}

/**
 * Reads the book back, or refuses.
 *
 * Unlike the progress store beside it, nothing here degrades. Progress can be
 * played again; a profile cannot be re-derived from anything on the device, so
 * treating unreadable data as "no profiles" would delete a family's children
 * and every star attached to them without anyone being asked. The honest
 * response is to stop and surface it.
 */
function parseBook(raw: string): ProfileBook {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new ProfileStoreError("The saved profiles could not be read.");
  }

  if (typeof value !== "object" || value === null) {
    throw new ProfileStoreError("The saved profiles could not be read.");
  }
  const candidate = value as Record<string, unknown>;

  const profiles = candidate["profiles"];
  const selectedId = candidate["selectedId"];
  if (!Array.isArray(profiles) || profiles.length === 0) {
    throw new ProfileStoreError("The saved profiles could not be read.");
  }
  if (typeof selectedId !== "string") {
    throw new ProfileStoreError("The saved profiles name nobody as playing.");
  }

  const parsed = profiles.map(parseProfile);

  /*
   * A profile's id is its progress namespace — `storageKey(id)` — so two
   * profiles sharing one are two children sharing a set of stars. The failure
   * is completely silent: no error, no missing data, just a sibling's world
   * quietly becoming yours. It is refused here rather than deduplicated,
   * because there is no way to tell which child the progress belonged to.
   */
  const ids = new Set(parsed.map((profile) => profile.id));
  if (ids.size !== parsed.length) {
    throw new ProfileStoreError(
      "Two saved profiles share an identifier, so their progress cannot be told apart."
    );
  }

  const selected = playerProfileId(selectedId);
  if (!parsed.some((profile) => profile.id === selected)) {
    throw new ProfileStoreError("The saved profiles name nobody as playing.");
  }

  return { profiles: parsed, selectedId: selected };
}

/**
 * The profile every device already has, whether it knows it or not.
 *
 * Its id is `LOCAL_OWNER` — the exact string the progress store has always
 * namespaced by — so the progress sitting on the device becomes this profile's
 * progress by construction. There is no migration step, and therefore no
 * migration step that can go wrong halfway.
 */
function starterBook(): ProfileBook {
  const id = playerProfileId(LOCAL_OWNER);
  return {
    profiles: [
      {
        id,
        name: STARTER_PROFILE_NAME,
        avatarId: DEFAULT_AVATAR_ID,
        birth: { known: false }
      }
    ],
    selectedId: id
  };
}

function requireName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new ProfileStoreError("A child needs a name.");
  }
  return trimmed;
}

export class LocalProfileStore implements ProfileStore {
  constructor(
    private readonly storage: ProfileStorage,
    private readonly newId: () => string
  ) {}

  async read(): Promise<ProfileBook> {
    const raw = this.storage.getItem(PROFILES_KEY);
    if (raw === null) return this.write(starterBook());
    return parseBook(raw);
  }

  async add(draft: ProfileDraft): Promise<ProfileBook> {
    const book = await this.read();
    if (book.profiles.length >= MAX_PROFILES) {
      throw new ProfileStoreError(
        `This device already has ${MAX_PROFILES} profiles.`
      );
    }

    const id = playerProfileId(this.newId());
    /*
     * The generator is `crypto.randomUUID` in the app, so this cannot happen —
     * which is exactly why it is checked. An id generator that ever repeats
     * itself must fail loudly here rather than hand the new child the previous
     * one's stars.
     */
    if (book.profiles.some((profile) => profile.id === id)) {
      throw new ProfileStoreError("That identifier is already on this device.");
    }

    const profile: PlayerProfile = {
      id,
      name: requireName(draft.name),
      avatarId: draft.avatarId,
      birth: draft.birth
    };

    return this.write({
      profiles: [...book.profiles, profile],
      selectedId: profile.id
    });
  }

  async update(id: PlayerProfileId, draft: ProfileDraft): Promise<ProfileBook> {
    const book = await this.read();
    this.requirePresent(book, id);

    return this.write({
      ...book,
      profiles: book.profiles.map((profile) =>
        profile.id === id
          ? {
              id,
              name: requireName(draft.name),
              avatarId: draft.avatarId,
              birth: draft.birth
            }
          : profile
      )
    });
  }

  /**
   * Removes a child, and the progress that was theirs.
   *
   * Deleting the profile while leaving `lectoemocion.progress.<id>` behind
   * would leave a dead child's stars on the device forever, which is both a
   * leak and a retention problem the privacy baseline does not allow.
   */
  async remove(id: PlayerProfileId): Promise<ProfileBook> {
    const book = await this.read();
    this.requirePresent(book, id);
    if (book.profiles.length === 1) {
      throw new ProfileStoreError("Somebody has to be playing.");
    }

    const profiles = book.profiles.filter((profile) => profile.id !== id);
    const remaining = profiles[0];
    if (remaining === undefined) {
      throw new ProfileStoreError("Somebody has to be playing.");
    }

    const next = this.write({
      profiles,
      selectedId: book.selectedId === id ? remaining.id : book.selectedId
    });

    try {
      this.storage.removeItem(storageKey(id));
    } catch {
      /* An unwritable store must not leave the profile half-deleted; the
         profile itself is already gone, which is what an adult asked for. */
    }
    return next;
  }

  async select(id: PlayerProfileId): Promise<ProfileBook> {
    const book = await this.read();
    this.requirePresent(book, id);
    return this.write({ ...book, selectedId: id });
  }

  private requirePresent(book: ProfileBook, id: PlayerProfileId): void {
    if (!book.profiles.some((profile) => profile.id === id)) {
      throw new ProfileStoreError("That profile is no longer on this device.");
    }
  }

  private write(book: ProfileBook): ProfileBook {
    this.storage.setItem(PROFILES_KEY, JSON.stringify(book));
    return book;
  }
}
