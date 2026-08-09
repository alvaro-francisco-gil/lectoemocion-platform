# ADR 0014: Supplied art is rendered, not unwrapped

Date: 2026-08-09  
Status: Accepted

Distilled from the card-scenes-and-letriestrella-art plan, which shipped and
was verified on 2026-08-09.

Extends [ADR 0005](0005-content-pipeline-boundaries.md), which established that
an importer script *is* the provenance record for the asset it emits.

## Context

The repository owner supplies art as SVG files that are not vector art. Each is
a container for embedded rasters, and base64 inflates it by about a third: the
eight game scenes imported here arrived as 30 MB and ship as 264 kB.

`scripts/import-world-art.mjs` was written for the first such file, `duende.svg`,
which held exactly one embedded JPEG on a flat white ground. It found that
raster with a regex, lifted it out, flooded the white to transparency, trimmed,
and re-encoded. Unwrapping is cheaper than rendering and loses nothing — when
the container is inert.

Two files in this batch proved that "when" is the whole question, and that a
file does not announce which kind it is.

- Each letriestrella is **one** embedded JPEG — the star's body — with its
  vowel drawn beside it as a vector path. Unwrapping produced five identical
  stars with no letter on any of them.
- Each game scene stacks four to fourteen rasters. The regex took the first,
  which is a fence with no horse.

Neither failed. Both produced a plausible wrong picture, which is the failure
mode this repository is least able to catch: no exception, no broken image, and
a reviewer who has not seen the source has no way to know a letter is missing.

The second discovery was that the source cannot be asked what it is. The
obvious test — does an embedded layer carry alpha? — reads backwards on these
files, because they apply transparency with an SVG filter and every layer
inside a fully cut-out composition is an opaque PNG.

## Decision

**A container SVG is always rendered, never unwrapped**, whatever it holds.

Rendering is correct for every container. Unwrapping is an optimisation that is
only sound when the SVG adds nothing to the raster inside it, and nothing in
the file states that. A file with no embedded raster at all is still rejected:
it is real vector art, has nothing to gain from the importer, and would lose
its resolution independence.

**Whether to lift a background off is the flood's own answer, not a flag.**
`scripts/lib/remove-white-background.mjs` already declines a picture whose
border is not a flat card. Every character is offered the matte; a subject that
arrived cut out passes through untouched and reports zero cleared. This deleted
`import-world-art.mjs`'s own cruder copy of that flood, leaving one
implementation shared with `import-vocabulary-images.mjs`, so a picture is
matted by where it came from rather than by which importer it went through.

**The guard is on the outcome, not on the step.** "The flood cleared nothing"
is not a failure — it is the right answer for a cut-out source. What is a
failure is a character that comes out fully opaque, because that is a subject
still standing on its card, and the symptom on the map is one white rectangle
among ten cut-outs. The importer now asks the finished file, which catches that
however it arose.

## Consequences

A render costs more than an unwrap, and the render must be large enough to
survive the trim — `MIN_RENDER_EDGE` is four times the 512 an asset is emitted
at, derived from the document's own dimensions rather than fixed.

A committed file is reproducible only by whoever still holds the source it
names, because no source is committed. That was already true and is now stated
in `apps/player-web/public/world/PROVENANCE.md` rather than implied by a
sentence about re-running the importer.

Art that is correct-but-wrong remains the risk this cannot fully close. The
importer now refuses the one machine-detectable case; the rest is looking at
the result, which is what caught the letterless stars.
