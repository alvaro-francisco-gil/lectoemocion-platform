/**
 * Importer for hand-supplied world art.
 *
 * Kept in the repository for the same reason as
 * `import-vocabulary-images.mjs`: it *is* the provenance record. It states
 * exactly which transform produced the committed file, so the import is
 * reproducible and auditable rather than a binary someone once dragged in.
 *
 *   node scripts/import-world-art.mjs <source-image> <name> [--scene]
 *
 * The source is whatever an adult handed us — commonly an SVG that is not
 * vector art at all, but a wrapper around embedded rasters, which costs a
 * third extra for the base64. This unwraps that case, lifts the flat
 * background to transparency where there is one, and emits the WebP the
 * player actually ships.
 *
 * `--scene` imports a backdrop rather than a character: the picture *is* the
 * rectangle, so lifting its background and trimming to content would be
 * destructive, and it is allowed a wider edge because it spans the display
 * instead of standing in it.
 */
import { readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import sharp from "sharp";
import { removeWhiteBackground } from "./lib/remove-white-background.mjs";

const OUTPUT_DIR = "apps/player-web/public/world";

/** Classroom panels are weak and the bundle budget is a product concern. */
const EDGE = 512;
const QUALITY = 82;

/*
 * A backdrop is stretched across the whole display, so it needs the width a
 * character does not — but only up to a classroom panel's own resolution.
 * Photographic gradients also cost far more per pixel than flat cartoon fills,
 * which is why the quality sits lower than the character's and still lands
 * smaller per covered pixel.
 */
const SCENE_EDGE = 1920;
const SCENE_QUALITY = 72;

/**
 * The shortest render the pipeline downstream may be handed.
 *
 * Four times the 512 a character comes out at, because the trim is what
 * decides how much of a render survives: a subject occupying a quarter of its
 * canvas has to still exceed 512 afterwards, or the resize is an enlargement
 * it refuses to make and the file ships soft.
 */
const MIN_RENDER_EDGE = 2048;

/**
 * Turns whatever was supplied into pixels, and says whether they arrived cut
 * out.
 *
 * An SVG here is almost never vector art; it is a container for rasters. It is
 * nonetheless **rendered rather than unwrapped**, even when it holds a single
 * image, because the container is not always inert. These letriestrellas are
 * one raster each — and the vowel on the front of the star is a vector path
 * beside it. Lifting the raster out produced five identical letterless stars,
 * which is the failure mode this note exists to prevent: not an error, a
 * plausible wrong picture. The same applies to a composition of a dozen
 * layers, where the first raster alone is a fence with no horse.
 *
 * A file with no embedded raster at all *is* real vector art and is rejected.
 * It has nothing to gain here and would lose its resolution independence.
 *
 * @returns {Promise<Buffer>} rendered pixels
 */
async function rasterSource(path) {
  if (!path.toLowerCase().endsWith(".svg")) return readFile(path);

  const svg = await readFile(path, "utf8");
  if (!/href="data:image\/[a-z+]+;base64,/.test(svg)) {
    throw new Error(`${path} is real vector art; it needs no import.`);
  }

  /* librsvg reads the document at 72 dpi; scaling that up is how a viewBox in
     points becomes a render tall enough to survive the trim. */
  const natural = await sharp(Buffer.from(svg)).metadata();
  const scale = Math.max(
    1,
    MIN_RENDER_EDGE / Math.max(natural.width, natural.height)
  );

  return sharp(Buffer.from(svg), { density: 72 * scale }).png().toBuffer();
}

const flags = process.argv.slice(2).filter((each) => each.startsWith("--"));
const [source, name] = process.argv.slice(2).filter(
  (each) => !each.startsWith("--")
);
const unknown = flags.find((flag) => flag !== "--scene");
if (!source || !name || unknown) {
  throw new Error(
    "usage: node scripts/import-world-art.mjs <source> <name> [--scene]"
  );
}
const scene = flags.includes("--scene");

const pixels = await rasterSource(source);

/*
 * A scene is never matted: the picture *is* the rectangle, so lifting its
 * background would eat the composition.
 *
 * A character is always *offered* the matte, and whether one happens is the
 * flood's own answer rather than a flag or a guess. `removeWhiteBackground`
 * declines a picture whose border is not a card — that is what its
 * `MINIMUM_SHARE` is for — so a subject that arrived cut out passes through
 * untouched and reports zero. Nothing here has to know which it was handed.
 *
 * The source cannot tell us instead. These containers apply their alpha with
 * an SVG filter, so every layer inside a fully cut-out composition is an
 * opaque PNG, and the obvious test reads exactly backwards.
 *
 * The card must reach the border for the flood to find it, and a render of an
 * SVG is the whole document, so a card drawn inside one sits in a margin of
 * transparency the flood cannot cross — it seeds on pale border pixels, and
 * transparent is not pale. Shedding that margin first puts the card back on
 * the edge, where it is the thing the picture stands on.
 */
const prepared = sharp(pixels).ensureAlpha();
const { data, info } = await (scene ? prepared : prepared.trim())
  .raw()
  .toBuffer({ resolveWithObject: true });

const clearedPixels = scene ? 0 : removeWhiteBackground(data, info);

/* Trimming before the resize spends the whole 512 budget on the character,
   and downscaling afterwards averages the hard alpha edge into a smooth one.
   A scene is not trimmed: its edges are the composition. */
const edge = scene ? SCENE_EDGE : EDGE;
const resized = sharp(data, {
  raw: { width: info.width, height: info.height, channels: 4 }
});
const output = await (scene ? resized : resized.trim())
  .resize({ width: edge, height: edge, fit: "inside", withoutEnlargement: true })
  .webp({ quality: scene ? SCENE_QUALITY : QUALITY })
  .toBuffer();

const destination = join(OUTPUT_DIR, `${name}.webp`);
await writeFile(destination, output);

/*
 * A character that comes out opaque is one standing on a card the flood failed
 * to find, and the symptom is not an error: it is a sticker on the map, one
 * white rectangle among ten cut-outs. Asking the finished file rather than the
 * flood catches that however it happened — a card too grey to seed, a subject
 * bleeding to its own edge — instead of only the one way the flood reports.
 */
if (!scene && (await sharp(output).stats()).isOpaque) {
  throw new Error(
    `${source} came out opaque: it stands on a background this could not lift.`
  );
}

/* The number alone cannot say which happened: a matted picture and one that
   arrived cut out both end with a clear ground, and only one was worked on. */
const treatment = scene
  ? "scene"
  : clearedPixels === 0
    ? "already cut out"
    : `${Math.round((clearedPixels / (info.width * info.height)) * 100)}% cleared`;

const final = await sharp(output).metadata();
process.stdout.write(
  `${basename(source)} (${info.width}×${info.height}) → ${destination} ` +
    `(${final.width}×${final.height}, ${Math.round(output.length / 1024)} kB, ` +
    `${treatment})\n`
);
