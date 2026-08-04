# ADR 0003: Runtime, distribution, and animation authoring

Date: 2026-08-04  
Status: Accepted, contingent on classroom-panel verification (see "Revisit
when")

Supersedes the reopened parts of
[ADR 0001](0001-platform-foundations.md).

## Context

The product is a story world with animated chapters, a map hub, unlockable
minigames, and non-interactive personalised resources. It is sold to schools
and directly to families.

Three constraints shaped the decision:

- **Store presence is required.** The family market buys through the App Store
  and Play Store, so a purely browser-delivered product is not viable.
- **The classroom display is not our device.** Interactive panels run vendor
  Android builds, frequently without Google Mobile Services, with a browser on
  a system WebView that may be years old. Installing an application there is a
  vendor-management and school-IT process, not a download. The first target
  display is a TTL-branded panel — a smaller or OEM brand, which makes a stale
  browser more likely and offers no vendor application platform worth
  targeting.
- **A template must be implemented exactly once.** The catalogue grows without
  bound. Two runtimes would double every future unit of content and drift.

No prior implementation constrained the choice: the Godot prototype carries no
material sunk cost and is not a factor.

## Decision

### Runtime

One web player runtime, used on every surface.

- **Classroom display:** the player runs in the panel's browser, or in a
  browser on a computer connected to the panel by HDMI and USB touch. No
  installation is required on the panel.
- **Phone and tablet:** a native shell built with Expo and React Native, listed
  in the App Store and Play Store. Native UI owns authentication, group
  management, camera, microphone, upload, and navigation. The player runs
  embedded inside it.

Rationale for the split: delivery matches control of the hardware. The board
gets technology needing no installation permission; the phone and tablet get
technology needing it, because the user owns the device and installs willingly.

Rationale for embedding rather than reimplementing: the qualities lost to a
WebView are scroll physics, navigation transitions, and text input — all UI
chrome, all owned by the native shell here. A full-screen canvas has none of
them. The player is the one component where embedded web is close to
indistinguishable from native.

### Renderer

Phaser remains the renderer for now. It is implemented, tested, and isolated
behind the player adapter. It is not load-bearing: manifests stay
engine-neutral, so replacing it costs one adapter.

Render at a 1080p logical resolution and allow large panels to upscale.
Compositing a full 4K canvas is not achievable on typical panel hardware.

### Animation authoring

Two layers, kept separate.

- **Choreography** — scene timelines, sequencing, waits, transitions, and
  reactions to progress. Authored in **code**, using GSAP. This layer is
  permanent and is where non-specialists work.
- **Asset animation** — characters, creatures, and decorative motion. Authored
  as swappable assets. Simple sprite work and tweens initially; **Rive** when a
  dedicated animator joins.

A template declares scenes and timing; animation files are media. Replacing an
asset must never require rewriting choreography. Rive is preferred over Spine
for its free tier, dual web/native runtimes, small file sizes, state machines
suited to an interactive map, and behaviour on weak GPUs.

## Rejected alternatives

**Native everywhere, including an installed application on the board.** Highest
quality ceiling and a single implementation, but it depends on installation
being permitted on SMART iQ and then on every other panel brand. That is a
per-vendor deployment and update burden with no store to distribute through.

**Godot on tablets with a Godot web export on the board.** One engine, one
codebase, two export targets. Rejected because it puts a much heavier payload —
tens of megabytes of WebAssembly, longer cold start, more memory pressure — on
the same uncertain panel browser that the accepted option depends on, for a
benefit concentrated in UI chrome the native shell already provides. Its
strongest argument would have been existing team fluency, which does not exist.

**Capacitor wrapping the whole web application.** Cheaper, one codebase, store
presence. Rejected because it gives up native behaviour in exactly the
authoring flows — roster lists, camera, recording, forms — where that
behaviour is visible and was explicitly wanted.

**Browser-only delivery, including tablets.** Rejected: the family market
requires store presence.

## Consequences

- Gameplay is implemented once, as web.
- Board compatibility becomes a release criterion, and the panel's browser
  version is a real project risk.
- The connected-computer path is supported when a panel browser is inadequate,
  and may become the primary route on smaller-brand panels. It is not a
  degraded experience.
- The native shell owns all device capabilities; the player owns none.
- Cold start of the embedded player is slower than a native scene. Making the
  handoff from native UI into the player feel seamless is explicit work.
- Choreography written now survives the arrival of an animator.

## Revisit when

- The SMART panel probe shows a browser too old to run the player acceptably,
  and the connected-computer fallback proves unacceptable in practice.
- Measured animation, rendering, or asset-pipeline requirements exceed what the
  web renderer delivers on target hardware.
- Store policy blocks a predominantly embedded-web application.
- The classroom market outgrows the family market decisively, removing the
  store-presence requirement.
