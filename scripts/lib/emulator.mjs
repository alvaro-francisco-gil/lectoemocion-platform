/**
 * Pure logic for driving an Android emulator from WSL2.
 *
 * The emulator runs on the Windows host; this repository lives in WSL2. That
 * split is the reason this file exists as anything more than a shell one-liner:
 * every device command has to go through Windows' own `adb.exe`, because WSL's
 * `adb` would start a second server that sees no devices at all and reports
 * "no devices" rather than "wrong adb" — a failure that reads as a broken
 * emulator and wastes an afternoon.
 *
 * Everything here is a pure function over strings so it can be tested without a
 * device. The process spawning, filesystem writes, and HTTP probes live in
 * `scripts/mobile-emulator.mjs`.
 */

/** The AVD this repository drives. Landscape tablet: the product's real shape. */
export const AVD_NAME = "LectoEmocion_Tablet";

/** Expo Go's package id, unchanged for years and stable across SDKs. */
export const EXPO_GO_PACKAGE = "host.exp.exponent";

/** Metro's port. Expo's default; nothing here needs it to be configurable. */
export const METRO_PORT = 8081;

/**
 * Ports tunnelled from the device back to this machine.
 *
 * `adb reverse` rather than the emulator's `10.0.2.2` host alias, for two
 * reasons. Expo's bundle loader only trusts `localhost` and rejects a
 * cross-network bundle URL outright. And `10.0.2.2` exists only inside an
 * emulator, so a configuration written that way stops working the moment a real
 * tablet is plugged in — whereas `localhost` means "the dev machine" on both.
 *
 * It also lets the player's dev server stay bound to loopback. Reaching a phone
 * over the LAN would otherwise mean exposing it to the whole network.
 */
export function reversedPorts(playerPort) {
  return [
    { port: METRO_PORT, purpose: "Metro, so Expo Go can fetch the JS bundle" },
    { port: playerPort, purpose: "the player's dev server, loaded in the WebView" }
  ];
}

/**
 * Serials of devices ready to accept commands.
 *
 * States other than `device` — `offline`, `unauthorized`, `booting` — are
 * deliberately excluded: a command sent to one of those hangs rather than
 * failing, which is the worse outcome.
 */
export function parseAttachedDevices(adbDevicesOutput) {
  return adbDevicesOutput
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("List of devices"))
    .map((line) => line.split(/\s+/))
    .filter((fields) => fields[1] === "device")
    .map((fields) => /** @type {string} */ (fields[0]));
}

/** Whether `getprop sys.boot_completed` says the system is up. */
export function bootCompleted(getpropOutput) {
  return getpropOutput.replace(/\r/g, "").trim() === "1";
}

/** Whether a package id appears in `pm list packages` output. */
export function packageInstalled(pmListOutput, packageId) {
  return pmListOutput
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .includes(`package:${packageId}`);
}

/**
 * The deep link that points Expo Go at a Metro server.
 *
 * Expo Go accepts `exp://host:port` directly, so no URL encoding dance is
 * needed — unlike the development-client scheme, which nests the target as a
 * query parameter.
 */
export function expoGoDeepLink(metroPort = METRO_PORT) {
  return `exp://localhost:${metroPort}`;
}

/**
 * A fresh AVD's `config.ini`.
 *
 * Written from scratch rather than cloned from an existing AVD. Cloning is the
 * obvious move and it is wrong here: a used AVD's `userdata` image had grown to
 * twelve gigabytes, all of it another project's accumulated state, and copying
 * it would have bought a slower boot and a dirtier device. The emulator creates
 * its own `userdata` on first boot, so a new AVD costs a kilobyte of text.
 *
 * There is no `hw.device.name`. Device profiles come from `devices.xml`, which a
 * Windows-only SDK install without `cmdline-tools` does not necessarily have;
 * an explicit resolution and density need no profile and cannot go stale.
 */
