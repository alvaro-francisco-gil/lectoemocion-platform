# ADR 0006: "Published" means reachable by a user

Date: 2026-08-05  
Status: Accepted

## Context

Invariant 5 says published template and manifest versions are immutable, and
`publishedVersions.test.ts` enforces it with pinned output. The invariant never
said what makes a version *published*.

Stage 3 forced the question. `name-story` and `initials-game` version 1 carried
`participants` built from child records and no default content, so they could
not play without a roster — the exact inversion the product forbids, since
personalisation is an enhancement and never a prerequisite. Fixing it changes
what those templates produce.

Read literally, the invariant said to carry version 1 forever beside a version
2 that supersedes it in every case: two validation paths, two renderer paths,
and a version no resource would ever use again, from the product's first month.

## Decision

A version is **published** once it is reachable by a user. Concretely, once any
of these is true:

- a manifest of that version can exist outside this repository — in a
  database, a file, a cache, or a device;
- a build containing it has been distributed to anyone outside the team;
- a running deployment can serve it.

Until then a version is an internal draft, and changing or deleting it breaks
nothing, because there is nothing to break.

`name-story` version 1 and `initials-game` version 1 met none of these
conditions. There is no backend, no stored manifest, no distributed build, and
no deployment. They are deleted rather than carried, and version 2 is pinned in
their place.

The vocabulary templates are untouched at version 1.

## What this does not license

This is not permission to edit a version because carrying it is inconvenient.
Once the stage 4 backend stores a manifest, or any build reaches a pilot
school, every version in it is published permanently — and from that point the
only correct response to a behaviour change is a new version.

The exemption is a property of this specific moment: pre-backend,
pre-distribution, pre-pilot. It expires on its own, and nothing needs to be
done to expire it.

## Consequences

- `publishedVersions.test.ts` pins version 2 of both roster templates. It is
  still the enforcement mechanism; only its subject moved.
- A future version bump carries the old version rather than replacing it,
  unless that version also fails every condition above.
- The definition is testable by inspection: "can a manifest of this version
  exist outside the repository?" is a question with a factual answer.

## Revisit when

- The stage 4 backend persists its first manifest. At that point this ADR
  becomes history rather than policy, and invariant 5 applies without
  exception.
