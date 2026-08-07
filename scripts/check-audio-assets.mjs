#!/usr/bin/env node
/**
 * Chrome sound guardrail (`docs/plans/ideas/audio.md`, "Guardrail").
 *
 * Three rules:
 *
 * 1. The player's `SoundId` registry and the generator's list name exactly the
 *    same sounds. A sound added to one and not the other is either an event
 *    that plays nothing or a file nothing plays, and both are invisible.
 * 2. Every declared sound exists as a file, in the committed format, inside its
 *    duration budget, at its loudness target, under the true-peak ceiling, and
 *    with no leading silence.
 * 3. Nothing else is sitting in the sound directory.
 *
 * No `ffprobe`, and no manifest of measured properties to trust either. These
 * files are uncompressed PCM, so every property above is readable from the
 * bytes with Node alone — which is what `audio.md`'s second open question was
 * asking, at least for this population of audio.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { readSource, repoRoot, report } from "./guardrails.mjs";
import {
  FORMAT,
  fileFor,
  LOUDNESS_TOLERANCE,
  MAX_LEAD_IN_MS,
  MAX_SECONDS,
  SOUND_DIR,
  SOUNDS,
  targetFor,
  TRUE_PEAK_CEILING_DB
} from "./lib/chromeSounds.mjs";
import { decodeWav, loudnessLufs, truePeakDb } from "./lib/wav.mjs";
import { chromeSoundProblems, parseSoundIds } from "./rules.mjs";

const REGISTRY = "apps/player-web/src/audio/sounds.ts";

/**
 * Below this a sample is silence for the purpose of finding the lead-in.
 * −60 dBFS: quiet enough that dither or a fade-in does not read as sound,
 * loud enough that a real attack always does.
 */
const SILENCE = 0.001;

function leadInMs(samples, rate) {
  for (let index = 0; index < samples.length; index += 1) {
    if (Math.abs(samples[index]) > SILENCE) return (index / rate) * 1000;
  }
  return (samples.length / rate) * 1000;
}

const spec = {
  format: FORMAT,
  maxSeconds: MAX_SECONDS,
  tolerance: LOUDNESS_TOLERANCE,
  truePeakCeilingDb: TRUE_PEAK_CEILING_DB,
  maxLeadInMs: MAX_LEAD_IN_MS
};

/* ------------------------------------------- the two lists name the same set */

const declared = parseSoundIds(await readSource(REGISTRY));
const mismatched = [];
if (declared === null) {
  mismatched.push({
    path: REGISTRY,
    line: 1,
    text: "no SOUND_IDS array found"
  });
} else {
  const generated = SOUNDS.map((sound) => sound.id);
  for (const id of generated) {
    if (!declared.includes(id)) {
      mismatched.push({
        path: REGISTRY,
        line: 1,
        text: `${id} is generated but not declared here`
      });
    }
  }
  for (const id of declared) {
    if (!generated.includes(id)) {
      mismatched.push({
        path: "scripts/lib/chromeSounds.mjs",
        line: 1,
        text: `${id} is declared in ${REGISTRY} but nothing generates it`
      });
    }
  }
}

/* ----------------------------------------------- every file meets the spec */

const faulty = [];
for (const sound of SOUNDS) {
  const path = `${SOUND_DIR}/${fileFor(sound)}`;

  let audio;
  try {
    audio = decodeWav(await readFile(join(repoRoot, path)));
  } catch (error) {
    faulty.push({ path, line: 1, text: `unreadable: ${error.message}` });
    continue;
  }

  const measured = {
    codec: audio.codec,
    channels: audio.channels,
    rate: audio.rate,
    bitsPerSample: audio.bitsPerSample,
    seconds: audio.samples.length / audio.rate,
    lufs: loudnessLufs(audio.samples, audio.rate),
    truePeakDb: truePeakDb(audio.samples),
    leadInMs: leadInMs(audio.samples, audio.rate)
  };

  for (const problem of chromeSoundProblems(measured, {
    ...spec,
    targetLufs: targetFor(sound)
  })) {
    faulty.push({ path, line: 1, text: problem });
  }
}

/* ------------------------------------------------- nothing else lives there */

const expected = new Set([...SOUNDS.map(fileFor), "PROVENANCE.md"]);
const stray = (await readdir(join(repoRoot, SOUND_DIR)))
  .filter((name) => !expected.has(name))
  .map((name) => ({
    path: `${SOUND_DIR}/${name}`,
    line: 1,
    text: "not produced by the generator"
  }));

const ok =
  report(
    "the sound registry and the generator agree",
    mismatched,
    "Add the sound to both apps/player-web/src/audio/sounds.ts and scripts/lib/chromeSounds.mjs, then re-run node scripts/generate-chrome-sounds.mjs."
  ) &
  report(
    "every chrome sound matches the committed format",
    faulty,
    "Re-run node scripts/generate-chrome-sounds.mjs. Do not hand-edit these files — the generator is their provenance record."
  ) &
  report(
    "nothing unaccounted for in the sound directory",
    stray,
    "Delete it, or give it a voice in scripts/generate-chrome-sounds.mjs so the generator owns it."
  );

process.exit(ok ? 0 : 1);
