import { SOUND_IDS, soundUrl, type SoundId } from "./sounds";

/**
 * Plays the player's chrome sounds.
 *
 * Web Audio rather than `<audio>` elements for two reasons that both show up in
 * this product. An `HTMLAudioElement` can only be playing once, so three
 * letriestrellas landing 140 ms apart would cut each other off instead of
 * ringing together; and its playback latency is variable in exactly the aged
 * WebViews the classroom panels run. An `AudioBufferSourceNode` is single-use
 * and overlaps by construction.
 *
 * **Sound is decoration, and its absence is not a fail-closed case.** Invariant
 * 6 governs content — a missing recording, a missing picture. These are not
 * content, as `sounds.ts` explains, so a browser with no Web Audio plays the
 * world silently rather than refusing to open it. A *missing file* is a
 * different fault and is caught before it ships, by
 * `scripts/check-audio-assets.mjs`, which is where that belongs.
 */

type MinimalStorage = Pick<Storage, "getItem" | "setItem">;

export const MUTE_STORAGE_KEY = "lectoemocion.muted";

/** Injectable so a test can drive this without a real audio device. */
export type AudioContextFactory = () => AudioContext;

function browserAudioContext(): AudioContextFactory | null {
  return typeof AudioContext === "undefined" ? null : () => new AudioContext();
}

export class ChromeSounds {
  private readonly encoded = new Map<SoundId, ArrayBuffer>();
  private readonly decoded = new Map<SoundId, AudioBuffer>();
  private context: AudioContext | null = null;
  private fetching: Promise<void> | null = null;
  private unlocking: Promise<void> | null = null;
  private silent: boolean;

  constructor(
    private readonly storage: MinimalStorage | null,
    private readonly createContext: AudioContextFactory | null = browserAudioContext()
  ) {
    this.silent = readMuted(storage);
  }

  get muted(): boolean {
    return this.silent;
  }

  /**
   * Fetches every sound's bytes.
   *
   * Deliberately separate from decoding. Fetching needs no `AudioContext`, so
   * it can start with the shell, while decoding cannot happen until a gesture
   * has produced one. Splitting the two is what lets the very first tap be
   * audible instead of being the one that arrives before the download does.
   */
  load(): Promise<void> {
    this.fetching ??= Promise.all(
      SOUND_IDS.map(async (id) => {
        try {
          const response = await fetch(soundUrl(id));
          if (!response.ok) return;
          this.encoded.set(id, await response.arrayBuffer());
        } catch {
          /*
           * Offline, or a panel behind a proxy that mangles the request. The
           * world still plays; this sound simply never becomes audible.
           */
        }
      })
    ).then(() => undefined);
    return this.fetching;
  }

  /**
   * Creates the audio context and decodes what `load` fetched.
   *
   * **Must be called from inside a real user gesture.** Every browser blocks
   * autoplay until one, and the aged panel WebViews this has to survive are
   * stricter than the specification: some will only hand over a running context
   * if it is *constructed* during the gesture, not merely resumed during it.
   * Hence the context is created here rather than in the constructor.
   *
   * Idempotent, because the gesture that unlocks is also a gesture that plays.
   */
  unlock(): Promise<void> {
    this.unlocking ??= this.open();
    return this.unlocking;
  }

  private async open(): Promise<void> {
    if (!this.createContext) return;

    let context: AudioContext;
    try {
      context = this.createContext();
    } catch {
      return;
    }
    this.context = context;

    /* Suspended is the normal starting state; resuming is the actual unlock. */
    if (context.state === "suspended") {
      try {
        await context.resume();
      } catch {
        /* Refused. Playback below is then a no-op rather than an error. */
      }
    }

    await this.load();
    await Promise.all(
      [...this.encoded].map(async ([id, bytes]) => {
        try {
          /*
           * `decodeAudioData` detaches the buffer it is given, so a retry — a
           * second unlock after a context was lost — would be handed an empty
           * one. It decodes a copy for that reason.
           */
          this.decoded.set(id, await context.decodeAudioData(bytes.slice(0)));
        } catch {
          /* An undecodable sound is silent; it must not take the others down. */
        }
      })
    );
  }

  /**
   * Plays a sound now, or does nothing.
   *
   * Never awaits and never throws: this is called from the middle of a tap
   * handler and from Phaser tween callbacks, and a rejected promise there would
   * surface as an unhandled rejection in the middle of a child's turn.
   */
  play(id: SoundId): void {
    if (this.silent) return;
    const context = this.context;
    const buffer = this.decoded.get(id);
    if (!context || !buffer || context.state !== "running") return;

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start();
  }

  /**
   * The adult's one control.
   *
   * One switch for everything, not a mixer: `audio.md` settles that there is no
   * per-sound volume surface, because the person reaching for this is a teacher
   * with a class in front of them.
   */
  setMuted(muted: boolean): void {
    this.silent = muted;
    try {
      this.storage?.setItem(MUTE_STORAGE_KEY, muted ? "true" : "false");
    } catch {
      /* A locked-down panel browser can deny storage; the session still obeys. */
    }
  }

  dispose(): void {
    void this.context?.close().catch(() => undefined);
    this.context = null;
    this.decoded.clear();
    this.unlocking = null;
  }
}

/**
 * Anything unrecognised reads as unmuted.
 *
 * The same stance as `parseProgress`: stored client state is untrusted input,
 * and the recoverable answer to a corrupt value is the product's default rather
 * than a world that is inexplicably silent.
 */
function readMuted(storage: MinimalStorage | null): boolean {
  try {
    return storage?.getItem(MUTE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * The player's one instance, mirroring how `App.tsx` holds one progress store.
 *
 * A single instance is not a convenience here: the React shell and the Phaser
 * scenes both make sounds, and two instances would mean two audio contexts, two
 * copies of every buffer, and a mute switch that only silenced half the app.
 */
export const chromeSounds = new ChromeSounds(
  typeof localStorage === "undefined" ? null : localStorage
);
