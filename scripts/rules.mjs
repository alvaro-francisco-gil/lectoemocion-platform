/**
 * The guardrail rules themselves, separated from the scripts that run them so
 * they can be unit-tested. A guardrail nobody proved can fail is decoration.
 */

export const RENDERER_ADAPTER = "apps/player-web/src/game/";

export const FIREBASE_ALLOWED_PREFIXES = ["packages/firebase/", "functions/"];

/** Bootstrap files exempted by explicit decision. Keep this list near-empty. */
export const FIREBASE_ALLOWED_FILES = [];

/** `ids.ts` casts through the brand; that cast is the nominal-typing mechanism. */
export const STRICT_TYPES_ALLOWED_FILES = ["packages/domain/src/ids.ts"];

const importFrom = (module) =>
  new RegExp(`from\\s+["']${module}(?:\\/[^"']*)?["']`);

export const isPhaserImport = (line) => importFrom("phaser").test(line);

export const isReactImport = (line) =>
  importFrom("react").test(line) || importFrom("react-dom").test(line);

export const isFirebaseImport = (line) =>
  importFrom("firebase").test(line) ||
  importFrom("firebase-admin").test(line) ||
  /from\s+["']@firebase\/[^"']+["']/.test(line);

export const isForbiddenInSharedPackage = (line) =>
  isPhaserImport(line) || isReactImport(line) || isFirebaseImport(line);

/** Where progress state lives. Nothing outside the shell may reach into it. */
export const PROGRESS_MODULE = "apps/player-web/src/world/progressStore";

/**
 * Invariant 2: templates never read or write progress state.
 *
 * A template that can see progress can branch on it, and content that branches
 * on progress stops being replayable, portable, or reviewable in isolation.
 * The map is the one thing that legitimately reads progress, and it lives in
 * the shell for exactly this reason.
 */
export const isProgressImport = (line) =>
  /from\s+["'][^"']*(?:progressStore|\/world\/progress)["']/.test(line) ||
  /from\s+["'][^"']*worldView["']/.test(line);

/**
 * A hand-built per-child storage key.
 *
 * A profile's id *is* its namespace: `storageKey(id)` builds
 * `lectoemocion.progress.<id>` and `giftsKey(id)` builds
 * `lectoemocion.gifts.<id>`, and that is the whole mechanism keeping two
 * children's stars and two children's regalos apart. It is a guarantee only
 * while exactly one function builds each. A second place spelling a prefix out
 * can namespace a child's things by something that is not a profile id — a
 * name, a stale constant, an index — and the failure is silent: no error, no
 * missing data, just a sibling's world quietly becoming yours.
 *
 * Only a quoted occurrence in code counts. A comment may name the key, and may
 * format it as code in backticks, because documenting the shape is not a second
 * place that builds it.
 */
