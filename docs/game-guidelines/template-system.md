# Game and animated-story template guidelines

## Purpose

Templates are predictable, reviewed learning experiences. They are
deterministic product code, not adult-authored scripts and not AI output.

Every template is fully playable with product-authored default content.
Adult-supplied names, photos, and recordings **override** those defaults slot by
slot. Personalisation is an enhancement, never a prerequisite.

## Resource kinds

A template declares exactly one kind:

- **cinematic** — a linear, non-interactive story chapter.
- **minigame** — interactive and rule-based.
- **non-interactive personalised resource** — a fixed animated timeline with
  uploaded pictures placed into it, rendered by the player at playback time.
  Never encoded as a file, never exportable, never shareable.

The map hub is not a template. It belongs to the player shell, because it reads
progress state that templates must not access.

## Required separation

Every template has three independent layers:

1. **Pedagogy** — objective, target letters/sounds, success rules, and feedback.
2. **Content binding** — which slots exist, their defaults, and which child
   records may override them.
3. **Presentation** — scenes, layout, animation, audio timing, and interaction.

A template must not fetch arbitrary data, access authentication state, read or
write progress, or build object-storage URLs. It receives a validated resource
manifest from the player and reports completion back to the shell.

## Default content

Every personalisable slot carries product-authored default art, text, or audio.

**A slot and its default are one object, not two parallel maps.** "Slot without
a default" must be a compile error, not a review comment or a test failure.
Model the slot so the default is a required field of it; a map of slots and a
separate map of defaults can disagree, and eventually will.

- A template with a slot lacking a default is incomplete and must not ship.
- Missing *personalised* media falls back to the default and playback
  continues.
- Missing *default* media is a product defect and fails closed.
- Defaults must be pedagogically sound on their own. A game whose defaults are
  filler is a game that fails for every user who has not uploaded anything.

## Content selection

When personalised records are available, a template explicitly selects one
strategy:

- whole group;
- adult-selected subset;
- fixed-size random subset;
- rotating subset;
- records matching a letter/sound;
- balanced distractor and target groups.

Random selection must be seedable so sessions can be reproduced. A template
must define how it fills remaining slots from defaults when too few compatible
records exist. Insufficient records never block playback.

## Responsive design

- Use a logical coordinate system and responsive constraints, not device pixel
  offsets.
- Support 16:9 classroom displays first, then phone and tablet layouts.
- Keep essential controls within declared safe areas.
- On large panels, keep interactive elements within the lower reach band, where
  a child aged 3–5 can physically touch them. The upper area is for display.
- Make touch targets suitable for children aged 3–5.
- Do not depend on hover; hover effects are optional enhancement.
- Support touch, stylus, and mouse through the same semantic actions.

## Media

- Treat names, photos, and recordings as private runtime assets.
- Never include real child media in source control, fixtures, screenshots, or
  analytics.
- Define aspect-ratio, resolution, duration, and file-size budgets that apply
  equally to default and personalised assets.
- Personalised media that is unavailable or deleted falls back to the default.
- Stop or transition all audio explicitly when scenes change.

## Interaction and feedback

- Every interaction must map to a named learning action.
- Incorrect answers use constructive feedback and must not shame or rank a
  child.
- Lives, scoring, timers, and leaderboards require pedagogical justification.
- Completion feedback must not infer ability from a single session.
- A teacher can exit or restart at any time.

## Versioning

Published template versions are immutable. Behaviour changes create a new
version. Playable resources pin their template and schema versions. Migrations
must be explicit and reversible until the old version is retired.

## Definition of done

A template is complete only when it has:

- reviewed learning objective;
- product-authored default content for every personalisable slot;
- schema and compatibility validation;
- deterministic tests for selection, binding, default fallback, and game rules;
- keyboard/mouse fallback for testing and accessibility;
- phone, tablet, HD, and 4K layout coverage;
- reach-band verification on large panels;
- missing-media and network-error behaviour;
- performance budgets;
- privacy-safe telemetry;
- teacher preview and exit paths.