export function avdConfig({
  name = AVD_NAME,
  displayName = "LectoEmocion Tablet",
  /*
   * 1920x1200 at hdpi is 1280x800 in density-independent pixels — an ordinary
   * large Android tablet, and close to the 1080p logical resolution ADR 0003
   * fixes for the classroom panel. Rendering at the target's shape is the whole
   * point of not reusing the phone AVDs already on this machine.
   */
  width = 1920,
  height = 1200,
  density = 240,
  /*
   * 4 GB. The phone AVDs here have 2 GB, which is genuinely representative of
   * the cheap hardware that evicts a backgrounded WebView — a case worth
   * testing deliberately later, on its own AVD, rather than tripping over now.
   */
  ramMb = 4096,
  heapMb = 512,
  cores = 4,
  systemImage = "system-images\\android-35\\google_apis_playstore\\x86_64\\",
  target = "android-35"
} = {}) {
  /* Sorted, because the emulator rewrites this file and a stable order keeps a
   * hand-written config diffable against one the tools have touched. */
  const entries = {
    AvdId: name,
    "PlayStore.enabled": "true",
    "abi.type": "x86_64",
    "avd.ini.displayname": displayName,
    "avd.ini.encoding": "UTF-8",
    /* Sparse: it is a ceiling, not an allocation. */
    "disk.dataPartition.size": "6442450944",
    "fastboot.forceColdBoot": "no",
    "fastboot.forceFastBoot": "yes",
    "hw.accelerometer": "yes",
    "hw.audioInput": "yes",
    /* Story narration is not optional content — the device must have output. */
    "hw.audioOutput": "yes",
    "hw.battery": "yes",
    /* The shell will own camera and microphone; the AVD should be able to. */
    "hw.camera.back": "virtualscene",
    "hw.camera.front": "emulated",
    "hw.cpu.arch": "x86_64",
    "hw.cpu.ncore": String(cores),
    "hw.dPad": "no",
    "hw.gps": "yes",
    /* Phaser needs WebGL, which needs a GPU path. Software rendering drops the
     * frame rate below the bar ADR 0003 sets, and reads as stutter to a child. */
    "hw.gpu.enabled": "yes",
    "hw.gpu.mode": "auto",
    "hw.initialOrientation": "landscape",
    "hw.keyboard": "yes",
    "hw.lcd.density": String(density),
    "hw.lcd.height": String(height),
    "hw.lcd.width": String(width),
    "hw.mainKeys": "no",
    "hw.ramSize": String(ramMb),
    /* No SD card: nothing here writes to external storage, and it is disk. */
    "hw.sdCard": "no",
    "hw.sensors.orientation": "yes",
    "hw.sensors.proximity": "no",
    "hw.trackBall": "no",
    "image.sysdir.1": systemImage,
    "runtime.network.latency": "none",
    "runtime.network.speed": "full",
    /* No device frame: the emulator window is a viewport, not a product shot. */
    showDeviceFrame: "no",
    "skin.dynamic": "yes",
    "skin.name": `${width}x${height}`,
    "skin.path": `${width}x${height}`,
    "tag.display": "Google Play",
    "tag.id": "google_apis_playstore",
    target,
    "vm.heapSize": String(heapMb)
  };

  return `${Object.entries(entries)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")}\n`;
}

/** The `<name>.ini` beside the `.avd` directory, which points the tools at it. */
export function avdIni({ name = AVD_NAME, avdDirWindowsPath, target = "android-35" }) {
  return [
    "avd.ini.encoding=UTF-8",
    `path=${avdDirWindowsPath}`,
    `path.rel=avd\\${name}.avd`,
    `target=${target}`,
    ""
  ].join("\n");
}

/**
 * Metro's arguments, defaulting the host to `localhost`.
 *
 * Expo defaults to advertising the machine's LAN address. On this setup that
 * fails: Expo Go reports `java.io.IOException: Failed to download remote
 * update`, which names neither the address it tried nor the Windows firewall
 * that dropped it. `adb reverse` already tunnels the port, so `localhost` is
 * reachable, needs no firewall exception, and works identically over USB.
 *
 * An explicit host choice always wins — `--tunnel` is the real escape hatch
 * when a device is not on this machine at all.
 */
export function metroArgs(extraArgs = []) {
  const chosen = extraArgs.some(
    (argument) =>
      argument.startsWith("--host") ||
      argument === "--localhost" ||
      argument === "--lan" ||
      argument === "--tunnel"
  );
  return chosen ? [...extraArgs] : ["--localhost", ...extraArgs];
}

/**
 * Interfaces that exist on this machine and never reach a phone.
 *
 * Container bridges, VPN tunnels, and Hyper-V switches all hold ordinary-looking
 * private addresses. `172.20.144.1` on `vEthernet (Default Switch)` is
 * indistinguishable from a real LAN address by its octets alone.
 */
const VIRTUAL_INTERFACE = /^(lo|docker|br-|veth|virbr|tun|tap|vEthernet|Tailscale|Bluetooth)/i;

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** Octets, or null if this is not a dotted-quad in range. */
function parseIpv4(address) {
  const match = IPV4.exec(address);
  if (!match) return null;
  const octets = match.slice(1).map(Number);
  return octets.every((octet) => octet >= 0 && octet <= 255) ? octets : null;
}

