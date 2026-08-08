# Content-hashed media filenames

Status: idea. Not scoped, not scheduled.

## The problem

[ADR 0009](../../decisions/0009-one-hosted-player.md) makes offline launch a
property of caching — "the device caches it, so every launch after the first
works without the network" — and calls that "a release criterion, not an
optimisation". Hosting delivers that for the JavaScript and CSS, which Vite
content-hashes, so `firebase.json` serves `/assets/**` as `immutable` for a
year.

It does not deliver it for the media, which is the larger half. The roughly
8.4 MB under `apps/player-web/public/` keeps stable names — manifests reference
them as root-relative URLs like `/story/gallo-rayo/00.webp` — so they are served
on Firebase's default `max-age=3600`. A tablet opened the next morning
revalidates every story image before a child sees anything.

Setting `immutable` on them as they are would be worse than the default: a
corrected illustration would never reach a device that had already cached the
old one, with no way to force it short of a new path.

So the caching cannot be fixed in `firebase.json`. It needs the names to change
when the bytes change.

## Why this is not urgent

The pilot has not happened, no school has been observed, and ADR 0009 already
records the offline requirement as unknown. An hour-long revalidation on a
networked tablet costs a slow first screen, not a broken one. This becomes
release-blocking when a pilot date exists, and should be done before one.

## Roughly what it involves

- Hash media filenames at build time, leaving the authored names alone.
- Rewrite manifest URLs to the hashed names as part of that build, since
  manifests are engine-neutral and must not carry build details themselves.
- Extend `firebase.json` to serve the hashed media `immutable`.
- Extend `scripts/verify-deployment.mjs`, which today asserts caching only for
  `/assets/**`, to cover media too.

The open question is where the rewrite belongs so that
`packages/template-catalog` keeps authoring stable names and nothing downstream
learns about hashing. That is the part to design, and the reason this is an
idea rather than a ready plan.

## Related

- [ADR 0009](../../decisions/0009-one-hosted-player.md) — one hosted player,
  cached on the device
- [ADR 0005](../../decisions/0005-content-pipeline-boundaries.md) — content
  pipeline boundaries
