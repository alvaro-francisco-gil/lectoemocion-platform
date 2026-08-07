# Parents area

## Why this document exists

The profile drawer shows a **Zona de adultos** row, disabled and marked
*próximamente*. That row is a promise, and this is what it promises. A disabled
row with no plan behind it is debt parked in the interface, which the
repository contract forbids.

## Problem

Everything an adult can currently change lives in one drawer with the thing a
child uses to pick their own face. That is the right home for profiles and the
wrong home for everything else: as settings accumulate, a child looking for
their own avatar has to walk past them.

The adult gate in `src/app/AdultGate.tsx` already exists, already guards add,
edit and delete, and is deliberately built to be reusable — it takes the whole
screen and knows nothing about what is behind it. A parents area is the room
that gate should open onto, rather than a gate re-asked per control.

## What would plausibly live there

- Personalisation: a child's photo, their pronunciation recording, their
  verified initial. All of it gated on a deployment's privacy artefacts being
  complete, per the product rule that personalisation is enabled per
  deployment.
- Progress reports — see `progress-reports.md`.
- Deletion of a child and everything attached to them, as a product capability
  rather than an operational afterthought.
- Sound, and whatever accessibility settings the player grows.
- Account and subscription, once accounts exist.

## Open questions

1. **Does it deserve a screen, or is the drawer enough?** A second surface is
   only justified once there is more in it than the drawer can hold.
2. **How much of it can exist before accounts?** Personalisation uploads need
   storage, Rules, and a privacy review; sound settings need none of that. The
   answer probably splits this into two pieces shipping at different times.
3. **Is one adult gate enough for destructive operations?** Deleting a
   child from a parents area is heavier than renaming one from a drawer, and
   may want a stronger gate or a real credential once accounts exist.

## Not yet decided

Everything above. This is an idea, not a plan; nothing here is approved and no
part of it should be implemented from this document.