/**
 * RFC 1918 space — what a home or classroom router hands out.
 *
 * Requiring it rejects three traps at once, without naming any of them: the
 * `169.254/16` address a WiFi adapter keeps when it has no DHCP lease, the
 * `100.64/10` carrier-grade NAT space Tailscale uses, and any public address,
 * which must never be advertised as a dev server.
 */
function isPrivateLan([a, b]) {
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return a === 192 && b === 168;
}

/**
 * The address a phone on the same network uses to reach this machine.
 *
 * Expo's own `--lan` picks an adapter heuristically, and on a machine with a
 * Tailscale tunnel, two container bridges, a Hyper-V switch and a leaseless
 * WiFi adapter it will happily advertise one that routes nowhere. The failure
 * is a QR code that scans correctly and then dies inside Expo Go with a message
 * naming neither the address it tried nor why it was unreachable.
 *
 * So this never guesses. Exactly one surviving candidate resolves; anything
 * else is a stated failure listing what was considered. `MOBILE_LAN_HOST` is
 * the escape hatch, and it wins outright — mirrored WSL networking and VPNs
 * both produce reachable addresses that are absent from this list.
 */
export function selectLanHost(interfaces, override) {
  if (override !== undefined) {
    if (!parseIpv4(override)) {
      return { kind: "unusable", problem: "override-invalid", candidates: [], rejected: [] };
    }
    return { kind: "resolved", host: override, label: "MOBILE_LAN_HOST" };
  }

  const candidates = [];
  const rejected = [];
  for (const entry of [...interfaces]) {
    if (entry.family !== "IPv4" || entry.internal) continue;
    const octets = parseIpv4(entry.address);
    const described = { host: entry.address, label: entry.name };
    if (octets && isPrivateLan(octets) && !VIRTUAL_INTERFACE.test(entry.name)) {
      candidates.push(described);
    } else {
      rejected.push(described);
    }
  }

  const [only] = candidates;
  if (only && candidates.length === 1) {
    return { kind: "resolved", host: only.host, label: only.label };
  }
  return {
    kind: "unusable",
    problem: candidates.length === 0 ? "none" : "ambiguous",
    candidates,
    rejected
  };
}

/**
 * The first candidate that is a *Windows* Android SDK.
 *
 * Existence is not the test. This machine has a Linux SDK in
 * `ANDROID_SDK_ROOT`, which exists, is a perfectly good SDK, and is the wrong
 * one: the emulator is a Windows process, so only Windows' `adb.exe` can see
 * it. Selecting on the presence of `adb.exe` is what distinguishes them, and
 * picking the Linux one instead produces "no devices attached" — a message
 * that blames the emulator for a mistake made here.
 *
 * `exists` is injected so this is testable without a filesystem.
 */
export function selectSdk(candidates, exists) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (exists(`${candidate}/platform-tools/adb.exe`)) return candidate;
  }
  return null;
}

/** `/mnt/c/Users/x` → `C:\Users\x`. Used only for values Windows tools read. */
export function toWindowsPath(wslPath) {
  const match = /^\/mnt\/([a-z])\/(.*)$/.exec(wslPath);
  if (!match) {
    throw new Error(
      `Not a Windows-backed path: ${wslPath}. The AVD must live on the Windows filesystem, because the emulator that reads it is a Windows process.`
    );
  }
  const [, drive, rest] = match;
  return `${/** @type {string} */ (drive).toUpperCase()}:\\${/** @type {string} */ (rest).replace(/\//g, "\\")}`;
}

/**
 * The one check that catches the trap this repository already knows about.
 *
 * `apps/player-web` derives its port from the checkout so a worktree never
 * silently tests against the primary checkout's code. The same trap applies
 * here, and is worse: a WebView showing the wrong checkout's player looks
 * exactly like a working app. `/__checkout` is how the dev server names itself.
 */
export function checkoutMismatch({ expected, actual }) {
  if (expected === actual) return null;
  return [
    `The dev server on this port is serving a different checkout.`,
    `  expected: ${expected}`,
    `  serving:  ${actual}`,
    `→ Another checkout's 'pnpm dev' owns this port. Stop it, or run this from that checkout.`
  ].join("\n");
}

/**
 * Failures an adult can act on, per invariant 6.
 *
 * Each names the thing to run next. A message that only says "no" costs a round
 * trip to work out what "yes" would have been.
 */
