# *El gallo Rayo* application assessment

Date assessed: 2026-08-06
Source: `el_gallo_rayo APLICACIÓN OK`, a folder supplied by the repository
owner. Not in source control, here or anywhere.

## What it is

The standalone companion application to the published picture book *El gallo
Rayo — ¿Cómo suenan las letras?* by Belén Gil, a co-founder of LectoEmoción.

It is a **portable Apache 2.4 + PHP 7 bundle**, 91 MB, of which about 82 MB is
the web server and the PHP runtime. The application itself is roughly twenty
PHP files under `content/htdocs`, served on `localhost` by a `.bat` launcher.

What it does:

- A **31-page audio storybook**. Page 0 is the cover; pages 1–30 each show a
  drawing with a letter in upper and lower case, and play a recording of the
  sound that letter makes.
- The letter order is **phonetic, not alphabetical** — `C(/K/), O, A, M, E, I,
  B, J, G, K, Q, D, Y, V, CH, Z, C(/Z/), P, T, N, L, X, F, R, W, LL, Ñ, S, H,
  U`. It teaches `C` twice, for its two sounds, and includes the digraphs `CH`
  and `LL`. This order is the pedagogy; it was hardcoded in a 30-case `switch`
  in `src/utils.php`.
- Playback is automatic: `viewer.php` plays `data/audio/N.m4a`, and the
  `onended` handler navigates the browser to page `N+1`. **A full document load
  per page** — thirty-one navigations to read the book.
- An adult could create a "cuento" in `/admin` and attach **participants** to
  any page: a name, a photo, and a recording, uploaded through a form. On that
  page the child recordings played after the letter sound and the photos showed
  in a side panel. State lived in a flat `data/data.json`; uploads went to
  `uploads/`.

The supplied folder contained **no child data**. `data.json` was `[]` and
`uploads/` was empty.

## Recommendation

Migrate the **content and the reading experience**. Migrate **none of the
implementation**.

The book — 31 drawings, 31 recordings, and the phonetic order — is the whole
value. The code around it has no place in this repository, and not merely
because it is PHP:

- **The upload flow cannot be carried across.** It writes files to disk with
  the client-supplied extension, into a PHP-executable directory, behind a
  password hardcoded in `config.php` (`admin` / `cambiame`). Personalisation
  here goes through typed services and Rules (invariants 3 and 4), never a file
  drop. `$_GET['error']` is also echoed into the page unescaped.
- **The flat `data.json` store** has no schema, no versioning, and no
  validation at any boundary (invariant 1).
- **The page-per-navigation model** is the opposite of a resource that a player
  renders from a manifest.
- Apache, PHP, jQuery, Bootstrap, `protect.php`, and the `fullscreen.html`
  iframe wrapper are all superseded — by Phaser, by the world graph, and by the
  Expo shell that already gives the player full screen on a device.

## What was migrated

| Source | Destination |
|---|---|
| `data/images/0–30.jpg`, `data/audio/0–30.m4a` | `apps/player-web/public/story/gallo-rayo/`, via `scripts/import-story-pages.mjs` — see the [PROVENANCE.md](../../apps/player-web/public/story/gallo-rayo/PROVENANCE.md) there |
| `getSlideLetter()`'s 30-case switch | `galloRayoPages` in `packages/template-catalog/src/fixtures/galloRayo.ts` |
| `viewer.php` playback and auto-advance | `renderIllustratedStory` in `apps/player-web/src/game/templates/` |
| the page as a white card on pale blue | same renderer; `#E9F3FA` is carried over verbatim |
| the green *Reproducir* / *Pausar* pill | same renderer, in the same corner |
| the 350 ms body fade between pages | a picture cross-fade of the same length |
| — | the template contract: `illustrated-story` v1, a new manifest branch |

The template is `illustrated-story`, not `gallo-rayo`: the book is *content*, so
a second title is another manifest and another world node, never another
template.

## What was deliberately not migrated

- **The participant upload flow.** Attaching a child's photo and voice to a page
  is a good feature and it maps almost exactly onto `ParticipantSlot`. It
  belongs in the panel, on typed services, with Rules and a deletion path —
  which is a change to the personalisation surface, not to this template. The
  book ships first without it, as the institutional pilot requires.
- **The page-select dropdown.** Adult navigation; the shell owns adult UI, and
  a permanent list of destinations inside a resource is a way around
  progression.
- **`fullscreen.html`.** An iframe wrapper around the whole application, with a
  `window.onload` alert telling the adult to press a button. The native shell
  and the browser already do this.
- **The Apache and PHP runtime.** 82 MB of the 91.

## Where it sits in the world

`gallo-rayo` hangs off `encuentro` on the branch beside `iniciales`, rather than
in front of it. At thirty-one pages it is by far the longest resource in the
world, and putting it across the only path would mean reading all of it before
playing anything.
