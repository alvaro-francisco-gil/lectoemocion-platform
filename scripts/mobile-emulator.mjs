#!/usr/bin/env node
/**
 * Drive the native shell on an Android emulator, from WSL2.
 *
 * The emulator is a Windows process and this repository is not, so every device
 * command goes through Windows' own `adb.exe`. WSL's `adb` would start a second
 * server, see no devices, and report "no devices attached" — which reads as a
 * broken emulator rather than the wrong tool, and costs an afternoon.
 *
 * Subcommands:
 *   doctor          What is up, what is not, and what to run about it.
 *   boot [avd]      Create the AVD if missing, launch it, wait for boot.
 *   wire            adb reverse: Metro and the player's dev server.
 *   open            Point Expo Go at Metro.
 *   up              boot + wire + verify + open. The one to reach for.
 *   start           Metro, with the environment Expo needs. Long-lived.
 *   shot [file]     Screenshot to a file. Defaults under the scratch dir.
 *   logs [seconds]  Filtered logcat: JS errors and WebView failures.
 *   stop            Shut the emulator down.
 *
 * The two long-lived processes — the player's dev server and Metro — are yours
 * to start and stop. Nothing here launches one in the background where you
 * cannot see it fail.
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// prettier-ignore
import { AVD_NAME, EXPO_GO_PACKAGE, METRO_PORT, avdConfig, avdIni, bootCompleted, checkoutMismatch, expoGoDeepLink, packageInstalled, parseAttachedDevices, problem, reversedPorts, selectSdk, toWindowsPath, metroArgs } from "./lib/emulator.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const BOOT_TIMEOUT_SECONDS = 240;

/* -- discovery ------------------------------------------------------------ */

/**
 * The Windows-side Android SDK.
 *
 * Searched rather than hardcoded: this script is checked in, and the next
 * machine to run it will not have this machine's user name in its paths.
 */
function findSdk() {
  const candidates = [process.env["ANDROID_SDK_ROOT"], process.env["ANDROID_HOME"]];
  for (const home of windowsUserDirectories()) {
    candidates.push(join(home, "AppData", "Local", "Android", "Sdk"));
  }
  const found = selectSdk(candidates, existsSync);
  if (!found) fail(problem("no-sdk", { searched: candidates.filter(Boolean) }));
  return found;
}

/** Every plausible Windows home directory, newest-looking first. */
function windowsUserDirectories() {
  const users = "/mnt/c/Users";
  if (!existsSync(users)) return [];
  return readdirSync(users, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(users, entry.name))
    .filter((home) => existsSync(join(home, "AppData")));
}

function findAvdHome() {
  const configured = process.env["ANDROID_AVD_HOME"];
  if (configured && existsSync(configured)) return configured;
  for (const home of windowsUserDirectories()) {
    const avd = join(home, ".android", "avd");
    if (existsSync(avd)) return avd;
  }
  /* Not a failure: `boot` creates it. Any Windows home will do. */
  const [first] = windowsUserDirectories();
  if (!first) fail(problem("no-sdk", { searched: ["/mnt/c/Users"] }));
  return join(first, ".android", "avd");
}

const SDK = findSdk();
const ADB = join(SDK, "platform-tools", "adb.exe");
const EMULATOR = join(SDK, "emulator", "emulator.exe");

/* -- the player's dev server ---------------------------------------------- */

/**
 * The port and identity of *this* checkout's dev server.
 *
 * Read from `playerServer.ts` rather than restated here. That file exists
 * because a worktree silently testing against the primary checkout's code is a
 * failure that reports success, and a second copy of the derivation in this
 * script would reintroduce exactly that. It is TypeScript, hence the child
 * process: type stripping is not on by default in the Node this repository
 * pins.
 */
