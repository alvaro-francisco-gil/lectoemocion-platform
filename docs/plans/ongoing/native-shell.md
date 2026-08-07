# Native shell

## Status

- **Updated:** 2026-08-07
- **Stage:** Step 1 — Expo app hosting the player in a WebView
- **Branch:** `main`
- **Done:** `apps/mobile` scaffolded and rendering the player in a WebView;
  `playerUrl` resolver with 11 tests; scripted Android emulator workflow
  (`scripts/mobile-emulator.mjs`, 30 tests) that creates the AVD, tunnels the
  ports, and reports what is up; `LectoEmocion_Tablet` AVD created and booting
- **Next:** the four seams under "Native feel", and the offline-launch test
  [ADR 0009](../../decisions/0009-one-hosted-player.md) makes a release
  criterion
- **Blockers:** none.

Two things bit during that first run and are now fixed and covered by tests.
Metro's `disableHierarchicalLookup` was on, which is right for npm's flat
`node_modules` and wrong for pnpm, where a package's dependencies sit beside it
in the store — it failed with `Unable to resolve "expo-modules-core"`, which
reads as a broken install. And Expo's LAN default made Expo Go fetch over the
network and fail with `Failed to download remote update`; `--localhost` over the
`adb reverse` tunnel avoids the network entirely.
- **Handoff:** the hosted-versus-bundled decision is settled — see
  [ADR 0009](../../decisions/0009-one-hosted-player.md). Step 1 points at a dev
  server; a release build points the same variable at Firebase Hosting.

The earlier WSL2 NAT blocker recorded here is resolved: `.wslconfig` now sets
`networkingMode=mirrored`. It stopped mattering anyway — `adb reverse` tunnels
the ports from the device, so nothing has to traverse the LAN and the player's
dev server stays on loopback.

## Goal

Put the existing player on a physical phone, then grow that shell into the
native adult surface [ADR 0003](../../decisions/0003-runtime-and-animation.md)
describes: native UI owning authentication, group management, camera,
microphone, and upload, with the web player embedded inside it.

## Context

ADR 0003 is accepted but nothing native exists. The duplication boundary it
draws is **adult-facing versus child-facing**, not web versus native:

- everything a child touches is the web player, which runs in the panel's
  browser and inside a WebView on a phone — one implementation;
- everything an adult touches is native on phone and tablet.

The only layer that duplicates is therefore the adult UI's *view* layer. The
agreed approach (option A) is to duplicate that view layer and nothing else:
every hook, validator, service call, and state machine is pushed down into
`packages/` so each platform's screen is thin markup over shared logic.

That choice is what makes step 1 cheap. `apps/mobile` needs **no workspace
dependency at all** to host the player, which also sidesteps the known
friction between Metro and pnpm's symlinked `node_modules`.

## Design

```text
apps/mobile/
  app.json            Expo config
  index.ts            entry, registers the root component
  App.tsx             the shell: today a full-screen WebView
  metro.config.js     monorepo-aware Metro (watch the repo root)
  playerUrl.ts        resolves and validates the player URL
  playerUrl.test.ts
  vitest.config.ts

scripts/
  mobile-emulator.mjs     the CLI: doctor, boot, wire, open, up, shot, logs
  lib/emulator.mjs        pure logic — no spawning, no filesystem
  lib/emulator.test.ts
```

The emulator work splits that way for the same reason `rules.mjs` and
`rules.test.ts` do: the decisions worth protecting are string-shaped — which SDK
qualifies, which device states are usable, what a fresh AVD's `config.ini` says
— and each is testable without a device attached.

`playerUrl.ts` is the only logic in step 1, and it exists because of invariant
6: a missing or malformed player URL must fail closed with an adult-facing
error rather than render a blank white screen a parent cannot diagnose.

The player URL comes from `EXPO_PUBLIC_PLAYER_URL`, which `pnpm mobile:start`
derives from the checkout rather than reading from a file. The player's port is
already derived per checkout so a worktree never tests against the primary
checkout's code; a `.env` holding a fixed port would reintroduce that, and a
WebView showing another checkout's player looks exactly like a working app.

