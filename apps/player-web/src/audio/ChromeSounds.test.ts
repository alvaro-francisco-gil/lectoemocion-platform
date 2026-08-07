import { afterEach, describe, expect, it, vi } from "vitest";
import { ChromeSounds, MUTE_STORAGE_KEY } from "./ChromeSounds";
import { SOUND_IDS } from "./sounds";

/**
 * A recording stand-in for the Web Audio graph.
 *
 * The interesting behaviour is *whether* a sound is started, and how many times
 * — a real `AudioContext` would give the same answers plus a device.
 */
function fakeContext(state: AudioContextState = "suspended") {
  const started: (AudioBuffer | null)[] = [];
  const context = {
    state,
    resume: vi.fn(async () => {
      context.state = "running";
    }),
    close: vi.fn(async () => undefined),
    destination: {},
    decodeAudioData: vi.fn(
      async (bytes: ArrayBuffer) =>
        ({ duration: bytes.byteLength }) as unknown as AudioBuffer
    ),
    createBufferSource: () => ({
      buffer: null as AudioBuffer | null,
      connect: vi.fn(),
      start: vi.fn(function (this: { buffer: AudioBuffer | null }) {
        started.push(this.buffer);
      })
    })
  };
  return { started, context: context as unknown as AudioContext };
}

/** Every sound resolves, so `load` fills its map. */
function serveSounds() {
  const fetched: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      fetched.push(url);
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
    })
  );
  return fetched;
}

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value)
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ChromeSounds", () => {
  it("fetches every declared sound", async () => {
    const fetched = serveSounds();
    await new ChromeSounds(memoryStorage(), () => fakeContext().context).load();

    expect(fetched).toHaveLength(SOUND_IDS.length);
    expect(fetched).toContain("/sfx/star.wav");
  });

  it("is silent before the unlocking gesture", async () => {
    serveSounds();
    const { started, context } = fakeContext();
    const sounds = new ChromeSounds(memoryStorage(), () => context);
    await sounds.load();

    /* No gesture yet, so there is no context to play through. */
    sounds.play("tap");

    expect(started).toHaveLength(0);
  });

  it("resumes the context on unlock and plays after it", async () => {
    serveSounds();
    const { started, context } = fakeContext();
    const sounds = new ChromeSounds(memoryStorage(), () => context);
    await sounds.unlock();
    sounds.play("tap");

    expect(context.resume).toHaveBeenCalled();
    expect(started).toHaveLength(1);
  });

  /* Three letriestrellas land 140 ms apart and must ring together. */
  it("overlaps repeats of the same sound", async () => {
    serveSounds();
    const { started, context } = fakeContext();
    const sounds = new ChromeSounds(memoryStorage(), () => context);
    await sounds.unlock();
    sounds.play("star");
    sounds.play("star");
    sounds.play("star");

    expect(started).toHaveLength(3);
  });

  it("unlocks once however many gestures arrive", async () => {
    serveSounds();
    const { context } = fakeContext();
    const create = vi.fn(() => context);
    const sounds = new ChromeSounds(memoryStorage(), create);
    await Promise.all([sounds.unlock(), sounds.unlock()]);
    await sounds.unlock();

    expect(create).toHaveBeenCalledTimes(1);
  });

  it("plays nothing while muted", async () => {
    serveSounds();
    const { started, context } = fakeContext();
    const sounds = new ChromeSounds(memoryStorage(), () => context);
    await sounds.unlock();
    sounds.setMuted(true);
    sounds.play("fanfare");

    expect(started).toHaveLength(0);
  });

  it("remembers the mute switch across sessions", () => {
    const storage = memoryStorage();
    new ChromeSounds(storage, null).setMuted(true);

    expect(storage.getItem(MUTE_STORAGE_KEY)).toBe("true");
    expect(new ChromeSounds(storage, null).muted).toBe(true);
  });

  it("reads an unrecognised stored value as unmuted", () => {
    const storage = memoryStorage({ [MUTE_STORAGE_KEY]: "yes-please" });

    expect(new ChromeSounds(storage, null).muted).toBe(false);
  });

  /*
   * The fail-open case, and the reason it is one: chrome sounds are decoration,
   * so a browser without Web Audio plays the world silently rather than
   * refusing to open it.
   */
  it("stays inert and silent where Web Audio does not exist", async () => {
    serveSounds();
    const sounds = new ChromeSounds(memoryStorage(), null);
    await sounds.unlock();

    expect(() => sounds.play("correct")).not.toThrow();
  });

  it("survives a sound that fails to download", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.endsWith("star.wav")
          ? { ok: false, arrayBuffer: async () => new ArrayBuffer(0) }
          : { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }
      )
    );
    const { started, context } = fakeContext();
    const sounds = new ChromeSounds(memoryStorage(), () => context);
    await sounds.unlock();

    sounds.play("star");
    sounds.play("tap");

    expect(started).toHaveLength(1);
  });
});