function playerServer() {
  const source = join(ROOT, "apps", "player-web", "playerServer.ts");
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--no-warnings",
      "-e",
      `import(${JSON.stringify(source)}).then((m) => {
         const s = m.resolvePlayerServer(${JSON.stringify(join(ROOT, "apps", "player-web"))}, process.env.PLAYER_PORT);
         console.log(JSON.stringify({ port: s.port, checkoutId: s.checkoutId }));
       })`
    ],
    { encoding: "utf8" }
  );
  if (result.status !== 0) {
    fail(
      [
        "Could not work out which port this checkout's player dev server uses.",
        result.stderr?.trim() ?? "",
        "→ Run 'pnpm typecheck' — apps/player-web/playerServer.ts may not be loadable."
      ].join("\n")
    );
  }
  return JSON.parse(result.stdout.trim());
}

/* -- adb ------------------------------------------------------------------ */

function adb(args, { allowFailure = false, binary = false } = {}) {
  if (!existsSync(ADB)) fail(problem("no-adb", { path: ADB }));
  const result = spawnSync(ADB, args, {
    encoding: binary ? "buffer" : "utf8",
    maxBuffer: 64 * 1024 * 1024
  });
  if (!allowFailure && result.status !== 0) {
    const stderr = binary ? result.stderr?.toString() : result.stderr;
    fail(`adb ${args.join(" ")} failed:\n${(stderr ?? "").trim()}`);
  }
  return binary ? result.stdout : (result.stdout ?? "");
}

function attachedDevice() {
  const [serial] = parseAttachedDevices(adb(["devices"], { allowFailure: true }));
  return serial ?? null;
}

/* -- probes --------------------------------------------------------------- */

/** Whether something answers, without caring what it says. */
async function reachable(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function readCheckoutId(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/__checkout`, {
      signal: AbortSignal.timeout(2000)
    });
    if (!response.ok) return null;
    return (await response.text()).trim();
  } catch {
    return null;
  }
}

/* -- the AVD -------------------------------------------------------------- */

/**
 * Creates the AVD if it is missing.
 *
 * Written from scratch rather than cloned. Cloning is what the sibling
 * repositories do and it is wrong here: the AVDs already on this machine carry
 * a twelve-gigabyte `userdata` image of another project's state, and copying
 * one buys a slower boot, a dirtier device, and twelve gigabytes. The emulator
 * builds its own `userdata` on first boot.
 */
function ensureAvd(name) {
  const avdHome = findAvdHome();
  const avdDir = join(avdHome, `${name}.avd`);
  const iniPath = join(avdHome, `${name}.ini`);
  if (existsSync(avdDir) && existsSync(iniPath)) return { created: false, avdDir };

  const systemImage = join(
    SDK,
    "system-images",
    "android-35",
    "google_apis_playstore",
    "x86_64"
  );
  if (!existsSync(systemImage)) fail(problem("no-system-image", { path: systemImage }));

  mkdirSync(avdDir, { recursive: true });
  writeFileSync(join(avdDir, "config.ini"), avdConfig({ name }), "utf8");
  writeFileSync(
    iniPath,
    avdIni({ name, avdDirWindowsPath: toWindowsPath(avdDir) }),
    "utf8"
  );
  return { created: true, avdDir };
}

/**
 * Launches the emulator, detached.
 *
 * `Start-Process` rather than a backgrounded child, so the emulator survives
 * this script exiting and owns a normal window on the Windows desktop — the
 * place someone will look when it fails to start.
 */
function launchEmulator(name) {
  if (!existsSync(EMULATOR)) fail(problem("no-emulator", { path: EMULATOR }));
  const result = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `Start-Process -FilePath '${toWindowsPath(EMULATOR)}' -ArgumentList @('-avd','${name}','-no-boot-anim','-no-snapshot-save') -WorkingDirectory '${toWindowsPath(join(SDK, "emulator"))}'`
    ],
    { encoding: "utf8" }
  );
  if (result.status !== 0) {
    fail(`Could not launch the emulator:\n${(result.stderr ?? "").trim()}`);
  }
}

async function waitForBoot() {
  const deadline = Date.now() + BOOT_TIMEOUT_SECONDS * 1000;
  while (Date.now() < deadline) {
    const serial = attachedDevice();
    if (serial) {
      const property = adb(
        ["-s", serial, "shell", "getprop", "sys.boot_completed"],
        { allowFailure: true }
      );
      if (bootCompleted(property)) return serial;
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  fail(problem("boot-timeout", { seconds: BOOT_TIMEOUT_SECONDS }));
}

/* -- subcommands ---------------------------------------------------------- */

async function boot(requestedAvd) {
  const name = requestedAvd ?? AVD_NAME;
  const existing = attachedDevice();
  if (existing) {
    say(`${existing} already attached.`);
    return existing;
  }
  const { created } = ensureAvd(name);
  if (created) say(`Created AVD ${name} — landscape tablet, 1920x1200, 4 GB.`);
  say(`Launching ${name}…`);
  launchEmulator(name);
  const serial = await waitForBoot();
  say(`${serial} booted.`);
  return serial;
}

function wire(serial, playerPort) {
  for (const { port, purpose } of reversedPorts(playerPort)) {
    adb(["-s", serial, "reverse", `tcp:${port}`, `tcp:${port}`]);
    say(`reverse tcp:${port} → ${purpose}`);
  }
}

function open(serial) {
  const installed = packageInstalled(
    adb(["-s", serial, "shell", "pm", "list", "packages"], { allowFailure: true }),
    EXPO_GO_PACKAGE
  );
  if (!installed) fail(problem("expo-go-missing"));
  /* Force-stop first: a stale error screen otherwise swallows the new URL. */
  adb(["-s", serial, "shell", "am", "force-stop", EXPO_GO_PACKAGE], {
    allowFailure: true
  });
  adb([
    "-s",
    serial,
    "shell",
    "am",
    "start",
    "-a",
    "android.intent.action.VIEW",
    "-d",
    expoGoDeepLink()
  ]);
  say(`Expo Go opened at ${expoGoDeepLink()}.`);
}

async function verifyServers(playerPort, expectedCheckoutId) {
  const actual = await readCheckoutId(playerPort);
  if (actual === null) fail(problem("player-down", { port: playerPort }));
  const mismatch = checkoutMismatch({ expected: expectedCheckoutId, actual });
  if (mismatch) fail(mismatch);
  say(`Player dev server up on ${playerPort}, serving this checkout.`);

  if (!(await reachable(`http://127.0.0.1:${METRO_PORT}/status`))) {
    fail(problem("metro-down"));
  }
  say(`Metro up on ${METRO_PORT}.`);
}

