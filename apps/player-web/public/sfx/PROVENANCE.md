# Chrome sound provenance

The player's own sounds — a tap, a right answer, a chest opening. Not content:
these are the player's feel, in the way `PAGE` in `storyPageFrame.ts` is the
story's look, which is why they live in a player-side registry
(`src/audio/sounds.ts`) rather than in any manifest.

Every file here is output of `scripts/generate-chrome-sounds.mjs` and nothing
else. Re-run it to reproduce them; do not add or edit a sound by hand.

```bash
node scripts/generate-chrome-sounds.mjs
```

## Source and rights

**Synthesised from first principles.** No sample, recording, or licensed pack
was used, and no audio model generated any of it. Each sound is arithmetic —
sine partials with per-partial decay envelopes, and filtered noise from a seeded
generator — described in the script and rendered by it. There is nothing here
for anyone to claim.

`docs/plans/ideas/audio.md` allowed either licensing or synthesising these.
Synthesis was chosen for two reasons beyond rights. The set is *adjustable*:
disliking a sound is a constant to change and a re-run, not a search for a
replacement that must be re-cleared, re-normalised, and re-attributed. And it is
*reproducible*: the noise is seeded, so a clean checkout regenerates these exact
bytes, which is what lets `check-audio-assets.mjs` verify them rather than trust
them.

Should the product ever prefer a licensed set instead, Kenney's CC0 interface
and RPG packs (`kenney.nl`) cover this ground — public domain, no attribution
required. That would replace this file with a per-file licence record, and the
generator with an importer.

No recording was made, so no voice talent, release, or personal data is
involved. Nothing here carries child data.

## Files

Every sound is 16-bit PCM mono at 44.1 kHz, normalised to −16 LUFS with the true
peak held under −1 dBTP, and shorter than one second. `wrong` sits 3 LU quieter
by design — see below.

| File | Length | Size | Marks |
|---|---|---|---|
| `tap.wav` | 100 ms | 8.7 kB | A card or control taken |
| `select.wav` | 160 ms | 13.8 kB | A world node opened |
| `back.wav` | 140 ms | 12.1 kB | Leaving a screen |
| `correct.wav` | 360 ms | 31.1 kB | A right answer |
| `wrong.wav` | 300 ms | 25.9 kB | A wrong answer |
| `page-turn.wav` | 280 ms | 24.2 kB | A story page advancing |
| `star.wav` | 450 ms | 38.8 kB | One letriestrella landing |
| `chest-appear.wav` | 180 ms | 15.5 kB | A chest set down by the duende |
| `chest-open.wav` | 950 ms | 81.9 kB | The chosen chest opening |
| `reveal.wav` | 920 ms | 79.3 kB | The animal springing out |
| `fanfare.wav` | 980 ms | 84.5 kB | A resource finished |
| `unlock.wav` | 580 ms | 50.0 kB | A new chapter becoming playable |

About 470 kB in total, against the 5 MB of narration already shipping. They
preload with the shell and decode once, because a chrome sound that arrives
after the gesture it marks is worse than no sound.

## Two decisions worth keeping

**Uncompressed, on purpose.** AAC encoder priming inserts a few milliseconds of
leading silence and requires a decode pass. Under a four-year-old's finger that
is the difference between responsive and mushy, so chrome sounds are the one
declared exception to the platform's AAC-in-MP4 rule.
`check-audio-assets.mjs` also refuses any file that *begins* with silence, since
hand-introduced lead-in would give back the latency the format was chosen to
remove.

**`wrong.wav` is quiet and is not a buzzer.** A soft falling whole tone with no
transient to flinch at. At ages 3–5 a punishing failure sound teaches avoidance
of the game rather than of the mistake, so it sits 3 LU below everything else
and stays round rather than sharp.

## Why this directory carries a PROVENANCE.md

`scripts/check-privacy.mjs` requires one beside any photographic, audio, or
video file, so that an undocumented one is visible as either a privacy incident
or an asset whose usage rights nobody recorded.
