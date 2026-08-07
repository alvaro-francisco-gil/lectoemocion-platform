/**
 * WAV encoding, decoding, and loudness measurement, in Node built-ins only.
 *
 * Shared by `generate-chrome-sounds.mjs`, which writes the chrome sounds, and
 * `check-audio-assets.mjs`, which verifies them. One implementation, so the
 * guardrail measures what the generator targeted rather than approximating it.
 *
 * This exists in pure JavaScript on purpose. `docs/plans/ideas/audio.md` left
 * open whether the audio guardrail must shell out to `ffprobe`; for chrome
 * sounds the answer is no. They are uncompressed PCM, so codec, rate, channel
 * count, duration, loudness, and true peak are all readable from the bytes.
 * `pnpm check` therefore gains no dependency on a system binary, and the
 * guardrail trusts nothing the importer wrote down.
 */

/** The chrome sound spec: PCM s16, mono, 44.1 kHz (`docs/plans/ideas/audio.md`). */
export const RATE = 44100;

const RIFF = 0x46464952;
const WAVE = 0x45564157;
const FMT = 0x20746d66;
const DATA = 0x61746164;
const PCM = 1;

/** Encodes mono float samples in [-1, 1] as a 16-bit PCM WAV. */
export function encodeWav(samples, rate = RATE) {
  const header = 44;
  const buffer = Buffer.alloc(header + samples.length * 2);
  buffer.writeUInt32LE(RIFF, 0);
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.writeUInt32LE(WAVE, 8);
  buffer.writeUInt32LE(FMT, 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(PCM, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.writeUInt32LE(DATA, 36);
  buffer.writeUInt32LE(samples.length * 2, 40);

  for (let index = 0; index < samples.length; index += 1) {
    /*
     * Rounded, not dithered. Dither would put a permanent -96 dBFS noise floor
     * under sounds that are otherwise digitally silent between plays, and a
     * classroom panel's speakers are near a child's head. Quantisation
     * distortion on synthesised material at this level is inaudible.
     */
    const clamped = Math.max(-1, Math.min(1, samples[index]));
    buffer.writeInt16LE(Math.round(clamped * 32767), header + index * 2);
  }
  return buffer;
}

/**
 * Reads a mono 16-bit PCM WAV.
 *
 * Chunks are walked rather than assumed at fixed offsets: a writer is free to
 * put `LIST` or `fact` before `data`, and a reader that assumes byte 44 is
 * where audio starts silently plays metadata as noise. Anything that is not
 * the format this repository commits is an explicit throw, because a chrome
 * sound in an unexpected format is exactly the defect the guardrail exists to
 * catch.
 */
export function decodeWav(buffer) {
  if (buffer.length < 12) throw new Error("not a RIFF file: too short");
  if (buffer.readUInt32LE(0) !== RIFF || buffer.readUInt32LE(8) !== WAVE) {
    throw new Error("not a RIFF/WAVE file");
  }

  let format = null;
  let samples = null;
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const id = buffer.readUInt32LE(offset);
    const size = buffer.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === FMT) {
      format = {
        codec: buffer.readUInt16LE(body),
        channels: buffer.readUInt16LE(body + 2),
        rate: buffer.readUInt32LE(body + 4),
        bitsPerSample: buffer.readUInt16LE(body + 14)
      };
    } else if (id === DATA) {
      samples = buffer.subarray(body, Math.min(body + size, buffer.length));
    }
    /* Chunks are word-aligned; an odd size is followed by a pad byte. */
    offset = body + size + (size % 2);
  }

  if (!format) throw new Error("no fmt chunk");
  if (!samples) throw new Error("no data chunk");
  if (format.codec !== PCM) throw new Error(`codec ${format.codec} is not PCM`);
  if (format.bitsPerSample !== 16) {
    throw new Error(`${format.bitsPerSample}-bit is not 16-bit`);
  }

  const count = Math.floor(samples.length / 2);
  const decoded = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    decoded[index] = samples.readInt16LE(index * 2) / 32768;
  }
  return { ...format, samples: decoded };
}

/**
 * A direct-form-I biquad, normalised by `a0`.
 *
 * Exported because the synthesiser shapes noise with the same filter the
 * loudness meter weights with, and two implementations of a biquad in one
 * repository is two places for a coefficient to be wrong.
 */