async function doctor() {
  const { port, checkoutId } = playerServer();
  line("sdk", SDK);
  line("adb", existsSync(ADB) ? ADB : "MISSING");
  line("emulator", existsSync(EMULATOR) ? EMULATOR : "MISSING");
  const avdHome = findAvdHome();
  line(
    "avd",
    existsSync(join(avdHome, `${AVD_NAME}.avd`))
      ? `${AVD_NAME} (present)`
      : `${AVD_NAME} (not created — run 'pnpm mobile:boot')`
  );
  const serial = attachedDevice();
  line("device", serial ?? "none attached");
  if (serial) {
    const reverses = adb(["-s", serial, "reverse", "--list"], { allowFailure: true })
      .replace(/\r/g, "")
      .trim();
    line("reverse", reverses === "" ? "none" : reverses.split("\n").join(", "));
    line(
      "expo go",
      packageInstalled(
        adb(["-s", serial, "shell", "pm", "list", "packages"], { allowFailure: true }),
        EXPO_GO_PACKAGE
      )
        ? "installed"
        : "not installed"
    );
  }
  const actual = await readCheckoutId(port);
  line(
    "player",
    actual === null
      ? `down (expected on ${port})`
      : actual === checkoutId
        ? `up on ${port}, this checkout`
        : `up on ${port}, but serving checkout ${actual} — not this one`
  );
  line(
    "metro",
    (await reachable(`http://127.0.0.1:${METRO_PORT}/status`))
      ? `up on ${METRO_PORT}`
      : `down (expected on ${METRO_PORT})`
  );
}

