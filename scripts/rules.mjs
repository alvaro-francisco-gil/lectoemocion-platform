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

export const MEDIA_EXTENSIONS = [
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".heic", ".bmp", ".tiff",
  ".mp3", ".m4a", ".wav", ".aac", ".ogg", ".opus", ".flac",
  ".mp4", ".mov", ".webm", ".avi", ".mkv"
];

export const isMediaFile = (name) =>
  MEDIA_EXTENSIONS.some((extension) => name.toLowerCase().endsWith(extension));