export function biquad(samples, { b0, b1, b2, a0, a1, a2 }) {
  const out = new Float32Array(samples.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const x0 = samples[index];
    const y0 =
      (b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
    out[index] = y0;
  }
  return out;
}

/**
 * ITU-R BS.1770-4 K-weighting: a head-related high shelf, then a 38 Hz
 * high-pass.
 *
 * The published coefficient tables are for 48 kHz only, so these are derived
 * from the standard's analog prototype through the RBJ cookbook at whatever
 * rate the file actually uses. Hard-coding the 48 kHz table and applying it to
 * 44.1 kHz material would mis-weight every measurement by a fixed amount that
 * looks exactly like a correct reading.
 */
function kWeight(samples, rate) {
  const shelfF = 1681.974450955533;
  const shelfGain = 3.999843853973347;
  const shelfQ = 0.7071752369554196;
  const highF = 38.13547087602444;
  const highQ = 0.5003270373238773;

  const A = Math.pow(10, shelfGain / 40);
  const w = (2 * Math.PI * shelfF) / rate;
  const cosw = Math.cos(w);
  const alpha = Math.sin(w) / (2 * shelfQ);
  const rootA = Math.sqrt(A);
  const shelf = {
    b0: A * (A + 1 + (A - 1) * cosw + 2 * rootA * alpha),
    b1: -2 * A * (A - 1 + (A + 1) * cosw),
    b2: A * (A + 1 + (A - 1) * cosw - 2 * rootA * alpha),
    a0: A + 1 - (A - 1) * cosw + 2 * rootA * alpha,
    a1: 2 * (A - 1 - (A + 1) * cosw),
    a2: A + 1 - (A - 1) * cosw - 2 * rootA * alpha
  };

  const wh = (2 * Math.PI * highF) / rate;
  const coswh = Math.cos(wh);
  const alphah = Math.sin(wh) / (2 * highQ);
  const high = {
    b0: (1 + coswh) / 2,
    b1: -(1 + coswh),
    b2: (1 + coswh) / 2,
    a0: 1 + alphah,
    a1: -2 * coswh,
    a2: 1 - alphah
  };

  return biquad(biquad(samples, shelf), high);
}

/** The 400 ms window BS.1770 measures loudness over, and its 75% overlap hop. */
const BLOCK_SECONDS = 0.4;
const HOP_SECONDS = 0.1;

/**
 * Loudness in LUFS: the loudest 400 ms of the sound, or the whole sound when it
 * is shorter than that.
 *
 * **Not** the gated integrated loudness `docs/plans/ideas/audio.md` specifies.
 * That is the right measure for narration and undefined for most of these
 * files: BS.1770's integrated measure needs at least one complete 400 ms block,
 * and a 100 ms tap has none.
 *
 * The obvious repair — zero-pad the tap to 400 ms and measure that — is wrong,
 * and wrong in a way that only shows up once you try it. Three-quarters of the
 * window would be silence, so reaching −16 LUFS would demand roughly 6 dB more
 * amplitude than a sound that fills the window. The tap runs into the true-peak
 * ceiling first and lands 3 LU under target, quieter than everything else,
 * which is the exact defect a loudness target exists to prevent.
 *
 * So the window shrinks to the signal when the signal is short. Both readings
 * mean the same thing — how loud this is while it is sounding — and the
 * ear integrates over roughly this long anyway, so a tap and a fanfare
 * normalised to the same figure genuinely sit together.
 */
export function loudnessLufs(samples, rate = RATE) {
  const blockLength = Math.min(
    Math.round(BLOCK_SECONDS * rate),
    samples.length
  );
  const hop = Math.round(HOP_SECONDS * rate);
  if (blockLength === 0) return -Infinity;

  const weighted = kWeight(samples, rate);
  let loudest = -Infinity;
  for (let start = 0; start + blockLength <= weighted.length; start += hop) {
    let sum = 0;
    for (let index = start; index < start + blockLength; index += 1) {
      sum += weighted[index] * weighted[index];
    }
    const meanSquare = sum / blockLength;
    if (meanSquare <= 0) continue;
    loudest = Math.max(loudest, -0.691 + 10 * Math.log10(meanSquare));
  }
  return loudest;
}

/** Half-length of the interpolation kernel, in output samples per phase. */
const KERNEL = 32;
const OVERSAMPLE = 4;

/**
 * True peak, in dBTP, by 4× windowed-sinc oversampling.
 *
 * Sample peak is not the same measurement and is not a safe substitute: a
 * waveform can pass under 0 dBFS at every sample and still reconstruct above it
 * between them, which clips in the listener's converter rather than in the
 * file. Linear interpolation would understate that overshoot, so this
 * reconstructs with a Blackman-windowed sinc, which is what the 4× stage of a
 * BS.1770-4 true-peak meter does.
 */
export function truePeakDb(samples) {
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));

  for (let phase = 1; phase < OVERSAMPLE; phase += 1) {
    const shift = phase / OVERSAMPLE;
    /* One kernel per phase, built once and reused across every sample. */
    const kernel = new Float64Array(KERNEL * 2);
    for (let tap = 0; tap < KERNEL * 2; tap += 1) {
      const x = tap - KERNEL + 1 - shift;
      const sinc = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
      const position = tap / (KERNEL * 2 - 1);
      const window =
        0.42 -
        0.5 * Math.cos(2 * Math.PI * position) +
        0.08 * Math.cos(4 * Math.PI * position);
      kernel[tap] = sinc * window;
    }

    for (let index = 0; index < samples.length; index += 1) {
      let sum = 0;
      for (let tap = 0; tap < kernel.length; tap += 1) {
        const source = index + tap - KERNEL + 1;
        if (source < 0 || source >= samples.length) continue;
        sum += samples[source] * kernel[tap];
      }
      peak = Math.max(peak, Math.abs(sum));
    }
  }

  return peak === 0 ? -Infinity : 20 * Math.log10(peak);
}
