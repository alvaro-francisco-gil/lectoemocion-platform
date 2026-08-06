# Native shell

## Status

- **Updated:** 2026-08-06
- **Stage:** Step 1 — Expo app hosting the player in a WebView
- **Branch:** `main`, uncommitted (additive scaffold; the root working tree
  carries substantial unrelated in-flight work that must survive)
- **Done:** `apps/mobile` scaffolded and rendering the player in a WebView;
  `playerUrl` resolver with 11 tests; `PLAYER_HOST` on the player's dev server;
  guardrails and typecheck green
- **Next:** verify on a physical phone — blocked below
- **Blockers:** **WSL2 NAT networking.** The dev host is WSL2 without mirrored
  networking (`hostname -I` gives `172.26.86.22`, a NAT address, and
  `.wslconfig` has no `networkingMode`). A phone on the LAN can reach neither
  the Vite dev server nor Metro. Fix by adding `networkingMode=mirrored` to
  `.wslconfig` and restarting WSL, or by port-proxying 4173 and 8081 from
  Windows. This is host configuration, not repository work.
- **Handoff:** the hosted-versus-bundled player decision is deliberately
  deferred — see "Open questions". Step 1 loads the dev server over the LAN,
  which is a development affordance and not the shipping answer.

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
```

`playerUrl.ts` is the only logic in step 1, and it exists because of invariant
6: a missing or malformed player URL must fail closed with an adult-facing
error rather than render a blank white screen a parent cannot diagnose.

The player URL comes from `EXPO_PUBLIC_PLAYER_URL`. In development that is the
Vite dev server on the LAN, which requires the dev server to bind beyond
loopback — hence the `PLAYER_HOST` addition to
[`apps/player-web/vite.config.ts`](../../../apps/player-web/vite.config.ts),
which keeps `127.0.0.1` as the default so existing e2e and worktree isolation
are unchanged.

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
- [ ] Verified on a physical phone via Expo Go. **Blocked on WSL2 networking —
      see Status.**

## Verification

- `pnpm check` passes, including all five guardrails.
- `pnpm test` covers `playerUrl`.
- Manual: the world map and at least one minigame are playable on a phone
  through Expo Go.

Deliberately no Playwright coverage: the shell is a WebView around an already
end-to-end-tested player, and Playwright cannot drive Expo Go.

## Open questions

1. **Hosted or bundled player.** Hosted means the growing template catalogue
   ships without a store review; bundled means the app works offline and
   avoids the store-policy risk ADR 0003 lists under "Revisit when". Step 1
   prejudges neither — it points at a dev server. This must be decided before
   anything ships.
2. **Does the adult panel ever run on the classroom display itself?** If it
   never does, the aged-browser objection to React Native Web disappears and
   option B becomes the better call for the adult UI. Product question.

## Not in scope

Authentication, roster management, camera, microphone, upload, consent, and
progress synchronisation. All of those need `packages/firebase/`, which does
not exist. Step 1 is the embedding seam and nothing else.

Also out of scope: moving
[`mapView.ts`](../../../apps/player-web/src/world/mapView.ts) and
[`progressStore.ts`](../../../apps/player-web/src/world/progressStore.ts) into
a shared `packages/world/`. They are already DOM-free and already abstracted
for Firestore, and native will need them — but that is a refactor, and it does
not belong inside this feature.
