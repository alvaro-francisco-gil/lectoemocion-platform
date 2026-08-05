import { describe, expect, it } from "vitest";
import { type ParticipantSlot, resolveSlot } from "./participantSlot";

const defaultCharacter = {
  displayName: "Nube",
  verifiedInitial: "N",
  photoUrl: "/synthetic/character-nube.svg",
  pronunciationUrl: "/synthetic/silent-nube.mp3"
};

const slot: ParticipantSlot = {
  slotId: "protagonist",
  default: defaultCharacter
};

describe("participant slots", () => {
  it("resolves to the default when nothing is personalised", () => {
    expect(resolveSlot(slot)).toEqual(defaultCharacter);
  });

  it("resolves to the personalised character when one is present", () => {
    const personalised: ParticipantSlot = {
      slotId: "protagonist",
      default: defaultCharacter,
      personalised: {
        childRecordId: "child-1",
        displayName: "Luna",
        verifiedInitial: "L",
        photoUrl: "/synthetic/luna.svg",
        pronunciationUrl: "/synthetic/silent-luna.mp3"
      }
    };

    expect(resolveSlot(personalised).displayName).toBe("Luna");
  });

  /**
   * Invariant 6's one declared exception. The guarantee is in the signature:
   * `resolveSlot` returns `Character`, not `Character | undefined`, so no
   * caller can forget the fallback — there is no code path that yields
   * nothing.
   */
  it("never yields nothing, whatever the slot holds", () => {
    const resolved = resolveSlot(slot);
    expect(resolved.displayName.length).toBeGreaterThan(0);
    expect(resolved.photoUrl.length).toBeGreaterThan(0);
  });

  it("strips a personalised character back to its default", () => {
    const personalised: ParticipantSlot = {
      slotId: "protagonist",
      default: defaultCharacter,
      personalised: {
        childRecordId: "child-1",
        displayName: "Luna",
        verifiedInitial: "L",
        photoUrl: "/synthetic/luna.svg",
        pronunciationUrl: "/synthetic/silent-luna.mp3"
      }
    };

    const { personalised: _removed, ...stripped } = personalised;
    expect(resolveSlot(stripped)).toEqual(defaultCharacter);
  });

  it("makes a slot without a default uncompilable", () => {
    // @ts-expect-error a slot has no representation without its default
    const invalid: ParticipantSlot = { slotId: "protagonist" };
    expect(invalid).toBeDefined();
  });
});
