#!/usr/bin/env node
/**
 * Renders the chrome sounds — the taps, chimes, and ceremony sounds the player
 * makes — from the descriptions in this file.
 *
 *   node scripts/generate-chrome-sounds.mjs
 *
 * Kept in the repository for the same reason as `import-world-art.mjs`: it *is*
 * the provenance record. Every committed `.wav` under
 * `apps/player-web/public/sfx/` is output of this script and nothing else, so
 * the set is reproducible, auditable, and — the point of synthesising rather
 * than licensing — adjustable. Disliking a sound is a constant to change and a
 * re-run, not a hunt through a sample library for a replacement that has to be
 * re-cleared, re-normalised, and re-attributed.
 *
 * Synthesis also settles the rights question by construction. `audio.md` says
 * to "licence or synthesise" these; a licensed pack means a per-file licence
 * audit in `PROVENANCE.md` and a remedy that involves finding another pack,
 * whereas nothing here is anyone's to claim.
 *
 * Deterministic: the noise is a seeded generator, so a clean checkout that runs
 * this produces the committed bytes. `check-audio-assets.mjs` depends on that.
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { repoRoot } from "./guardrails.mjs";
import {
  fileFor,
  SOUND_DIR,
  SOUNDS,
  targetFor,
  TRUE_PEAK_CEILING_DB
} from "./lib/chromeSounds.mjs";
import {
  biquad,
  encodeWav,
  loudnessLufs,
  RATE,
  truePeakDb
} from "./lib/wav.mjs";

const frames = (seconds) => Math.round(seconds * RATE);

/** Equal temperament from A4 = 440 Hz, so the intervals below are readable. */
const NOTE = {
  D5: 587.33,
  G5: 783.99,
  A4: 440,
  G4: 392,
  C6: 1046.5,
  E6: 1318.51,
  G6: 1567.98,
  C7: 2093
};

function render(duration, sample) {
  const out = new Float32Array(frames(duration));
  for (let index = 0; index < out.length; index += 1) {
    out[index] = sample(index / RATE);
  }
  return out;
}

function mix(...layers) {
  const length = Math.max(...layers.map((layer) => layer.length));
  const out = new Float32Array(length);
  for (const layer of layers) {
    for (let index = 0; index < layer.length; index += 1) {
      out[index] += layer[index];
    }
  }
  return out;
}

/** Places a layer later in the sound, lengthening it to fit. */
function at(delay, layer) {
  const offset = frames(delay);
  const out = new Float32Array(layer.length + offset);
  out.set(layer, offset);
  return out;
}

function gain(amount, layer) {
  const out = new Float32Array(layer.length);
  for (let index = 0; index < layer.length; index += 1) {
    out[index] = layer[index] * amount;
  }
  return out;
}

/**
 * A raised-cosine rise over `ms`.
 *
 * Every voice needs one. A sine that begins at full amplitude begins with a
 * step, and a step is a click — audible as a tick in front of the sound on the
 * hard, loud speakers these play through.
 */
function rise(t, ms) {
  const span = ms / 1000;
  if (t >= span) return 1;
  return 0.5 - 0.5 * Math.cos((Math.PI * t) / span);
}

/**
 * A struck-and-ringing voice: partials at `[ratio, amplitude, decayScale]`,
 * each decaying at its own rate.
 *
 * Higher partials must decay faster than lower ones or the result sounds like
 * an organ rather than something struck — that difference in decay *is* what
 * the ear reads as a physical object being hit.
 */
function struck(duration, freq, tau, partials, attackMs = 2) {
  return render(duration, (t) => {
    let value = 0;
    for (const [ratio, amplitude, decayScale] of partials) {
      value +=
        amplitude *
        Math.sin(2 * Math.PI * freq * ratio * t) *
        Math.exp(-t / (tau * decayScale));
    }
    return value * rise(t, attackMs);
  });
}

/** A soft, round tone with no bright partials — the wrong-answer voice. */
function soft(duration, freq, tau, attackMs) {
  return render(
    duration,
    (t) =>
      (Math.sin(2 * Math.PI * freq * t) +
        0.11 * Math.sin(6 * Math.PI * freq * t)) *
      Math.exp(-t / tau) *
      rise(t, attackMs)
  );
}