export function problem(kind, detail = {}) {
  switch (kind) {
    case "no-sdk":
      return [
        "Android SDK not found on the Windows host.",
        `  looked in: ${(detail.searched ?? []).join(", ")}`,
        "→ Install it via Android Studio, or set ANDROID_SDK_ROOT to its path."
      ].join("\n");
    case "no-adb":
      return [
        `adb.exe not found at ${detail.path}.`,
        "→ Install 'Android SDK Platform-Tools' from Android Studio's SDK Manager."
      ].join("\n");
    case "no-emulator":
      return [
        `emulator.exe not found at ${detail.path}.`,
        "→ Install 'Android Emulator' from Android Studio's SDK Manager."
      ].join("\n");
    case "no-system-image":
      return [
        `System image not found at ${detail.path}.`,
        "→ Install 'Android 35 · Google Play · x86_64' from Android Studio's SDK Manager."
      ].join("\n");
    case "no-device":
      return [
        "No emulator attached.",
        `→ Run 'pnpm mobile:boot' to start ${AVD_NAME}.`
      ].join("\n");
    case "boot-timeout":
      return [
        `${AVD_NAME} did not finish booting within ${detail.seconds}s.`,
        "→ Check the emulator window on the Windows desktop for an error."
      ].join("\n");
    case "player-down":
      return [
        `The player's dev server is not answering on port ${detail.port}.`,
        "→ In another terminal, from the repository root: pnpm dev"
      ].join("\n");
    case "metro-down":
      return [
        `Metro is not answering on port ${METRO_PORT}.`,
        "→ In another terminal, from the repository root: pnpm mobile:start"
      ].join("\n");
    case "lan-host-unknown":
      return [
        "No usable LAN address on this machine.",
        ...(detail.rejected ?? []).map((entry) => `  rejected: ${entry.host} (${entry.label})`),
        "→ Connect to the network the phone is on, then retry. If the address is",
        "  one this cannot see — a VPN, or mirrored WSL networking — set it",
        "  explicitly: MOBILE_LAN_HOST=<address> pnpm mobile:lan"
      ].join("\n");
    case "lan-host-ambiguous":
      return [
        "More than one LAN address — refusing to guess which one the phone can reach.",
        ...(detail.candidates ?? []).map((entry) => `  ${entry.host} (${entry.label})`),
        "→ Pick the one on the phone's network:",
        "  MOBILE_LAN_HOST=<address> pnpm mobile:lan"
      ].join("\n");
    case "lan-host-invalid":
      return [
        `MOBILE_LAN_HOST is not an IPv4 address: ${detail.host}`,
        "→ Use a dotted quad, such as 192.168.1.186. A hostname will not do:",
        "  it is baked into the JS bundle and resolved on the phone, not here."
      ].join("\n");
    case "player-dev-exited":
      return [
        "The player's dev server exited instead of starting.",
        `Its output is above; the usual cause is that port ${detail.port} is`,
        "already taken by a 'pnpm dev' from an earlier session.",
        "",
        `→ Stop that one — Ctrl+C in its terminal — and run this again.`,
        `  To find it:  ss -ltnp | grep ${detail.port}`
      ].join("\n");
    case "player-not-on-lan":
      return [
        `The player's dev server is not reachable at http://${detail.host}:${detail.port}.`,
        "Two things cause this, and from the phone both look like a blank screen:",
        "",
        "  1. It is bound to loopback. Check the 'Local:' line Vite printed",
        `     above — if it says 127.0.0.1 rather than ${detail.host}, then`,
        "     PLAYER_HOST did not reach it. Turbo runs tasks in strict env mode,",
        "     so it must be listed in turbo.json's 'dev' passThroughEnv.",
        "",
        "  2. The Windows firewall is dropping the port. In an *Administrator*",
        "     PowerShell, once:",
        `       New-NetFirewallRule -DisplayName "LectoEmocion player WSL" \``,
        `         -Direction Inbound -Action Allow -Protocol TCP \``,
        `         -LocalPort ${detail.port} -Profile Any`,
        "",
        "     `-Profile Any` deliberately. Windows classifies most wired and",
        "     unfamiliar networks as *Public*, so a rule scoped Private is",
        "     accepted, listed, and never matches — which looks identical to",
        "     having no rule at all. Check with:",
        "       Get-NetConnectionProfile | Select Name,NetworkCategory",
        "",
        "→ Rule out (1) first: it costs nothing and needs no administrator."
      ].join("\n");
    case "expo-go-missing":
      return [
        "Expo Go is not installed on the emulator.",
        "→ Run 'pnpm mobile:start', then press 'a' in that terminal. Expo installs",
        "  Expo Go itself, which avoids pinning a download URL that goes stale."
      ].join("\n");
    default:
      throw new Error(`Unknown problem: ${kind}`);
  }
}
