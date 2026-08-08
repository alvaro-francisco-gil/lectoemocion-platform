/**
 * One-off importer for the Godot prototype's vocabulary pictures.
 *
 * Kept in the repository because it *is* the provenance record: it states
 * exactly which source produced which committed file, so the import is
 * reproducible and auditable rather than a pile of binaries someone once
 * dragged in.
 *
 * The prototype encodes syllabification in its filenames (`ma-ri-po-sa.png`),
 * which is the one genuinely useful thing about that scheme. We read it once,
 * here, and emit a typed fixture — the player never parses a filename.
 *
 *   node scripts/import-vocabulary-images.mjs
 */
import { setDefaultResultOrder } from "node:dns";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import {
  TARGET_COVERAGE,
  inkArea,
  squareCanvas
} from "./lib/normalise-ink-area.mjs";
import { removeWhiteBackground } from "./lib/remove-white-background.mjs";

/* Some networks advertise IPv6 for github.com but cannot route it. */
setDefaultResultOrder("ipv4first");

const SOURCE_REPO = "alvaro-francisco-gil/lectoemocion";
const SOURCE_PATH = "assets/images";
const OUTPUT_DIR = "apps/player-web/public/vocabulary";
const FIXTURE = "packages/template-catalog/src/fixtures/defaultVocabulary.ts";
const PROVENANCE = "apps/player-web/public/vocabulary/PROVENANCE.md";

/** Classroom panels are weak and the bundle budget is a product concern. */
const EDGE = 512;
const QUALITY = 82;

/** One picture per word: the prototype ships some words twice, in two formats. */
const EXTENSION_PREFERENCE = [".png", ".webp", ".jpg", ".jpeg"];

/**
 * Words held back from the default catalogue, with the reason, so the decision
 * is reviewable rather than an unexplained gap. Delete an entry to include it.
 */
const EXCLUDED = new Map([
  [
    "india",
    "Depicts a child in feather headdress and face paint — an ethnic costume " +
      "caricature this product should not ship to schools."
  ]
]);

async function listSource() {
  const response = await fetch(
    `https://api.github.com/repos/${SOURCE_REPO}/contents/${SOURCE_PATH}`,
    { headers: { accept: "application/vnd.github+json" } }
  );
  if (!response.ok) {
    throw new Error(`Listing ${SOURCE_PATH} failed: ${response.status}`);
  }
  return response.json();
}

function parse(name) {
  const dot = name.lastIndexOf(".");
  const base = name.slice(0, dot);
  const extension = name.slice(dot).toLowerCase();
  const syllables = base.split("-").filter((part) => part.length > 0);
  return { base, extension, syllables, word: syllables.join("") };
}

function chooseOnePerWord(entries) {
  const byWord = new Map();
  for (const entry of entries) {
    const parsed = parse(entry.name);
    if (parsed.syllables.length === 0) continue;
    if (!EXTENSION_PREFERENCE.includes(parsed.extension)) continue;
    if (EXCLUDED.has(parsed.word)) continue;

    const existing = byWord.get(parsed.word);
    if (!existing) {
      byWord.set(parsed.word, { ...parsed, entry });
      continue;
    }
    const rank = (value) => EXTENSION_PREFERENCE.indexOf(value.extension);
    if (rank(parsed) < rank(existing)) {
      byWord.set(parsed.word, { ...parsed, entry });
    }
  }
  return [...byWord.values()].sort((a, b) => a.word.localeCompare(b.word, "es"));
}

async function main() {
  const chosen = chooseOnePerWord(await listSource());

  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });

  const imported = [];
  for (const item of chosen) {
    const response = await fetch(item.entry.download_url);
    if (!response.ok) {
      throw new Error(`Downloading ${item.entry.name} failed: ${response.status}`);
    }
    const source = Buffer.from(await response.arrayBuffer());
    const output = await encode(source);

    await writeFile(join(OUTPUT_DIR, `${item.word}.webp`), output);
    imported.push({ ...item, bytes: output.length, sourceBytes: source.length });
  }

  await writeFile(FIXTURE, renderFixture(imported));
  await writeFile(PROVENANCE, renderProvenance(imported));

  const before = imported.reduce((sum, each) => sum + each.sourceBytes, 0);
  const after = imported.reduce((sum, each) => sum + each.bytes, 0);
  process.stdout.write(
    `${imported.length} pictures, ${(before / 1e6).toFixed(1)} MB source ` +
      `-> ${(after / 1e6).toFixed(1)} MB WebP\n`
  );
}

/**
 * Half the prototype's pictures were cut out and half were shot on a flat white
 * card. The player composites both over painted scenery, so the ones with a card
 * are matted here — once, at import — rather than every surface working around
 * an opaque square. A picture that already carries alpha was cut out by its
 * author and is left exactly as it is.
 *
 * Every picture is then trimmed to its subject and given a square canvas
 * proportioned to the ink on it, by `scripts/lib/normalise-ink-area.mjs`. Both
 * surfaces that draw these scale to fit — `object-fit: contain` in the
 * collection, `Math.min(inner / w, inner / h, 1)` on a card — so a picture's
 * own margin decides how big it comes out, and every stock picture carries a
 * different one. Trimming throws that margin away; normalising then gives the
 * margin back in the one amount that makes a chick and a whale read as the same
 * size in the same box.
 */
