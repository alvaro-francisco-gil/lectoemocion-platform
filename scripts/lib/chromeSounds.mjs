/**
 * The chrome sound set: what exists, what it marks, and what it must measure.
 *
 * Shared by `generate-chrome-sounds.mjs`, which renders these files, and
 * `check-audio-assets.mjs`, which verifies them. The player has its own
 * registry in `apps/player-web/src/audio/sounds.ts`, because a `SoundId` union
 * has to be a TypeScript type to be worth anything at a call site; the
 * guardrail asserts the two lists name exactly the same sounds, so adding a
 * sound in one place and not the other fails `pnpm check` rather than shipping
 * a silent event or an orphaned file.
 */

/** Where the committed files live, relative to the repository root. */
export const SOUND_DIR = "apps/player-web/public/sfx";

/**
 * The chrome sound format, from `docs/plans/ideas/audio.md`: uncompressed so a
 * tap fires on the frame it was asked for, rather than after an AAC decoder has
 * worked through its priming samples.
 */
export const FORMAT = {
  codec: 1,
  channels: 1,
  rate: 44100,
  bitsPerSample: 16
};

/**
 * The loudness every sound is normalised to, and the tolerance the guardrail
 * allows around it.
 *
 * Measured over the loudest 400 ms rather than as the gated integrated loudness
 * `audio.md` specifies for narration — see `loudnessLufs` in `wav.mjs` for why
 * integrated loudness is undefined for a 100 ms sound.
 */
export const TARGET_LUFS = -16;
export const LOUDNESS_TOLERANCE = 1;

/** Ceiling for the reconstructed peak, so no converter clips on playback. */
export const TRUE_PEAK_CEILING_DB = -1;

/**
 * A chrome sound is at most one second long.
 *
 * `audio.md` also carried a ≤ 40 KB budget, which does not survive contact with
 * this set: uncompressed mono 44.1 kHz costs 86 KB per second, so 40 KB *is*
 * the duration limit restated as 450 ms, and the ceremony sounds are longer
 * than that by design. The duration is the real constraint and the size follows
 * from it, so only the duration is stated here.
 */
export const MAX_SECONDS = 1;

/**
 * How much silence a sound may begin with.
 *
 * Leading silence is the exact defect the uncompressed format was chosen to
 * avoid — it would reintroduce by hand the latency that dropping AAC removed,
 * and it is invisible in every test that only checks the file plays.
 *
 * The number is set from what it defends against, not from zero. AAC encoder
 * priming runs 40–50 ms, and an accidentally untrimmed file is far longer than
 * that; both are caught easily. Meanwhile a sound is allowed a soft onset,
 * which some of these want — `chest-open` starts with a creak that fades in
 * over 60 ms, and its first 6 ms are genuinely below the noise floor. 20 ms
 * sits under the threshold at which touch and sound stop feeling simultaneous,
 * so anything this permits is inaudible as latency.
 */
export const MAX_LEAD_IN_MS = 20;

/**
 * Every sound, in the order a child meets them.
 *
 * `quiet` marks a sound deliberately below the common target. There is exactly
 * one: a wrong answer at ages 3–5 must not be punished, and a failure sound as
 * loud as the reward teaches avoidance of the game rather than of the mistake
 * (`audio.md`, "Chrome sounds are not a recording session").
 */
export const SOUNDS = [
  { id: "tap", marks: "a card or control taken" },
  { id: "select", marks: "a world node opened" },
  { id: "back", marks: "leaving a screen" },
  { id: "correct", marks: "a right answer" },
  { id: "wrong", marks: "a wrong answer", quiet: true },
  { id: "page-turn", marks: "a story page advancing" },
  { id: "star", marks: "one letriestrella landing" },
  { id: "chest-appear", marks: "a chest set down by the duende" },
  { id: "chest-open", marks: "the chosen chest opening" },
  { id: "reveal", marks: "the animal springing out" },
  { id: "fanfare", marks: "a resource finished" },
  { id: "unlock", marks: "the duende arriving with the reward" }
];

/** How far below `TARGET_LUFS` a `quiet` sound sits. */
export const QUIET_OFFSET_LU = 3;

export const targetFor = (sound) =>
  sound.quiet ? TARGET_LUFS - QUIET_OFFSET_LU : TARGET_LUFS;

export const fileFor = (sound) => `${sound.id}.wav`;
