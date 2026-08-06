# The *El gallo Rayo* application

An assessment of the standalone application the picture book *El gallo Rayo —
¿Cómo suenan las letras?* shipped with, and a record of what was taken from it.

## What it was

A portable Apache 2.4 + PHP 7 bundle, 91 MB, of which about 82 MB was the web
server and the PHP runtime. The application itself was roughly twenty PHP files
under `content/htdocs`, plus jQuery 3.5 and Bootstrap 4.

It served a 31-page audio storybook teaching Spanish grapheme→phoneme
correspondence. Page 0 was the cover; pages 1–30 each showed a drawing of the
rooster shaping a letter, with the letter beside it in upper and lower case,
and played a recording of that letter's sound. `viewer.php` played
`data/audio/N.m4a` and navigated to page N+1 when it ended — a full page reload
per page. A dropdown let an adult jump to any page. Stories lived in a flat
`data/data.json`.

It also had an `/admin` area, protected by a username and password held in
plaintext in `config.php`, where an adult could create a "cuento" and attach
**participants** to any page: a name, a photo, and a recording. Those played
after the letter sound and appeared in a side panel.

## What was taken

Everything that was content, and none of the code.

| From | To |
|---|---|
| `data/images/0–30.jpg` | `apps/player-web/public/story/gallo-rayo/00–30.webp` |
| `data/audio/0–30.m4a` | `apps/player-web/public/story/gallo-rayo/00–30.m4a` |
| the ordering in `Utils::getSlideLetter()` | `letterSounds`/`galloRayoPages` in `@lectoemocion/template-catalog` |
| `viewer.php`'s reading loop | `illustrated-story`, a cinematic template |

The importer is `scripts/import-story-pages.mjs`; rights and processing are
recorded in the destination's `PROVENANCE.md`. The book's order is phonetic
rather than alphabetical — `C /K/, O, A, M, E, I, …` — and that order is the
pedagogy, so it is transcribed exactly and pinned by a test.

Three behaviours were kept because they are what made it work in a classroom:
the page turns itself when its recording ends, any page is reachable directly,
and one press pauses everything. The page picker in particular is what makes a
31-page book usable in a 20-minute lesson.

## What was deliberately not taken

**The participant upload flow.** Attaching a child's photo and voice is this
product's personalisation model, and it belongs to the panel and the typed
Firebase services — behind Rules, with a deletion path and a retention policy.
Reimplementing a file drop into a web root would have violated invariants 3 and
4 on its first line. The `illustrated-story` template therefore carries pages
and no slots. Nothing was lost in the move: the source folder's `data.json` was
empty and its `uploads/` directory held no files.

**The runtime.** Apache, PHP, the flat-file store, `protect.php`, jQuery,
Bootstrap, and the `fullscreen.html` iframe wrapper are all superseded by the
Phaser player, the world graph, and the Expo shell. About twenty PHP files
became roughly two hundred lines of TypeScript.

The PHP also carried defects that simply cease to exist rather than being
migrated: a plaintext password in `config.php`; `addParticipant.php` moving an
upload into a PHP-executable directory under an attacker-supplied extension;
and `$_GET['error']` echoed into the page unescaped. None of it is worth
porting, and none of it needs a fix — there is nothing left to fix.

## Where it sits in the world

`El gallo Rayo` hangs off `El encuentro` as a branch rather than sitting across
the main path. It is by far the longest resource in the world, and putting
thirty-one pages in front of the first minigame would make every child read all
of it before playing anything.

## If a second book arrives

Add its pages to `STORIES` in `template-catalog/src/illustratedStory.ts` and
point a world node at it. `illustrated-story` is a template, not a title —
a second book is another manifest, not another renderer.
