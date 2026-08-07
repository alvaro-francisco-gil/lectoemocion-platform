# ADR 0009: One hosted player, cached on the device

Date: 2026-08-07  
Status: Accepted, contingent on the first-launch assumption (see "Revisit when")

Settles the question [ADR 0003](0003-runtime-and-animation.md) left open and
the native-shell plan deferred: where the player's files physically live when
the native shell runs them.

## Context

[ADR 0003](0003-runtime-and-animation.md) put one web player on every surface
and embedded it in a native shell on phones and tablets. It did not say whether
that shell fetches the player over the network or carries its own copy. The
shell now exists and points at a dev server, which is a development affordance
and answers nothing.

Four facts constrain the choice, and the first is decisive.

**The classroom panel cannot bundle anything.** ADR 0003 runs the player in the
panel's *browser*, because installing software on school hardware is a
vendor-management process rather than a download. That surface has no bundled
option, so a hosted player must exist regardless of what the native shell does.
The question is therefore not "hosted or bundled" but "does the shell load the
hosted player, or additionally ship a second copy of it".

**Default content is already inside the player build.** `apps/player-web/public/`
holds roughly 8.4 MB of story and vocabulary media, and manifests reference it
with root-relative URLs such as `/story/gallo-rayo/00.webp`. Bundling the player
therefore bundles the default content, and — because those URLs are
root-relative — a bundled player cannot be loaded from `file://`. It would need
a real local origin: `WebViewAssetLoader` on Android, a scheme handler on iOS.

**A child playing default content needs no network.** Gameplay, progression,
and the star counter are local. Sign-in needs the network once. Personalised
media needs it, and invariant 6 already falls back to default content when
personalised media is missing. Offline play is thus a property of *where the
files are*, not of what the player can do.

**The offline requirement is unknown.** No school has been observed. Whether a
pilot tablet reaches the network on setup day is a question stage 9a answers
and nobody can answer now.

## Decision

**One player artifact, hosted, loaded by every surface. The native shell ships
no copy of it.**

- The player is deployed to Firebase Hosting, as
  [ADR 0002](0002-firebase-backend.md) already assumed.
- The classroom panel loads it in a browser.
- The native shell loads the same origin in its WebView.
- The device caches it, so every launch after the first works without the
  network.

The consequence worth stating plainly: **the first launch after installing
requires a network connection.** Every launch after that does not.

### Why one copy rather than two

Two copies of one player means two origins, and an origin is precisely where
behaviour diverges silently. Authentication token injection, media URL
resolution, and content-security policy each acquire two implementations and
two sets of bugs, for a player that ADR 0003 exists to implement exactly once.
That is the same duplication this repository refuses everywhere else.

### Why this direction is the reversible one

With the offline requirement unknown, the decision should be the one that is
cheap to reverse. It is not symmetric:

- Hosted → bundled is **additive**. Add a build step and a local origin.
- Bundled → hosted is **subtractive after distribution**. A shipped bundled
  player has been store-reviewed and installed; removing it means supporting
  both paths until old installs age out.

Choosing hosted keeps the option open. Choosing bundled spends it.

### Caching is a release criterion, not an optimisation

"The device caches it" is the load-bearing half of this decision, so it is a
requirement with a test, not a hope about HTTP defaults. Offline launch after a
first successful launch must be verified on both platforms before any pilot.

One known constraint to resolve at implementation: iOS restricts service
workers in `WKWebView` to app-bound domains, which requires declaring
`WKAppBoundDomains` and in turn limits some WebView APIs. Android's WebView has
no equivalent restriction. If that limitation proves incompatible with what the
shell needs, the fallback is HTTP caching with long-lived immutable asset URLs
rather than a bundled player — and if neither suffices, this ADR is wrong and
the trigger below fires.

## Rejected alternatives

**Bundle the player in the app, host it separately for the panel.** Best cold
start, and works on a tablet that has never seen a network. Rejected because it
buys that with a permanent second origin, a store submission for every player
change, and a version-skew problem between a bundled player and a newer
manifest — all to solve an offline requirement nobody has yet measured. It
remains the correct answer if that requirement turns out to be real, which is
why it is a trigger below rather than a closed door.

**Bundle the engine, download content as data.** Superficially the best of
both: fast start, and new content without store review. Rejected because it
means building content delivery, cache invalidation, and staleness rules that a
web server already provides, and splitting the manifests' root-relative URLs
across two storage mechanisms. It is real work against a problem the product
does not yet have.

**Decide later.** Rejected because stage 7 connects the player to
authentication and progress, and token handling differs between a remote origin
and a local one. Deciding after that work means doing it twice.

## Consequences

- New templates and content reach every device by deploying, with no store
  review — which matters because the catalogue grows without bound.
- The panel and the tablet run the same bytes from the same origin, so a bug
  reproduces on both and a fix lands on both.
- Apple's guideline 4.2 exposure is unchanged and remains mitigated the way
  ADR 0003 intends: the shell earns its place in the store through native
  authentication, roster management, camera, microphone, and upload, not
  through the embedded player.
- A tablet that never reaches the network is not served. This is the accepted
  cost, and the trigger below is how it gets revisited.
- Cold start now depends on cache warmth, making the WebView's lifecycle —
  keeping it warm rather than mounting it per navigation — the main lever on
  perceived startup. See the native-shell plan's "Native feel" section.
- `EXPO_PUBLIC_PLAYER_URL` remains the seam. It points at a dev server in
  development and at Firebase Hosting in a release build; nothing else changes.

## Revisit when

- A pilot deployment cannot guarantee one networked launch per device at setup
  — schools that keep tablets permanently offline are the concrete case.
- Measured cold start over a cached load is unacceptable on target hardware and
  a warm WebView does not close the gap.
- iOS app-bound-domain restrictions make reliable offline caching impossible,
  and HTTP caching with immutable asset URLs proves insufficient.
- Store policy turns against a predominantly network-loaded embedded player —
  already listed under ADR 0003's own "Revisit when".
