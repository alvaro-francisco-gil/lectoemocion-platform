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
  /from\s+["'][^"']*mapView["']/.test(line);

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
