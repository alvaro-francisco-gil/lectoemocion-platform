/**
 * Importer for an illustrated story's pages.
 *
 * Kept in the repository for the same reason as `import-world-art.mjs`: it *is*
 * the provenance record. It states exactly which transform produced each
 * committed file, so the import is reproducible and auditable rather than a
 * pile of binaries someone once dragged in.
 *
 *   node scripts/import-story-pages.mjs <source-dir> <story-name>
 *
 * The source directory is the one the PHP application served from — an
 * `images/` and an `audio/` directory holding `0.jpg`…`N.jpg` and
 * `0.m4a`…`N.m4a`, where `0` is the cover. See
 * `docs/migration/gallo-rayo-app.md`.
 *
 * Pages are emitted under their sequence position, zero-padded, and *not*
 * under the letter they teach. Which letter is on which page is authored
 * content, and it already has one home in `@lectoemocion/template-catalog`;
 * encoding it in a filename too would give that ordering a second answer.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const OUTPUT_ROOT = "apps/player-web/public/story";

/**
 * The player composites at a 1280×720 logical resolution and lets panels
 * upscale (ADR 0003), so a page carries no detail past that width. The book
 * scans are 2000×1500; the rest was bundle weight shipped over a school
 * network for nothing.
 */
const EDGE = 1280;

/**
 * Higher than the world backdrop's 72. These are ink-on-white drawings, where
 * WebP's ringing shows on every outline, and they are looked at rather than
 * looked past.
 */
const QUALITY = 80;

/** `0.jpg` → `00`, so the pages sort in reading order in a directory listing. */
function pageName(index) {
  return String(index).padStart(2, "0");
}

async function pageIndices(directory) {
  const numbered = (await readdir(directory))
    .map((name) => /^(\d+)\.(jpg|jpeg|png|m4a|mp3)$/i.exec(name))
    .filter((match) => match !== null)
    .map((match) => Number(match[1]));
  return [...new Set(numbered)].sort((a, b) => a - b);
}

const [source, story] = process.argv.slice(2);
if (!source || !story) {
  throw new Error(
    "usage: node scripts/import-story-pages.mjs <source-dir> <story-name>"
  );
}

const imageDir = join(source, "images");
const audioDir = join(source, "audio");
const outputDir = join(OUTPUT_ROOT, story);
await mkdir(outputDir, { recursive: true });

const images = await pageIndices(imageDir);
const audio = await pageIndices(audioDir);

/*
 * A page without its recording is a silent page in a book about how letters
 * sound, and a recording without its page is a voice with nothing on screen.
 * Both are missing *default* content, which fails closed (invariant 6) — here,
 * before anything is committed, rather than in a classroom.
 */
const orphans = [
  ...images.filter((index) => !audio.includes(index)).map((i) => `${i}.jpg`),
  ...audio.filter((index) => !images.includes(index)).map((i) => `${i}.m4a`)
];
if (orphans.length > 0) {
  throw new Error(`Every page needs a picture and a recording. Unpaired: ${orphans.join(", ")}`);
}
if (images.length === 0) {
  throw new Error(`No numbered pages found under ${source}`);
}

let totalBytes = 0;
for (const index of images) {
  const name = pageName(index);

  const sourceImage = join(imageDir, `${index}.jpg`);
  const original = await sharp(sourceImage).metadata();
  /*
   * The page *is* the rectangle. Unlike a character, it is neither trimmed to
   * its content nor lifted off its background: the white margin around the
   * drawing is the page, and the letter sits out in it.
   *
   * Flattened onto white and stripped of alpha — these scans carry none, and a
   * transparency channel nobody uses is bytes on a school network.
   */
  const picture = await sharp(sourceImage)
    .flatten({ background: "#ffffff" })
    .resize({ width: EDGE, height: EDGE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: QUALITY, alphaQuality: 0 })
    .toBuffer();
  await writeFile(join(outputDir, `${name}.webp`), picture);

  /*
   * The recording is copied verbatim. AAC in an MP4 container plays in every
   * browser the player supports, so a transcode would spend generation loss to
   * change nothing — and re-encoding a human voice recorded once, for a book
   * that is out of print in this form, is not reversible.
   */
  const recording = await readFile(join(audioDir, `${index}.m4a`));
  await writeFile(join(outputDir, `${name}.m4a`), recording);

  totalBytes += picture.length + recording.length;
  const final = await sharp(picture).metadata();
  process.stdout.write(
    `${index}.jpg (${original.width}×${original.height}) → ` +
      `${name}.webp (${final.width}×${final.height}, ` +
      `${Math.round(picture.length / 1024)} kB) + ` +
      `${name}.m4a (${Math.round(recording.length / 1024)} kB)\n`
  );
}

process.stdout.write(
  `\n${images.length} pages → ${outputDir} ` +
    `(${(totalBytes / 1024 / 1024).toFixed(1)} MB)\n`
);