export const isChildNamespaceLiteral = (line) =>
  !/^\s*(?:\/\/|\/\*|\*)/.test(line) &&
  /["'`]lectoemocion\.(?:progress|gifts)\./.test(line);

export const isConsoleCall = (line) =>
  /\bconsole\.(log|info|warn|error|debug|trace|table|dir)\b/.test(line);

const STRICT_TYPE_ESCAPES = [
  /\bas\s+any\b/,
  /:\s*any\b/,
  /<any>/,
  /\bArray<any>/,
  /\bany\[\]/,
  /@ts-nocheck/,
  /@ts-ignore/,
  /@ts-expect-error(?!\s+\S)/
];

export const isStrictTypeEscape = (line) => {
  const trimmed = line.trimStart();
  if (trimmed.startsWith("*") || trimmed.startsWith("//")) return false;
  return STRICT_TYPE_ESCAPES.some((pattern) => pattern.test(line));
};

/** The adult area. Everything in it is reachable only through its gate. */
export const ADULT_AREA = "apps/player-web/src/app/adult/";

/** `./adult/index` names the same module as `./adult`; both are the gate. */
const isEntryPointSegment = (segment) => /^index(\.[jt]sx?)?$/.test(segment);

const ADULT_AREA_IMPORT_PATH =
  /(?:\bfrom\s+|\bimport\(\s*|\brequire\(\s*)["']([^"']*\/adult\/[^"']+)["']/;

/**
 * An adult-only area is exactly the kind of invariant that decays: the next
 * adult-facing screen gets added beside the others and nobody notices it is
 * reachable without the gate. Only `adult/index.tsx` (imported as `./adult`
 * or `./adult/index`) may be imported from outside, and that module wraps
 * the area in `AdultGate`.
 *
 * Catches a static `from "..."`, a dynamic `import("...")`, and a
 * `require("...")` that reach past the entry point. Does not catch a
 * multi-line `import` whose `from` clause sits on its own source line — the
 * scanner in `guardrails.mjs` tests each line independently, a limitation it
 * shares with `isFirebaseImport` and `isProgressImport`.
 */
export const isDeepAdultAreaImport = (line) => {
  const match = line.match(ADULT_AREA_IMPORT_PATH);
  if (!match) return false;
  const importPath = match[1] ?? "";
  const afterAdult = importPath.split("/adult/").at(-1) ?? "";
  return !isEntryPointSegment(afterAdult);
};

export const MEDIA_EXTENSIONS = [
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".heic", ".bmp", ".tiff",
  ".mp3", ".m4a", ".wav", ".aac", ".ogg", ".opus", ".flac",
  ".mp4", ".mov", ".webm", ".avi", ".mkv"
];

export const isMediaFile = (name) =>
  MEDIA_EXTENSIONS.some((extension) => name.toLowerCase().endsWith(extension));

/**
 * Everything wrong with one chrome sound, as human-readable lines.
 *
 * Audio format drift is invisible until one device in one classroom fails to
 * decode, or until a teacher rides the volume all lesson because one sound was
 * mastered louder than the rest. That is precisely the class of defect that
 * needs a machine rather than a reviewer.
 *
 * Pure, so `rules.test.ts` can prove each clause fires; the measuring is
 * `check-audio-assets.mjs`'s job.
 */
export function chromeSoundProblems(measured, spec) {
  const problems = [];
  const { format } = spec;

  if (measured.codec !== format.codec) {
    problems.push(`codec ${measured.codec}, expected PCM (${format.codec})`);
  }
  if (measured.channels !== format.channels) {
    problems.push(`${measured.channels} channels, expected ${format.channels}`);
  }
  if (measured.rate !== format.rate) {
    problems.push(`${measured.rate} Hz, expected ${format.rate} Hz`);
  }
  if (measured.bitsPerSample !== format.bitsPerSample) {
    problems.push(
      `${measured.bitsPerSample}-bit, expected ${format.bitsPerSample}-bit`
    );
  }
  if (measured.seconds > spec.maxSeconds) {
    problems.push(
      `${measured.seconds.toFixed(2)} s, longer than the ${spec.maxSeconds} s limit`
    );
  }
  if (Math.abs(measured.lufs - spec.targetLufs) > spec.tolerance) {
    problems.push(
      `${measured.lufs.toFixed(1)} LUFS, not within ` +
        `${spec.tolerance} LU of ${spec.targetLufs}`
    );
  }
  if (measured.truePeakDb > spec.truePeakCeilingDb) {
    problems.push(
      `${measured.truePeakDb.toFixed(1)} dBTP, above the ` +
        `${spec.truePeakCeilingDb} dBTP ceiling`
    );
  }
  /*
   * The one that justifies the uncompressed format. Leading silence hand-built
   * into a file would give back exactly the latency that dropping AAC removed,
   * and it passes every test that only checks the sound plays.
   */
  if (measured.leadInMs > spec.maxLeadInMs) {
    problems.push(
      `starts with ${measured.leadInMs.toFixed(0)} ms of silence, over the ` +
        `${spec.maxLeadInMs} ms limit`
    );
  }
  return problems;
}

/**
 * The sound ids the player's registry declares.
 *
 * Read out of the source rather than imported because the guardrails run on
 * Node built-ins alone, before and independently of any build step. `null`
 * means the array could not be found at all, which is itself the failure.
 */
export function parseSoundIds(source) {
  const declaration = /export const SOUND_IDS = \[([^\]]*)\]/.exec(source);
  if (!declaration) return null;
  return [...declaration[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}
