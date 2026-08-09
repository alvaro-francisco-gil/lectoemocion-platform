# Card scenes and letriestrella art

The repository owner supplied eighteen SVGs: five letriestrellas carrying the
five vowels, and thirteen illustrated scenes of children's games. This plan
puts the scenes on the eight game cards and the stars on the award screen.

## Problem

Two surfaces are drawn placeholders that have outlived their purpose.

**The map cards.** Every chapter's card is a single cut-out object borrowed
from the vocabulary library — a bee for `iniciales`, a die for `parejas`, a
camera for `album`. The objects mean nothing about the games they open.
`styles.css` gives each card a 4:3 rectangle "because a rectangle is the shape
that gives an illustration the most of itself", and then puts a bee in it.

**The star.** `StarIcon` in `apps/player-web/src/app/icons.tsx` is a five-point
polygon in one flat yellow. The product calls the thing a *letriestrella* — a
letter-star — and the drawn one has no letter.

## What the sources actually are

Neither set is vector art. Both are SVG wrappers around embedded rasters, which
is the case `scripts/import-world-art.mjs` was written for.

| Set | Wrapper | Size | Alpha |
|---|---|---|---|
| Five stars | one embedded JPEG each | 29–33 kB | none — opaque white ground |
| Thirteen scenes | 4–14 embedded PNGs each | 1–7 MB, 46 MB total | yes |

The stars are the `duende.svg` case exactly: one raster on flat white, which
the importer's border flood lifts to transparency without touching the white
*inside* the drawing.

The scenes are not. Several rasters composed by the SVG means there is no
single raster to unwrap, and they already carry alpha, so there is no ground to
lift.

Two facts about the supplied files that the import must not propagate:

- `LETRI-I.svg` draws a **U** and `LETRI.U.svg` draws an **I**. Import by what
  is drawn, not by filename.
- Five of the thirteen scenes are near-duplicates of another
  (1≈2, 4≈5, 7≈9, 10≈11, 12≈13). Eight are distinct at card size — including
  three fence scenes that differ only in how much of `CABALLO` is on the fence,
  which is the whole point of them.

Eight distinct scenes. The world has eleven nodes, of which the elf, the
illustrated story and the name book are not games. **Eight are.**

## Decisions this records

### The importer gains a render path, not a second importer

`rasterSource` finds the first `data:image/...;base64` in the SVG with a regex
and returns it. Handed a fourteen-layer scene it does not fail — it silently
emits one layer, which is a fence with no horse. That is a latent defect
independent of this change, and this change is what would trigger it.

The fix is one branch on how many embedded rasters the file has:

- exactly one → unwrap it, as today, which is lossless and cheap;
- more than one → hand the SVG to `sharp`, which rasterises the composition;
- none → still throw. Real vector art needs no import.

Verified: `sharp` renders all thirteen faithfully, alpha intact, at
4725×3544 from a 150 dpi density.

### A source that already carries alpha is not matted

The white flood exists to remove a photographic card, and a source with alpha
never had one. Running it anyway clears nothing, and the importer's
`clearedPixels === 0` guard would then reject a perfectly good file.

`scripts/import-vocabulary-images.mjs` already decides this exact way —
"Sources that already carry alpha are not matted at all". Mirror it rather than
inventing a flag.

### The scenes are characters, not scenes

Despite the name. `--scene` means a backdrop stretched across the display,
which keeps every pixel and is not trimmed because "its edges are the
composition". These are cut-outs on transparency that sit inside a 4:3 card
under `object-fit: contain`, so they take the character path: trimmed to their
content, 512 px, quality 82.

They are **not** run through `scripts/lib/normalise-ink-area.mjs`. That
normaliser makes a set of single objects read at one size beside each other;
these are compositions that fill their own frame, and equalising their ink
coverage would shrink the fence to the visual weight of a bee.

### The vowel is decoration, cycled by position

Which vowel a child gets says nothing about what they earned. It is variety in
the same sense as `cardTints`: a fact about where a star stands, not about the
star. Nothing reads the letter, every star is worth one, and no state anywhere
gains a vowel field.

This keeps the star's central property — the counter, the ring and the award
line all count a single undifferentiated thing.

### Art on the award screen, drawing in the counter and the flight

`icons.tsx` says the star is drawn rather than loaded because it "is on screen
the instant a game ends, and on a classroom panel's cold cache a picture that
arrives late would make the reward look like an afterthought". That reasoning
is sound and stays.

It applies with different force at different sizes. The award screen shows the
star large and alone; that is where the art's gradient and outline are the
reward. The counter pill and the flight arc render it near 24 px, where a heavy
black outline is mud and a crisp path is not.

