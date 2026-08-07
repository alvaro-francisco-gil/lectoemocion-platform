#!/usr/bin/env node
/**
 * Generator for the synthetic class's media.
 *
 *   node scripts/generate-synthetic-cast.mjs
 *
 * Kept in the repository for the same reason as the importers beside it: it
 * *is* the provenance record. Every file under
 * `apps/player-web/public/synthetic/` is produced here, from nothing, so the
 * directory can be deleted and rebuilt byte for byte and no reviewer has to
 * take on trust that a photograph of a real child never entered the repository.
 *
 * `name-book` is the reason this exists. It cannot be built without a roster,
 * so developing or testing it needs media that stands in for a child's photo
 * and recording — and AGENTS.md forbids the real thing anywhere.
 *
 * Node built-ins only, and no network. Determinism is the point: running it
 * twice produces identical bytes, so a rebuild is never a diff.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const OUTPUT_DIR = "apps/player-web/public/synthetic";

/**
 * The class this generates for: an id, and the letter drawn on its avatar.
 *
 * Restated here rather than imported from
 * `packages/template-catalog/src/fixtures/syntheticClass.ts`, because scripts
 * run before and independently of any install step and cannot resolve a
 * workspace package. The two are held together by `syntheticCast.test.ts` in
 * that package, which imports this list and fails if a child exists on one side
 * and not the other — a drift that would otherwise surface as a silently
 * missing photo.
 */
export const CLASS = [
  ["ana", "A"], ["alex", "Á"], ["aitor", "A"], ["bruno", "B"], ["carla", "C"],
  ["chema", "C"], ["diego", "D"], ["elena", "E"], ["fatima", "F"], ["gael", "G"],
  ["hugo", "H"], ["irene", "I"], ["julia", "J"], ["luna", "L"], ["mateo", "M"],
  ["nora", "N"], ["nuria", "Ñ"], ["rocio", "R"], ["sara", "S"], ["zara", "Z"]
];

/* Flat, high-contrast fills. Nothing photographic, and nothing face-like. */
const PALETTE = [
  "#4c6ef5", "#12b886", "#f76707", "#ae3ec9", "#1c7ed6",
  "#e8590c", "#0ca678", "#d6336c", "#5f3dc4", "#2b8a3e"
];

/** Deterministic, so the same id always draws the same avatar. */
function hash(text) {
  let value = 0;
  for (const character of text) {
    value = (value * 31 + character.codePointAt(0)) % 100_000;
  }
  return value;
}

/**
 * A stand-in for a photograph: a letter on a coloured disc.
 *
 * Deliberately not a face. Anything that looked like one would invite somebody
 * to replace it with a real child's photo "just for a screenshot".
 */
function avatar(id, letter) {
  const fill = PALETTE[hash(id) % PALETTE.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="Retrato sintético">
  <rect width="256" height="256" rx="32" fill="#f7f2ff"/>
  <circle cx="128" cy="128" r="92" fill="${fill}"/>
  <text x="128" y="128" font-family="system-ui, sans-serif" font-size="104"
        font-weight="700" fill="#ffffff" text-anchor="middle"
        dominant-baseline="central">${letter}</text>
</svg>
`;
}

/*
 * Half a second of MPEG-1 Layer III silence, assembled by hand.
 *
 * A recording of a real voice is precisely what must never be committed, and a
 * zero-length file is not a recording at all — the player's loader would treat
 * it as a broken asset and exercise the failure path instead of the ordinary
 * one. So: valid frame headers with zeroed granule data, which every decoder
 * renders as silence.
 *
 * 0xFF 0xFB — sync, MPEG-1, Layer III, no CRC.
 * 0x90      — 128 kbps at 44.1 kHz, unpadded.
 * 0xC0      — single channel.
 */
const FRAME_HEADER = [0xff, 0xfb, 0x90, 0xc0];
const FRAME_BYTES = Math.floor((144 * 128_000) / 44_100);
const FRAMES = 20;

function silence() {
  const frame = Buffer.alloc(FRAME_BYTES);
  Buffer.from(FRAME_HEADER).copy(frame);
  return Buffer.concat(Array.from({ length: FRAMES }, () => frame));
}

const PROVENANCE = `# Synthetic cast — provenance

Every file in this directory is **generated**, by
\`scripts/generate-synthetic-cast.mjs\`. Run it again to rebuild them:

\`\`\`bash
node scripts/generate-synthetic-cast.mjs
\`\`\`

## What these are

| Pattern | What it is |
|---|---|
| \`avatar-*.svg\` | A letter on a coloured disc. Not a face, not a photograph. |
| \`silent-*.mp3\` | Half a second of MPEG-1 Layer III silence, assembled byte by byte. |

## Why they exist

\`name-book\` — *El libro de los nombres* — is the one template that cannot be
built without a roster, so developing and testing it needs a class to stand in
for one. AGENTS.md prohibits real child data in fixtures, screenshots, and
source control, and these files are how that rule is kept while the feature
remains testable.

**No photograph, drawing, or recording of any real person appears here, and
none may be added.** The generator takes no input beyond the names it hard-codes
and reaches no network, so a rebuild cannot introduce one.

The names these belong to are invented; see
\`packages/template-catalog/src/fixtures/syntheticClass.ts\`.
`;

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const track = silence();

  for (const [id, letter] of CLASS) {
    await writeFile(join(OUTPUT_DIR, `avatar-${id}.svg`), avatar(id, letter));
    await writeFile(join(OUTPUT_DIR, `silent-${id}.mp3`), track);
  }
  await writeFile(join(OUTPUT_DIR, "PROVENANCE.md"), PROVENANCE);

  process.stdout.write(
    `Wrote ${CLASS.length * 2} synthetic files to ${OUTPUT_DIR}\n`
  );
}

/*
 * Only when run, never when imported. The drift test imports `CLASS` from this
 * file, and a module that writes to disk on import would turn `pnpm test` into
 * a build step.
 */
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