The device reaches it through `adb reverse`, not over the LAN. Expo's bundle
loader rejects a cross-network bundle URL, so the emulator's `10.0.2.2` alias
cannot serve Metro at all — and that alias does not exist on real hardware, so
anything written that way breaks the first time a tablet is plugged in.
Tunnelling makes `localhost` correct on both, and keeps the dev server on
loopback instead of exposing it to the network. `PLAYER_HOST` on
[`apps/player-web/vite.config.ts`](../../../apps/player-web/vite.config.ts)
remains for the LAN case, unused by this workflow.

Expo Go runs this without a native build: `react-native-webview` is one of the
libraries it bundles. No EAS account, no store credentials, no Xcode.

## Tasks

- [x] Plan recorded here.
- [x] `PLAYER_HOST` in the player's Vite config, defaulting to `127.0.0.1`.
- [x] `playerUrl.ts` with a failing test first: rejects missing, non-absolute,
      and non-`http(s)` values; accepts a LAN origin.
- [x] `apps/mobile` Expo app rendering the player full-screen, with an
      adult-facing error state when the URL is unusable or the WebView fails
      to load.
- [x] Scripted emulator workflow: `scripts/mobile-emulator.mjs` plus the pure
      logic and tests in `scripts/lib/emulator.mjs`.
- [x] Verified in the Android emulator via Expo Go: the map hub renders
      full-screen in landscape, and "El encuentro" plays through to its reward
      screen. Touch input, progression, and the star counter all work.
- [ ] Verified on physical hardware. Same commands — `adb reverse` makes
      `localhost` mean the dev machine over USB too.

## Verification

- `pnpm check` passes, including all five guardrails.
- `pnpm test` covers `playerUrl`.
- Manual: the world map and at least one minigame are playable on a phone
  through Expo Go.

Deliberately no Playwright coverage: the shell is a WebView around an already
end-to-end-tested player, and Playwright cannot drive Expo Go.

## Native feel

The embedded player is close to indistinguishable from native, but only at four
seams, and only if each is worked on deliberately. Recorded here so they are
scheduled rather than rediscovered late. None is in scope for step 1.

1. **Cold start into the player.** Native screen → WebView boot → Phaser init →
   assets. The most "this is a website" moment in the product. Bundling the
   player removes the network from it; keeping the WebView warm rather than
   mounting per navigation removes the rest; a native transition covers what is
   left.
2. **Backgrounding on cheap hardware.** Under about 2 GB the OS evicts the
   WebView, and the child returns to a reload. Progress must persist
   continuously and resume must be a tested path, not a discovery.
3. **Gesture collisions.** Scroll, zoom, and bounce are already off in
   `App.tsx`. The hardware back button and iOS edge-swipe are not, and either
   yanking a child out mid-game is exactly the tell.
4. **Audio.** Unlock rules, ducking, the iOS silent switch, Android latency.
   Narration is not optional content, and this is fiddlier in a WebView than
   natively.

The standing risk is that "it needs to feel more native" becomes an argument for
reimplementing minigames natively. That trades a solvable polish problem for an
unbounded content-duplication one, and the whole architecture exists to avoid it.

## Open questions

1. ~~Hosted or bundled player.~~ **Settled** by
   [ADR 0009](../../decisions/0009-one-hosted-player.md): one hosted player,
   cached on the device, with no bundled copy in the shell. The shell keeps
   pointing at `EXPO_PUBLIC_PLAYER_URL`; only its value changes between a dev
   server and Firebase Hosting. Offline launch after a first successful launch
   becomes a release criterion with a test.
2. **Does the adult panel ever run on the classroom display itself?** If it
   never does, the aged-browser objection to React Native Web disappears and
   option B becomes the better call for the adult UI. Product question.

## Not in scope

Authentication, roster management, camera, microphone, upload, consent, and
progress synchronisation. All of those need `packages/firebase/`, which does
not exist. Step 1 is the embedding seam and nothing else.

Also out of scope: moving
[`worldView.ts`](../../../apps/player-web/src/world/worldView.ts) and
[`progressStore.ts`](../../../apps/player-web/src/world/progressStore.ts) into
a shared `packages/world/`. They are already DOM-free and already abstracted
for Firestore, and native will need them — but that is a refactor, and it does
not belong inside this feature.
