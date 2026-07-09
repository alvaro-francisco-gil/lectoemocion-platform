# Game and animated-story template guidelines

## Purpose

Templates turn private class-roster content into predictable, reviewed learning
experiences. They are deterministic product code, not teacher-authored scripts
and not AI output.

## Required separation

Every template has three independent layers:

1. **Pedagogy** — objective, target letters/sounds, success rules, and feedback.
2. **Content selection** — which roster records participate and in which roles.
3. **Presentation** — scenes, layout, animation, audio timing, and interaction.

A template must not fetch arbitrary data, access authentication state, or build
object-storage URLs. It receives a validated resource manifest from the player.

## Roster selection

A template explicitly selects one strategy:

- whole class;
- teacher-selected subset;
- fixed-size random subset;
- rotating subset;
- records matching a letter/sound;
- balanced distractor and target groups.

Random selection must be seedable so previews and classroom playback can be
reproduced. A template must define behaviour when too few compatible records
exist.

## Responsive design

- Use a logical coordinate system and responsive constraints, not device pixel
  offsets.
- Support 16:9 classroom displays first, then phone and tablet layouts.
- Keep essential controls within declared safe areas.
- Make touch targets suitable for children aged 3–5.
- Do not depend on hover; hover effects are optional enhancement.
- Support touch, stylus, and mouse through the same semantic actions.

## Media

- Treat names, photos, and recordings as private runtime assets.
- Never include real child media in source control, fixtures, screenshots, or
  analytics.
- Define aspect-ratio, resolution, duration, and file-size budgets.
- Provide graceful placeholder behaviour only in authoring preview; production
  playback fails closed when required private media is unavailable.
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
- schema and compatibility validation;
- deterministic tests for selection and game rules;
- keyboard/mouse fallback for testing and accessibility;
- phone, tablet, HD, and 4K layout coverage;
- missing-media and network-error behaviour;
- performance budgets;
- privacy-safe telemetry;
- teacher preview and exit paths.

