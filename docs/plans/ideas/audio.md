# Audio

## Goal

One canonical audio format across the platform, one place each kind of sound
lives, a production pipeline for recording our own content, and an ingest
pipeline for adult-uploaded recordings that never serves what it was given.

## Context

Audio already exists, ad hoc and inconsistent.

- `El gallo Rayo` ships one `.m4a` per page, 31 files and about 5 MB, fetched a
  page at a time (`storyAssets.ts`, `renderIllustratedStory.ts`).
- `pronunciationUrl` on a character is a `.mp3` path under `/synthetic/`, and
  no file exists at any of those paths — see
  [default-artwork](default-artwork.md).
- There are no chrome sounds at all: nothing marks a tap, a correct answer, or
  a newly collected animal.
- There is no upload path. Adults recording a child's name is described in
  `platform-design.md` §7 and implemented nowhere.

So the platform has two audio formats for the same job, one of them pointing at
nothing, and the two features that will multiply the asset count — a sound
design pass and personalisation — have not landed yet. Deciding the format now
costs a rename; deciding it after costs a migration of user data.

## The three populations

These are different systems and must not share an abstraction.

**Chrome sounds** — tap, correct, wrong, unlock, collection fanfare. Not
content. They are the player's feel, exactly as `PAGE` in `storyPageFrame.ts`
is the story's look. A manifest carrying `sfx: "correct.m4a"` would be a
renderer decision inside an engine-neutral contract, which invariant 2 forbids.
They live in one player-side registry: a `SoundId` union, one file per id, and
a switch closed with `assertNever`, so adding a sound breaks compilation
everywhere that must handle it.

**Curated content audio** — narration, phoneme lessons, default pronunciations.
Manifest content. Versioned with the template, immutable once published
(invariant 5), and missing means fail closed (invariant 6).

**Uploaded audio** — an adult recording a child's name. Untrusted bytes,
private, deletable, and the one declared fallback exception, already expressed
by `resolveSlot`.

## Canonical format

**AAC-LC in an MP4/M4A container, mono, 48 kHz, 64 kbps** for everything that
carries speech or lasts about a second or more.

Opus is the better codec and is what a browser's `MediaRecorder` produces
natively, but Ogg/Opus support in Safari is recent and WebM/Opus decoding on
older iOS is unreliable. The target population is classroom panels with unknown
embedded browsers (`platform-design.md` §9) plus a WebView inside the Expo
shell. AAC in MP4 is the only container that decodes everywhere. A per-browser
format matrix would be both a silent fallback and a second source of truth for
every asset, so there is one format and no fallback chain.

**One exception: chrome sounds under one second are 16-bit PCM WAV, mono,
44.1 kHz.** AAC encoder priming inserts a few milliseconds of leading silence
and requires a decode pass; for a tap confirmation under a four-year-old's
finger that is the difference between responsive and mushy. A 200 ms WAV is
about 18 KB, so the size argument does not apply at that length.

| Role | Codec | Container | Channels | Rate | Budget |
|---|---|---|---|---|---|
| Chrome, < 1 s | PCM s16 | `.wav` | mono | 44.1 kHz | ≤ 40 KB, ≤ 1 s |
| Narration, phonemes | AAC-LC 64k | `.m4a` | mono | 48 kHz | ≤ 30 s/page |
| Default pronunciation | AAC-LC 64k | `.m4a` | mono | 48 kHz | ≤ 3 s |
| Uploaded pronunciation | AAC-LC 64k | `.m4a` | mono | 48 kHz | ≤ 5 s |

Everything, curated and uploaded alike, is normalised to **EBU R128, −16 LUFS
integrated, −1 dBTP true peak**. Without this a phone-recorded name is a
whisper next to studio narration and a teacher rides the volume all lesson.
Loudness is a property of the pipeline, not a mixing convention.

The stray `.mp3` in `slots.ts` and `defaultCharacters.ts` converges to `.m4a`
in the same change.

## Recording the curated audio

The narration is the product's voice. It is worth recording properly once, and
the constraints are unusually forgiving: mono speech at 64 kbps hides a lot,
and the room matters far more than the microphone.

**Room before gear.** Untreated rooms with parallel hard surfaces ruin takes in
a way no plugin recovers. A wardrobe of hanging clothes, or a corner with a
duvet behind and beside the reader, beats a good microphone in a kitchen. Kill
the fridge, the fan, and anything on the same circuit that clicks.

**Microphone.** A dynamic — an SM58, or a Shure MV7 if you want USB and no
interface — is the right choice in an imperfect room because it rejects
everything that is not directly in front of it. Reserve a condenser for a
treated space. Pop filter, mouth about 15–20 cm back and slightly off-axis so
plosives pass beside the capsule rather than into it.

**Capture settings.** 24-bit, 48 kHz, mono, peaking around −12 to −6 dBFS. No
compression, limiting, or noise reduction at record time — those are decisions
you cannot undo, and the pipeline applies them deterministically later. Record
ten seconds of room tone before the first take; it is the noise profile for the
whole session and costs nothing to have.