So: `StarAward` in `App.tsx` draws the imported webps. `PrizeCount` and
`StarFlight` in `PrizeReadout.tsx` keep `StarIcon` unchanged.

The cold-cache worry is then answered by warming the five files at world load
rather than by not having them — five webps at roughly 6 kB each, fetched while
a child is still choosing a chapter, minutes before any game ends. The award
screen never waits on a network.

`icons.tsx`'s comment is rewritten in the same change to say why the drawn star
survives beside the art, rather than leaving a comment that reads as though the
art never arrived.

## The mapping

Eight scenes, eight game chapters, chosen for what the picture shows about the
game rather than by position:

| Chapter | Source | Committed | Depicts |
|---|---|---|---|
| Las iniciales | `6.svg` | `valla-vacia.webp` | empty fence, letters loose in the clouds |
| El bosque de parejas | `12.svg` | `perro-carta.webp` | dog, one card, three counters |
| ¿Cuál es? | `1.svg` | `pollito-burbujas.webp` | chick, three lettered bubbles |
| Las primeras letras | `7.svg` | `granero-letra.webp` | barn, one letter in the window |
| El puente de sílabas | `3.svg` | `valla-primeras.webp` | fence, the first letters placed |
| El taller de letras | `4.svg` | `valla-armada.webp` | fence, the word assembling |
| Empieza igual | `8.svg` | `granero-vaca.webp` | barn, second animal at the same door |
| Nuestro álbum | `10.svg` | `conejo-cartas.webp` | rabbit, four pictures in a grid |

`¿Cuál es?` gets the bubbles because three lettered bubbles beside one chick
*is* a choice among three. `El taller de letras` gets the fuller fence and `El
puente de sílabas` the emptier one, so the two adjacent chapters read as a
progression rather than as the same picture twice.

Named by what they depict, not by the chapter, so the provenance table stays
a record of pictures and a chapter can be re-pointed without renaming a file.

The elf, `El gallo Rayo` and `El libro de los nombres` keep their current
icons. None of these eight depicts a story or a book, and giving a book a
picture of a fence would be worse than the die it replaces.

The five stars commit as `letriestrella-a|e|i|o|u.webp`, in the same directory.

## Scope

1. `scripts/import-world-art.mjs`: the render path, the alpha-aware matting,
   and its usage line.
2. Thirteen imports run, eight scenes and five stars committed under
   `apps/player-web/public/world/`. No source SVG is committed — the importer
   is the provenance record, as it already states.
3. `apps/player-web/public/world/PROVENANCE.md`: the new files, their sources,
   the owner's rights attestation, and the processing paragraph amended to
   describe the multi-raster path. `scripts/check-privacy.mjs` requires this
   file to exist; it does not check that it is current, so this is on us.
4. `packages/template-catalog/src/world/index.ts`: eight `icon:` values.
5. `apps/player-web/src/app/App.tsx`: `StarAward` draws the art, cycling the
   vowel by list index.
6. `apps/player-web/src/app/icons.tsx`: comment rewritten. `StarIcon` itself is
   unchanged.
7. The five stars warmed at world load, by five `<link rel="preload" as="image">`
   tags in `apps/player-web/index.html`. Declarative, so nothing in React owns
   a cache; and it is the document that already decides what the player fetches
   before it runs.

## Verification

`apps/player-web/src/world/vocabularyAssets.test.ts` already covers most of
this and needs no change:

- "every chapter's map icon is actually served" fails on a typo'd path;
- "gives each chapter a picture of its own" fails if two chapters land on the
  same scene;
- the ink-coverage suite reads `public/vocabulary` only, so the scenes are
  correctly outside it.

New tests:

- `StarAward` renders `amount` stars and cycles the vowel — the existing
  `App.test.tsx` already asserts the count and the "¡+n letriestrellas!" line,
  so this extends rather than duplicates.
- An orphan check over `public/world/`, mirroring the vocabulary one. The
  directory is about to go from one file to fourteen, and an unreferenced webp
  is weight shipped to a panel over a school network.

Then `pnpm check` and `pnpm test:e2e`, the latter because the change touches
the player.

## Not in scope

The five near-duplicate scenes. They are kept out of the repository entirely
rather than committed against a future chapter: a second fence nobody points at
is an orphan, and the orphan check added here would fail on it.

Personalisation. These are product-authored defaults like every other asset in
`public/`, and no slot overrides a map icon or a star.

Any vowel that means something. See the decision above; a star that carried
state would need it in `prizeStore`, in the counter, and in the ring, and none
of those want it.
