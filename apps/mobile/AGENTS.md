# Native shell

The Expo shell for phones and tablets. It hosts the web player in a WebView.
See [ADR 0003](../../docs/decisions/0003-runtime-and-animation.md) and
[the plan](../../docs/plans/ongoing/native-shell.md).

## The boundary this app exists to hold

The split is **adult-facing versus child-facing**, not web versus native:

- Everything a child touches — the map, the story, every minigame — belongs to
  [`apps/player-web`](../player-web/), which runs in the classroom panel's
  browser and inside this WebView from one implementation.
- Everything an adult touches — authentication, group management, camera,
  microphone, upload, consent — belongs here, natively.

**This app therefore contains no game logic, no progression, and no template
knowledge, and must not acquire any.** A feature that a child uses is a feature
that belongs in the player. If you find yourself reaching for a manifest or a
`Progress` here, the change is in the wrong app.

## Sharing rules

Duplication is confined to the *view* layer by deliberate choice. Hooks,
validators, service calls, and state machines go into `packages/` and are
imported by both surfaces; only the markup is written twice. Never copy a rule
into this app that the player also needs.

This app currently has **no workspace dependencies at all**, which is why Metro
needs no special handling for pnpm's symlinks beyond
[`metro.config.js`](metro.config.js). The first workspace import is the moment
that stops being free — expect to verify the bundler, not just the types.

## Environment

`EXPO_PUBLIC_PLAYER_URL` is required and validated by
[`src/playerUrl.ts`](src/playerUrl.ts); there is no default, because a WebView
with an unusable source renders a blank white page that an adult cannot tell
apart from a broken app. See [`.env.example`](.env.example).

Read it with **dot access**. Expo's Babel transform only inlines
`process.env.EXPO_PUBLIC_*` written that way, and `src/env.d.ts` exists so dot
access stays legal under `noPropertyAccessFromIndexSignature`.

## Assets

No icon or splash asset is committed yet. `scripts/check-privacy.mjs` requires a
`PROVENANCE.md` beside any image, and writing one for placeholder art would make
that guardrail decoration. Add both together or neither.

## Running it

Never start `expo start` yourself — it is a long-lived server the user owns. The
player's dev server must also be running, bound beyond loopback with
`PLAYER_HOST=0.0.0.0`.

Tests are plain Vitest over the shell's logic:

```bash
pnpm vitest run --project @lectoemocion/mobile
```

There is no Playwright coverage here. This is a WebView around an
already-end-to-end-tested player, and Playwright cannot drive Expo Go.