/**
 * Deterministic white noise (mulberry32).
 *
 * Seeded rather than `Math.random` so a re-run reproduces the committed bytes
 * exactly. Without this the guardrail could check a file's properties but never
 * that it came from this script.
 */
function noise(duration, seed) {
  let state = seed >>> 0;
  return render(duration, () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return (((value ^ (value >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  });
}

/** RBJ cookbook coefficients, for the fixed-frequency filters. */
function lowpass(freq, q) {
  const w = (2 * Math.PI * freq) / RATE;
  const alpha = Math.sin(w) / (2 * q);
  return {
    b0: (1 - Math.cos(w)) / 2,
    b1: 1 - Math.cos(w),
    b2: (1 - Math.cos(w)) / 2,
    a0: 1 + alpha,
    a1: -2 * Math.cos(w),
    a2: 1 - alpha
  };
}

function bandpass(freq, q) {
  const w = (2 * Math.PI * freq) / RATE;
  const alpha = Math.sin(w) / (2 * q);
  return {
    b0: alpha,
    b1: 0,
    b2: -alpha,
    a0: 1 + alpha,
    a1: -2 * Math.cos(w),
    a2: 1 - alpha
  };
}

/**
 * A Chamberlin state-variable bandpass whose centre frequency moves.
 *
 * A biquad cannot do this: its coefficients are computed once, and recomputing
 * them per sample makes the filter's stored state meaningless as the poles move
 * under it. The state-variable form is defined in terms of its own integrators,
 * so it stays stable while being swept — which is what turns flat noise into a
 * creak rather than a hiss.
 */
function sweptBandpass(samples, freqAt, q) {
  const out = new Float32Array(samples.length);
  let low = 0;
  let band = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const f = 2 * Math.sin((Math.PI * freqAt(index / RATE)) / RATE);
    const high = samples[index] - low - (1 / q) * band;
    band += f * high;
    low += f * band;
    out[index] = band;
  }
  return out;
}

/** Multiplies a layer by an envelope of `t`. */
function shape(layer, envelope) {
  const out = new Float32Array(layer.length);
  for (let index = 0; index < layer.length; index += 1) {
    out[index] = layer[index] * envelope(index / RATE);
  }
  return out;
}

/**
 * Cuts the sound to its stated length and fades the join.
 *
 * Exponential decay never reaches zero, so a sound that is simply truncated
 * ends on a step — the same click `rise` avoids at the start, at the end
 * instead.
 */
function seal(duration, layer) {
  const length = frames(duration);
  const out = new Float32Array(length);
  out.set(layer.subarray(0, Math.min(length, layer.length)));
  const fade = Math.min(frames(0.03), Math.floor(length / 4));
  for (let index = 0; index < fade; index += 1) {
    out[length - fade + index] *= 0.5 + 0.5 * Math.cos((Math.PI * index) / fade);
  }
  return out;
}

/** A bell's partials are inharmonic; a marimba bar's are nearly so. */
const BELL = [
  [1, 1, 1],
  [2.76, 0.42, 0.5],
  [5.4, 0.18, 0.26]
];
const BAR = [
  [1, 1, 1],
  [3.9, 0.22, 0.45]
];
const CHIME = [
  [1, 1, 1],
  [2, 0.4, 0.7],
  [3, 0.16, 0.5]
];

/**
 * Each sound, by the moment it marks. Durations are chosen against the
 * animation each one accompanies in `styles.css` — the stars land 140 ms apart,
 * so `star` must be done ringing well inside that or three stars smear into
 * one chord.
 */
const VOICES = {
  /* Under a finger: as short as it can be and still have a pitch. */
  tap: () =>
    seal(
      0.1,
      mix(
        struck(0.1, NOTE.C6, 0.03, BAR),
        gain(0.14, biquad(noise(0.006, 11), lowpass(3200, 0.7)))
      )
    ),

  /* A tap that goes somewhere, so it opens upward rather than just landing. */
  select: () =>
    seal(
      0.16,
      mix(
        struck(0.16, NOTE.C6, 0.035, BAR),
        at(0.055, struck(0.105, NOTE.G6, 0.035, BAR))
      )
    ),

  /* The same gesture reversed, which is what going back is. */
  back: () =>
    seal(
      0.14,
      mix(
        gain(0.9, struck(0.14, NOTE.G5, 0.032, BAR)),
        at(0.05, gain(0.8, struck(0.09, NOTE.D5, 0.032, BAR)))
      )
    ),

  /* A rising fifth: the shortest interval that reads unambiguously as yes. */
  correct: () =>
    seal(
      0.36,
      mix(
        struck(0.36, NOTE.C6, 0.13, CHIME),
        at(0.09, struck(0.27, NOTE.G6, 0.13, CHIME)),
        at(0.09, gain(0.22, struck(0.27, NOTE.C7, 0.09, BELL)))
      )
    ),

  /*
   * Deliberately not a buzzer, and deliberately quieter than everything else.
   * A soft, round, falling whole tone — enough to say "not that one", with no
   * transient to flinch at. At ages 3-5 a punishing failure sound teaches
   * avoidance of the game rather than of the mistake.
   */
  wrong: () =>
    seal(
      0.3,
      biquad(
        mix(
          soft(0.3, NOTE.A4, 0.1, 14),
          at(0.11, gain(0.85, soft(0.19, NOTE.G4, 0.1, 14)))
        ),
        lowpass(1400, 0.7)
      )
    ),

  /* Paper, not a whoosh: noise swept upward, with the grain left in. */
  "page-turn": () =>
    seal(
      0.28,
      mix(
        gain(
          0.75,
          shape(
            sweptBandpass(noise(0.28, 23), (t) => 820 + 1800 * t, 1.4),
            (t) => rise(t, 40) * Math.exp(-Math.max(0, t - 0.04) / 0.085)
          )
        ),
        gain(
          0.3,
          shape(
            sweptBandpass(noise(0.16, 29), (t) => 2400 - 1400 * t, 2.2),
            (t) => rise(t, 12) * Math.exp(-t / 0.05)
          )
        )
      )
    ),

  /* Bright and glassy, because a letriestrella should sound like light. */
  star: () =>
    seal(
      0.45,
      mix(
        struck(0.45, NOTE.E6, 0.17, BELL),
        gain(0.3, at(0.012, struck(0.3, NOTE.C7, 0.08, BELL)))
      )
    ),

  /* Wood set on wood. The duende is placing these, not dropping them. */
  "chest-appear": () =>
    seal(
      0.18,
      mix(
        gain(0.9, soft(0.18, 180, 0.045, 3)),
        gain(0.5, biquad(noise(0.02, 37), lowpass(1100, 0.9)))
      )
    ),

  /*
   * Three beats, which is what opening a box is: the lid dragging, the catch
   * letting go, and what is inside catching the light.
   */
  "chest-open": () =>
    seal(
      0.95,
      mix(
        gain(
          0.55,
          shape(
            sweptBandpass(noise(0.34, 41), (t) => 420 + 1600 * t, 3.5),
            (t) =>
              rise(t, 60) *
              Math.exp(-Math.max(0, t - 0.06) / 0.22) *
              (0.62 + 0.38 * Math.sin(2 * Math.PI * 13 * t))
          )
        ),
        at(
          0.3,
          gain(
            0.42,
            shape(biquad(noise(0.04, 43), bandpass(2500, 2)), (t) =>
              Math.exp(-t / 0.012)
            )
          )
        ),
        at(0.35, gain(0.75, struck(0.6, NOTE.C6, 0.2, BELL))),
        at(0.47, gain(0.7, struck(0.48, NOTE.E6, 0.2, BELL))),
        at(0.6, gain(0.65, struck(0.35, NOTE.G6, 0.2, BELL)))
      )
    ),

  /* The animal springs out at 220 ms and its name lands at 620 ms; this rises
     under the first and is still shimmering when the second arrives. */
  reveal: () =>
    seal(
      0.92,
      mix(
        struck(0.92, NOTE.C6, 0.3, BELL),
        at(0.075, struck(0.845, NOTE.E6, 0.3, BELL)),
        at(0.15, struck(0.77, NOTE.G6, 0.3, BELL)),
        at(0.235, gain(0.85, struck(0.685, NOTE.C7, 0.3, BELL))),
        gain(
          0.12,
          shape(
            sweptBandpass(noise(0.8, 53), (t) => 3000 + 2600 * t, 0.8),
            (t) => rise(t, 260) * Math.exp(-Math.max(0, t - 0.26) / 0.3)
          )
        )
      )
    ),

  /* Four notes up and a chord to sit on. One second is the whole budget. */
  fanfare: () =>
    seal(
      0.98,
      mix(
        struck(0.98, NOTE.C6, 0.16, CHIME),
        at(0.1, struck(0.88, NOTE.E6, 0.16, CHIME)),
        at(0.2, struck(0.78, NOTE.G6, 0.16, CHIME)),
        at(0.3, struck(0.68, NOTE.C7, 0.16, CHIME)),
        at(
          0.42,
          gain(
            0.8,
            mix(
              struck(0.56, NOTE.C6, 0.42, CHIME),
              gain(0.7, struck(0.56, NOTE.E6, 0.42, CHIME)),
              gain(0.6, struck(0.56, NOTE.G6, 0.42, CHIME)),
              gain(0.4, struck(0.56, NOTE.C7, 0.42, BELL))
            )
          )
        )
      )
    ),

  /* The lock gives, then the way opens: a clunk answered by a rising fifth. */
  unlock: () =>
    seal(
      0.58,
      mix(
        gain(0.85, soft(0.12, 140, 0.04, 3)),
        gain(0.45, biquad(noise(0.025, 59), lowpass(900, 0.9))),
        at(0.06, gain(0.9, struck(0.52, NOTE.G5, 0.18, CHIME))),
        at(0.16, gain(0.9, struck(0.42, 1174.66, 0.18, CHIME))),
        at(0.28, gain(0.3, struck(0.3, NOTE.C7, 0.14, BELL)))
      )
    )
};

/**
 * Brings a rendered sound to its loudness target, then holds the true-peak
 * ceiling.
 *
 * The order matters: normalising to a peak and hoping the loudness follows is
 * how a set ends up with a fanfare that disappears under a tap. Loudness is the
 * target and the ceiling is a limit applied afterwards — and if the ceiling
 * ever binds, the sound is reported as quieter than asked for rather than
 * silently clipped.
 */
function normalise(samples, target) {
  const measured = loudnessLufs(samples);
  let out = gain(Math.pow(10, (target - measured) / 20), samples);
  const peak = truePeakDb(out);
  if (peak > TRUE_PEAK_CEILING_DB) {
    out = gain(Math.pow(10, (TRUE_PEAK_CEILING_DB - peak) / 20), out);
  }
  return out;
}

const rows = [];
for (const sound of SOUNDS) {
  const voice = VOICES[sound.id];
  if (!voice) {
    throw new Error(
      `${sound.id} is listed in lib/chromeSounds.mjs with no voice here`
    );
  }
  const target = targetFor(sound);
  const samples = normalise(voice(), target);
  const bytes = encodeWav(samples);
  await writeFile(join(repoRoot, SOUND_DIR, fileFor(sound)), bytes);
  rows.push({
    file: fileFor(sound),
    ms: Math.round((samples.length / RATE) * 1000),
    kb: (bytes.length / 1024).toFixed(1),
    lufs: loudnessLufs(samples).toFixed(1),
    dbtp: truePeakDb(samples).toFixed(1),
    marks: sound.marks
  });
}

/* An unlisted voice is an orphan: nothing plays it and nothing checks it. */
for (const id of Object.keys(VOICES)) {
  if (!SOUNDS.some((sound) => sound.id === id)) {
    throw new Error(`${id} has a voice here but is not listed in lib/chromeSounds.mjs`);
  }
}

const width = (key) => Math.max(...rows.map((row) => String(row[key]).length));
const pad = (value, key) => String(value).padEnd(width(key));
console.log(`Wrote ${rows.length} sounds to ${SOUND_DIR}/`);
for (const row of rows) {
  console.log(
    `  ${pad(row.file, "file")}  ${pad(row.ms, "ms")} ms  ` +
      `${pad(row.kb, "kb")} kB  ${pad(row.lufs, "lufs")} LUFS  ` +
      `${pad(row.dbtp, "dbtp")} dBTP  ${row.marks}`
  );
}
