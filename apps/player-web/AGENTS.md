# Player

The player renders resource manifests. It runs in three places from one
codebase: the classroom display's browser, a desktop browser, and embedded
inside the mobile shell. See
[ADR 0003](../../docs/decisions/0003-runtime-and-animation.md).

## Layering

```text
src/app/      React shell — routing, resource selection, adult-facing UI
src/game/     the rendering adapter — the only place Phaser may appear
```

`scripts/check-engine-neutral.mjs` enforces that boundary. Phaser types must not
escape `src/game/` into the shell, shared packages, or manifests: the renderer
is replaceable at the cost of this adapter, and that only stays true if the
containment holds.

The shell never reaches into a scene, and a scene never reads application
state. They communicate through the manifest going in and completion events
coming out.

## Rendering rules

- **Render at a 1080p logical resolution** and let large panels upscale.
  Compositing a full 4K canvas is not achievable on typical panel hardware.
- **Interactive elements sit in the lower reach band.** A child aged 3–5 cannot
  touch the top of an 86-inch display. The upper area is for display only.
  Adult navigation may sit higher, but never where a child will hit it during
  play.
- **Audio unlocks on first gesture.** Every browser blocks autoplay; the unlock
  must be explicit and must survive an aged WebView.
- **Touch, stylus, and mouse map to the same semantic actions.** Never depend on
  hover.
- **End every switch over a manifest union with `assertNever`.** Adding a
  template kind must break compilation here, not silently render the wrong
  scene.

## Target hardware

The classroom display may run an old vendor Chromium on weak ARM hardware, with
no ability to update it. Assume constrained memory and modest fill rate.
Bundle size and cold start are product concerns, not micro-optimisations. The
supported fallback is a computer connected to the panel over HDMI and USB
touch, which gives a current desktop browser.

## Tests

- Component tests with Testing Library, colocated as `*.test.tsx`.
- Playwright end-to-end in `e2e/`, covering phone and classroom layouts.
- The phone project uses Chromium mobile emulation: this Linux host lacks the
  WebKit runtime libraries.

Run `pnpm test:e2e` from the repo root. Never start `pnpm dev` — that is a
long-lived server the user owns.
