import type { StoryPage } from "@lectoemocion/resource-schema";

/**
 * *El gallo Rayo — ¿Cómo suenan las letras?*, by Belén Gil.
 *
 * A picture book turned into a resource: a cover and thirty letter pages, each
 * a drawing of the rooster shaping a sound, with that sound recorded. It came
 * from the standalone PHP application the book shipped with, assessed in
 * `docs/migration/gallo-rayo-app.md`; the pictures and recordings are imported
 * by `scripts/import-story-pages.mjs`.
 *
 * This list is the single source of truth for the book's order. The committed
 * files are named by sequence position precisely so that they cannot hold a
 * second, drifting answer — page N of this array is `NN` on disk.
 */
export const GALLO_RAYO_STORY_ID = "gallo-rayo";

/** One lesson: a grapheme, and which of its sounds where that is ambiguous. */
type Lesson = {
  readonly grapheme: string;
  readonly sound?: string;
};

/**
 * The book's own order, which is phonetic rather than alphabetical.
 *
 * It opens on the sounds a child can hold and blend — C, O, A, M, E, I make
 * *casa*, *coma*, *mamá* almost immediately — and leaves the rare and the
 * silent for the end: W, LL, Ñ, S, H, U. Reordering this alphabetically would
 * quietly undo the pedagogy the book is built on, so it is transcribed exactly
 * as printed and should only ever change if the book does.
 *
 * `C` appears twice on purpose. Its two sounds are two lessons, taught fifteen
 * pages apart, and `sound` is what tells them apart.
 */
const LESSONS: readonly Lesson[] = [
  { grapheme: "C", sound: "K" },
  { grapheme: "O" },
  { grapheme: "A" },
  { grapheme: "M" },
  { grapheme: "E" },
  { grapheme: "I" },
  { grapheme: "B" },
  { grapheme: "J" },
  { grapheme: "G" },
  { grapheme: "K" },
  { grapheme: "Q" },
  { grapheme: "D" },
  { grapheme: "Y" },
  { grapheme: "V" },
  { grapheme: "CH" },
  { grapheme: "Z" },
  { grapheme: "C", sound: "Z" },
  { grapheme: "P" },
  { grapheme: "T" },
  { grapheme: "N" },
  { grapheme: "L" },
  { grapheme: "X" },
  { grapheme: "F" },
  { grapheme: "R" },
  { grapheme: "W" },
  { grapheme: "LL" },
  { grapheme: "Ñ" },
  { grapheme: "S" },
  { grapheme: "H" },
  { grapheme: "U" }
];

/** `0` → `00`. The cover is page zero, as it was in the source application. */
function assetName(pageNumber: number): string {
  return String(pageNumber).padStart(2, "0");
}

function imageUrl(pageNumber: number): string {
  return `/story/${GALLO_RAYO_STORY_ID}/${assetName(pageNumber)}.webp`;
}

function audioUrl(pageNumber: number): string {
  return `/story/${GALLO_RAYO_STORY_ID}/${assetName(pageNumber)}.m4a`;
}

/**
 * Stable across reorderings, unlike the page number.
 *
 * The two `C` lessons would collide on their grapheme alone, so a lesson that
 * names a sound carries it here too: `c-k` and `c-z`.
 */
function pageId(lesson: Lesson): string {
  const base = lesson.grapheme.toLocaleLowerCase("es-ES");
  return lesson.sound === undefined
    ? base
    : `${base}-${lesson.sound.toLocaleLowerCase("es-ES")}`;
}

export const galloRayoPages: readonly StoryPage[] = [
  {
    kind: "cover",
    pageId: "portada",
    imageUrl: imageUrl(0),
    audioUrl: audioUrl(0)
  },
  ...LESSONS.map((lesson, index): StoryPage => {
    const pageNumber = index + 1;
    return {
      kind: "letter",
      pageId: pageId(lesson),
      grapheme: lesson.grapheme,
      /*
       * Spread rather than assigned: `exactOptionalPropertyTypes` treats an
       * explicit `sound: undefined` as different from an absent one, and a
       * page with no ambiguity to resolve should not carry the key at all.
       */
      ...(lesson.sound === undefined ? {} : { sound: lesson.sound }),
      imageUrl: imageUrl(pageNumber),
      audioUrl: audioUrl(pageNumber)
    };
  })
];