async function up() {
  const { port, checkoutId } = playerServer();
  const serial = await boot();
  wire(serial, port);
  await verifyServers(port, checkoutId);
  open(serial);
  say("");
  say("The player should now be loading in the emulator.");
}

/**
 * Metro, with the environment Expo needs under WSL2.
 *
 * `ADB_PATH` points Expo at Windows' adb so its own device detection works.
 * `EXPO_PUBLIC_PLAYER_URL` is passed here rather than written to a `.env`,
 * because the port is derived per checkout: a file would go stale in a worktree
 * and load the wrong checkout's player, which looks exactly like a working app.
 *
 * `--localhost` overrides Expo's LAN default, which advertises the machine's
 * LAN address and then fails with "Failed to download remote update" when the
 * Windows firewall drops the inbound connection — a message that names neither
 * the firewall nor the address it tried. `adb reverse` is already tunnelling
 * these ports, so `localhost` is both reachable and the one host Expo's bundle
 * loader trusts.
 */
function start(extraArgs) {
  const { port } = playerServer();
  const url = `http://localhost:${port}`;
  say(`Metro starting. The shell will load the player from ${url}.`);
  say("");
  const child = spawn("pnpm", ["--filter", "@lectoemocion/mobile", "start", ...metroArgs(extraArgs)], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, ADB_PATH: ADB, EXPO_PUBLIC_PLAYER_URL: url }
  });
  child.on("exit", (code) => process.exit(code ?? 0));
}

function shot(target) {
  const serial = attachedDevice();
  if (!serial) fail(problem("no-device"));
  const out =
    target ??
    join(process.env["TMPDIR"] ?? "/tmp", `lectoemocion-${Date.now()}.png`);
  const png = adb(["-s", serial, "exec-out", "screencap", "-p"], { binary: true });
  writeFileSync(out, png);
  console.log(out);
}

function logs(seconds) {
  const serial = attachedDevice();
  if (!serial) fail(problem("no-device"));
  /*
   * Chromium lines are in the filter because the player runs in a WebView: a
   * failed asset or a script error surfaces there and nowhere else, and without
   * it the symptom is a blank canvas and a silent log.
   */
  const pattern = "ReactNativeJS|chromium|WebView|Expo";
  const child = spawn(
    ADB,
    ["-s", serial, "logcat", "-v", "brief", "-s", "*:W"],
    { stdio: ["ignore", "pipe", "inherit"] }
  );
  const matcher = new RegExp(pattern);
  let buffer = "";
  child.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) if (matcher.test(line)) console.log(line);
  });
  if (seconds) setTimeout(() => child.kill(), Number(seconds) * 1000);
}

function stop() {
  const serial = attachedDevice();
  if (!serial) {
    say("Nothing attached.");
    return;
  }
  adb(["-s", serial, "emu", "kill"], { allowFailure: true });
  say(`${serial} stopped.`);
}

/* -- plumbing ------------------------------------------------------------- */

function say(message) {
  console.log(message);
}

function line(label, value) {
  console.log(`${label.padEnd(9)} ${value}`);
}

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

const [command = "doctor", ...rest] = process.argv.slice(2);

switch (command) {
  case "doctor":
    await doctor();
    break;
  case "boot":
    await boot(rest[0]);
    break;
  case "wire":
    wire(attachedDevice() ?? fail(problem("no-device")), playerServer().port);
    break;
  case "open":
    open(attachedDevice() ?? fail(problem("no-device")));
    break;
  case "up":
    await up();
    break;
  case "start":
    start(rest);
    break;
  case "shot":
    shot(rest[0]);
    break;
  case "logs":
    logs(rest[0]);
    break;
  case "stop":
    stop();
    break;
  default:
    fail(
      [
        `Unknown subcommand: ${command}`,
        "→ One of: doctor, boot, wire, open, up, start, shot, logs, stop."
      ].join("\n")
    );
}