async function encode(source) {
  const resized = sharp(source).resize(EDGE, EDGE, {
    fit: "inside",
    withoutEnlargement: true,
    background: { r: 255, g: 255, b: 255, alpha: 0 }
  });
  if ((await sharp(source).metadata()).hasAlpha) {
    return normalised(trimmed(resized));
  }

  const { data, info } = await resized
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  removeWhiteBackground(data, info);
  return normalised(
    trimmed(
      sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    )
  );
}

/**
 * Centres a trimmed subject on the square that gives it the standard weight,
 * then encodes it.
 *
 * The subject is padded rather than scaled, so a picture that has to read
 * smaller grows a canvas around itself at no cost in resolution. That canvas can
 * exceed `EDGE`, which is a bundle-size budget rather than a shape, so the
 * finished square is fitted back inside it — in a second pass, because sharp
 * resizes before it extends whatever order the calls are written in, and a cap
 * in the same pipeline would silently apply to the subject instead of to the
 * canvas.
 */
async function normalised(image) {
  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { size, left, top } = squareCanvas({
    width: info.width,
    height: info.height,
    ink: inkArea(data)
  });

  const extended = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 }
  })
    .extend({
      top,
      left,
      bottom: size - info.height - top,
      right: size - info.width - left,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();

  return sharp(extended)
    .resize(EDGE, EDGE, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer();
}

/**
 * Cuts the transparent margin away. The threshold is above zero because lossy
 * alpha leaves a few almost-invisible pixels out in the margin, and trimming at
 * exactly zero would keep the whole of it for their sake.
 */
function trimmed(image) {
  return image.trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 12 });
}

function renderFixture(items) {
  const entries = items
    .map(
      (item) =>
        `  item("${item.word}", [${item.syllables
          .map((syllable) => `"${syllable}"`)
          .join(", ")}])`
    )
    .join(",\n");

  return `// Generated by scripts/import-vocabulary-images.mjs. Do not edit by hand.
import { vocabularyItemId } from "@lectoemocion/domain";
import type { VocabularyItem } from "@lectoemocion/resource-schema";

/**
 * Product-authored default vocabulary.
 *
 * Syllabification comes from the source filenames, read once at import time.
 * The word itself is derived from these syllables, so the two cannot disagree.
 *
 * These games carry no child data at all, which is what the default-content
 * institutional pilot requires. Picture rights are recorded in
 * apps/player-web/public/vocabulary/PROVENANCE.md.
 */
function item(id: string, syllables: readonly string[]): VocabularyItem {
  return {
    vocabularyItemId: vocabularyItemId(id),
    syllables: [...syllables],
    imageUrl: \`/vocabulary/\${encodeURIComponent(id)}.webp\`
  };
}

export const defaultVocabulary: readonly VocabularyItem[] = [
${entries}
];
`;
}

function renderProvenance(items) {
  const rows = items
    .map(
      (item) =>
        `| \`${item.word}.webp\` | \`${item.entry.name}\` | ${(
          item.bytes / 1024
        ).toFixed(0)} kB |`
    )
    .join("\n");

  return `# Vocabulary picture provenance

Generated by \`scripts/import-vocabulary-images.mjs\`. Re-run it to reproduce
every file here; do not add pictures by hand.

## Source and rights

Imported from the \`${SOURCE_PATH}\` directory of the LectoEmoción Godot
prototype (\`${SOURCE_REPO}\`), which is assessed in
\`docs/migration/godot-prototype.md\`.

The repository owner states these are **free-licence stock images** (CC0 or
equivalent, from services such as Pixabay) collected during prototyping. Such
licences permit commercial use and do not require per-image attribution.

**Known limitation.** The prototype recorded no per-file source URL or licence
identifier, and a filename cannot carry one, so the specific origin of an
individual picture is not recoverable from the material imported here. The
statement above is the owner's attestation for the collection, not a verified
per-file licence audit. If a picture is ever challenged, the remedy is to
replace that file and re-run the importer.

No picture contains or depicts child data. These are objects and animals.

## Processing

Each source image was resized to fit within ${EDGE}×${EDGE} without
enlargement and re-encoded as WebP at quality ${QUALITY}, preserving
transparency. Where the prototype shipped the same word in two formats, one was
chosen by the preference ${EXTENSION_PREFERENCE.join(" > ")}.

A source with no alpha channel was shot on a flat white card, which the player
would composite over painted scenery as an opaque square. Those are matted by
\`scripts/lib/remove-white-background.mjs\`, which grows a transparent region
inward from the border and so removes the card without touching white *inside*
the silhouette. Sources that already carry alpha are not matted at all.

Every picture is then trimmed to its subject and centred on a transparent square
proportioned so that its ink covers ${(TARGET_COVERAGE * 100).toFixed(0)}% of it.

The surfaces which draw these all scale the whole picture to fit, so the margin
a picture carries is what decides how big it comes out, and every stock picture
carried a different one. Trimming alone equalises the *box*, which is not what a
child sees: a llama fills its box and a kite fills a third of it, and fitted to
the same square one came out more than twice the size of the other. Holding the
ink constant instead is what puts a chick and a whale on the page at the same
weight. A subject too thin to reach that share on any square containing it —
a pencil, a bone — keeps its own box rather than shrinking every other picture
to match it.

## Held back

Present in the prototype, deliberately not imported:

${[...EXCLUDED].map(([word, reason]) => `- \`${word}\` — ${reason}`).join("\n")}

## Files

| Committed | Source | Size |
|---|---|---|
${rows}
`;
}

await main();
