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
 * The source is whatever an adult handed us — commonly an SVG that is only a
 * wrapper around one embedded raster, which is not vector art and costs a
 * third extra for the base64. This unwraps that case, lifts the flat
 * background to transparency, and emits the WebP the player actually ships.
 *
 * `--scene` imports a backdrop rather than a character: the picture *is* the
 * rectangle, so lifting its background and trimming to content would be
 * destructive, and it is allowed a wider edge because it spans the display
 * instead of standing in it.
 */
import { readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import sharp from "sharp";

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
 * How far from pure white still counts as background, per channel. JPEG rings
 * around hard edges, so an exact-white test leaves a halo of near-white
 * speckle behind the character.
 */
const WHITE = 234;

/**
 * Lifts a flat light background to transparency by flooding inwards from the
 * borders, rather than by testing every pixel against the threshold. White
 * inside the drawing — the eyes, the stocking stripes — is enclosed by outline
 * and is never reached, so it survives.
 */
function clearBackground({ data, width, height }) {
  const pixels = width * height;
  const cleared = new Uint8Array(pixels);
  const isBackground = (index) => {
    const at = index * 4;
    return (
      data[at] >= WHITE && data[at + 1] >= WHITE && data[at + 2] >= WHITE
    );
  };

  /* An explicit stack, not recursion: a megapixel image overflows the call
     stack long before it runs out of memory. */
  const stack = [];
  for (let x = 0; x < width; x += 1) {
    stack.push(x, (height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    stack.push(y * width, y * width + width - 1);
  }

  while (stack.length > 0) {
    const index = stack.pop();
    if (cleared[index] === 1 || !isBackground(index)) continue;
    cleared[index] = 1;
    data[index * 4 + 3] = 0;

    const x = index % width;
    const y = (index - x) / width;
    if (x > 0) stack.push(index - 1);
    if (x < width - 1) stack.push(index + 1);
    if (y > 0) stack.push(index - width);
    if (y < height - 1) stack.push(index + width);
  }

  return cleared.reduce((total, flag) => total + flag, 0);
}

/** Unwraps an SVG that is only a container for one embedded raster image. */
async function rasterSource(path) {
  if (!path.toLowerCase().endsWith(".svg")) return readFile(path);

  const svg = await readFile(path, "utf8");
  const embedded = /href="data:image\/[a-z+]+;base64,([^"]+)"/.exec(svg);
  if (!embedded) {
    throw new Error(`${path} is real vector art; it needs no import.`);
  }
  return Buffer.from(embedded[1], "base64");
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

const input = sharp(await rasterSource(source)).ensureAlpha();
const { data, info } = await input
  .raw()
  .toBuffer({ resolveWithObject: true });

/* A scene keeps every pixel it was drawn with; only a character is lifted off
   its background. */
const clearedPixels = scene
  ? 0
  : clearBackground({ data, width: info.width, height: info.height });
if (!scene && clearedPixels === 0) {
  throw new Error(`${source} has no flat light background to remove.`);
}

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

const final = await sharp(output).metadata();
process.stdout.write(
  `${basename(source)} (${info.width}×${info.height}) → ${destination} ` +
    `(${final.width}×${final.height}, ${Math.round(output.length / 1024)} kB` +
    (scene
      ? ", scene)\n"
      : `, ${Math.round(
          (clearedPixels / (info.width * info.height)) * 100
        )}% cleared)\n`)
);