**Direction.** Warm, unhurried, a little slower than adult pace, with clean
final consonants and natural intonation — not the sing-song register adults
fall into around small children, which obscures exactly the phonemes the child
is learning to hear. Three takes of every line, slated, with the keeper noted;
re-booking a voice for four missed lines is the expensive failure mode.

**Phonemes specifically.** Record the sound, not the letter name: `/m/`, not
"eme". And no appended schwa — "muh" is the single most common defect in
Spanish phonics recordings and it actively breaks blending, because a child who
hears "muh-ah" cannot get to "ma". This is the one thing to be pedantic about
in the booth, since it cannot be fixed afterwards. Where a grapheme has two
sounds it gets two recordings, matching how `galloRayo.ts` already models `C`
as two lessons distinguished by `sound`.

**Masters and delivery are different things.** Keep 24-bit WAV masters in
project archival storage outside git — they are large and they are the source
of truth if the spec ever changes. Commit only the delivery `.m4a` under
`public/`, produced by a deterministic `scripts/import-audio.mjs` in the manner
of `import-story-pages.mjs`: high-pass at 80 Hz, gentle 2:1 compression, silence
trimmed to roughly 150 ms head and 300 ms tail so page turns feel tight, then
two-pass `ffmpeg loudnorm` to the target above. Hand-mastered files are not
reproducible and drift file by file.

**Rights.** A `PROVENANCE.md` beside the audio, recording the voice talent, the
date, and the signed release. `scripts/check-privacy.mjs` already requires one
for audio directories.

**Chrome sounds are not a recording session.** Licence or synthesise them, keep
them short and soft, and avoid harsh transients — panel speakers are loud, hard
and near a child's head. In particular the wrong-answer sound should be a
neutral soft tone rather than a buzzer: at ages 3–5 a punishing failure sound
teaches avoidance of the game, not of the mistake.

## Upload pipeline

The device gives whatever it wants — iOS `m4a`/AAC, Android `m4a` or `3gp`,
browser `MediaRecorder` `webm`/Opus. Client format is therefore unconstrained
input and the canonical format is a server-side output. A Function transcodes;
the player is never served the bytes that were uploaded.

1. Sniff the container by magic bytes. Never trust the extension or the
   client-supplied MIME type.
2. Reject over the hard duration cap before decoding.
3. Transcode to canonical AAC, trim silence, normalise loudness.
4. Strip container metadata — MP4 `udta` atoms carry device and sometimes
   location data.
5. **Delete the original.** Keeping it doubles the personal-data surface,
   complicates deletion, and buys nothing once the derived asset validates.
   Data minimisation, and the answer we would defend to a DPO.

Failure is adult-facing and corrective; an invalid recording never becomes
playable (`platform-design.md` §10). A child record with a failed upload falls
back to the slot default and keeps playing, which `resolveSlot` already gives
for free.

## Player-side design

**Unlock.** Every browser blocks autoplay until a gesture, and aged panel
WebViews are where this breaks. One explicit unlock point in the shell, not
each scene discovering it independently — otherwise the first story page plays
silently and reads as a content bug. This supersedes step 4 of
[default-artwork](default-artwork.md).

**Preload.** `storyAssets.ts` already draws a considered line: pictures up
front and fail closed, recordings a page at a time. Chrome sounds preload with
the shell and decode once; content audio keeps the existing rule. Writing this
down is the point, so the next template does not invent a third policy.

**Volume.** One mute control for an adult, persisted like progress. No per-sound
volume surface.

## Guardrail

`scripts/check-audio-assets.mjs`, with its rule in `scripts/rules.mjs` and its
test in `scripts/rules.test.ts`, asserting for every audio file the catalog
references:

- the file exists;
- codec, container, channel count and sample rate match the role's spec;
- duration is within the role's budget;
- integrated loudness is within tolerance of −16 LUFS;
- a `PROVENANCE.md` sits beside it.

Audio format drift is invisible until one device in one classroom fails to
decode. That is precisely the class of defect that needs a machine rather than a
reviewer.

## Open questions

1. **`ffmpeg` in a Function.** Cloud Functions v2 has no `ffmpeg` binary;
   options are a container image, a static binary bundled with the deployment,
   or `ffmpeg.wasm` (slower, but a 3-second mono clip is small work). Decide
   before the upload path starts.
2. **Does the guardrail shell out to `ffprobe`?** It is the only sane way to
   read codec and loudness, but it makes `pnpm check` depend on a system
   binary. Alternative: commit a checked-in manifest of measured properties
   produced by `import-audio.mjs`, and have the guardrail verify files against
   it — no binary, but it trusts the importer.
3. **Chrome sound set.** Which events actually get a sound is a design
   question, not a technical one, and the list should stay small.
4. **Who records.** The narration voice for `El gallo Rayo` already exists in
   the shipped app; whether new content matches that voice or re-records the
   book is a product decision with a rights dimension.
