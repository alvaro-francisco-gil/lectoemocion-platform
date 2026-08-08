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

This app currently has **no workspace dependencies at all**. The first workspace
import is the moment that stops being free — expect to verify the bundler, not
just the types.

Metro still needs [`metro.config.js`](metro.config.js) to resolve pnpm's layout,
and the setting that matters is the one that is *not* there: hierarchical lookup
stays enabled. pnpm puts a package's dependencies beside it inside the store, so
`expo` reaches `expo-modules-core` only by walking parent directories, and
`nodeModulesPaths` cannot substitute because the store path carries a content
hash. Disabling the walk fails with `Unable to resolve "expo-modules-core"`,
which reads as a broken install rather than a resolver setting.
[`src/metroConfig.test.ts`](src/metroConfig.test.ts) holds that.

Metro also caches resolution across restarts and does not invalidate on a config
change. After editing `metro.config.js`, restart with `--clear` or you will
debug a stale error.

## Environment

`EXPO_PUBLIC_PLAYER_URL` is required and validated by
[`src/playerUrl.ts`](src/playerUrl.ts); there is no default, because a WebView
with an unusable source renders a blank white page that an adult cannot tell
apart from a broken app. See [`.env.example`](.env.example).

`pnpm mobile:start` and `pnpm mobile:lan` set it for you, derived from the
checkout — loopback for the first, the LAN address for the second. Do not write
it into a `.env` instead: the player's port is derived per checkout so a worktree
never tests against the primary checkout's code, and a hardcoded file
reintroduces exactly that — a WebView showing another checkout's player is
indistinguishable from a working app.

Read it with **dot access**. Expo's Babel transform only inlines
`process.env.EXPO_PUBLIC_*` written that way, and `src/env.d.ts` exists so dot
access stays legal under `noPropertyAccessFromIndexSignature`.

## Assets

No icon or splash asset is committed yet. `scripts/check-privacy.mjs` requires a
`PROVENANCE.md` beside any image, and writing one for placeholder art would make
that guardrail decoration. Add both together or neither.

## Running it

Never start Metro yourself — it is a long-lived server the user owns.

Two terminals the user owns, then one command that is yours:

```bash
pnpm dev            # the player's dev server, on loopback
pnpm mobile:start   # Metro; press 'a' once to install Expo Go
pnpm mobile:up      # boot the AVD, tunnel the ports, open the player
```

A physical Android phone plugged in over USB needs nothing new: `boot` returns
the attached device rather than starting the AVD, so `pnpm mobile:up` wires the
phone exactly as it wires the emulator, and Expo Go opens by deep link. Shut the
emulator down first — `attachedDevice()` takes the first serial `adb` reports.

### A phone that is not plugged in

```bash
pnpm mobile:lan     # both servers on the LAN, then a QR code to scan
```

One command, because the two halves must agree on one address. Metro advertises
it in the QR and `EXPO_PUBLIC_PLAYER_URL` carries it into the bundle; when they
disagree the scan fails inside Expo Go with a generic error that names neither
half. `pnpm dev` is started by this command with `PLAYER_HOST=0.0.0.0`, so do
not also run it yourself.

The address is chosen by `selectLanHost`, not by Expo's `--lan`. This machine
offers a Tailscale tunnel, two container bridges, a Hyper-V switch and a WiFi
adapter with no DHCP lease — all plausible-looking, none reachable from a phone.
Exactly one candidate resolves; anything else stops with the list printed.
`MOBILE_LAN_HOST` overrides when the reachable address is one Node cannot see.

This mode puts the player's dev server on the local network, which the paths
above deliberately avoid. It is dev-only and serves product-authored default
content. **Do not use it on a deployment holding child media.**

The port also needs a one-time Windows firewall rule, and it must be scoped
`-Profile Any`. Windows classifies most wired and unfamiliar networks as
*Public*, so a rule scoped `Private` is created without complaint, appears in
`Get-NetFirewallRule`, and never matches — indistinguishable from no rule at
all, and it costs an evening. Confirm the classification with
`Get-NetConnectionProfile`. Remove the rule when the deployment no longer needs
it; `Any` includes networks this machine has not joined yet.

`pnpm mobile` alone is the doctor — it reports what is up, what is not, and what
to run about each. [`scripts/mobile-emulator.mjs`](../../scripts/mobile-emulator.mjs)
has the rest: `shot`, `logs`, `stop`.

### Why `adb reverse`, and why the dev server stays on loopback

`pnpm mobile:up` tunnels Metro's port and the player's port from the device back
to this machine, so `localhost` on the device means this machine.

That is not a convenience. Expo's bundle loader rejects a cross-network bundle
URL outright, so the emulator's `10.0.2.2` alias cannot serve Metro at all — and
that alias does not exist on real hardware, so anything written that way breaks
the first time a tablet is plugged in. `localhost` is correct on both.

It also means the player's dev server never leaves loopback on this path.
Reaching a device over the LAN means exposing it to the network, which is what
`PLAYER_HOST` is for and why it belongs to `pnpm mobile:lan` alone — never to
the emulator or USB workflow, where it would buy nothing.

### The emulator runs on Windows; this repository does not

Every device command must go through Windows' own `adb.exe`. WSL's `adb` starts
a second server that sees no devices and says "no devices attached", which reads
as a broken emulator rather than the wrong tool. The script selects an SDK by
looking for `adb.exe` inside it, so a Linux SDK in `ANDROID_SDK_ROOT` — this
machine has one — is skipped rather than silently preferred.

Tests are plain Vitest over the shell's logic:

```bash
pnpm vitest run --project @lectoemocion/mobile
```

There is no Playwright coverage here. This is a WebView around an
already-end-to-end-tested player, and Playwright cannot drive Expo Go.
