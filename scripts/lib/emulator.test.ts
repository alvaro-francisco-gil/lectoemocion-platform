import { describe, expect, it } from "vitest";
// prettier-ignore
// @ts-expect-error -- plain .mjs script module, deliberately untyped
import { AVD_NAME, EXPO_GO_PACKAGE, METRO_PORT, avdConfig, avdIni, bootCompleted, checkoutMismatch, expoGoDeepLink, packageInstalled, parseAttachedDevices, problem, reversedPorts, selectLanHost, selectSdk, toWindowsPath, metroArgs } from "./emulator.mjs";

describe("parseAttachedDevices", () => {
  it("returns serials that are ready", () => {
    const output = [
      "List of devices attached",
      "emulator-5554\tdevice",
      ""
    ].join("\n");
    expect(parseAttachedDevices(output)).toEqual(["emulator-5554"]);
  });

  it("ignores devices that cannot accept commands", () => {
    /*
     * The reason this filter exists: a command sent to an `offline` device
     * hangs rather than failing, so treating one as attached trades a clear
     * error for a stuck terminal.
     */
    const output = [
      "List of devices attached",
      "emulator-5554\toffline",
      "emulator-5556\tunauthorized",
      "emulator-5558\tdevice"
    ].join("\n");
    expect(parseAttachedDevices(output)).toEqual(["emulator-5558"]);
  });

  it("is empty when nothing is attached", () => {
    expect(parseAttachedDevices("List of devices attached\n\n")).toEqual([]);
  });

  it("survives the carriage returns Windows adb emits", () => {
    const output = "List of devices attached\r\nemulator-5554\tdevice\r\n\r\n";
    expect(parseAttachedDevices(output)).toEqual(["emulator-5554"]);
  });
});

describe("bootCompleted", () => {
  it("is true only for 1", () => {
    expect(bootCompleted("1")).toBe(true);
    expect(bootCompleted("1\r\n")).toBe(true);
    expect(bootCompleted("0")).toBe(false);
    expect(bootCompleted("")).toBe(false);
  });

  it("is false while adb is still reporting an error", () => {
    expect(bootCompleted("error: device offline")).toBe(false);
  });
});

describe("packageInstalled", () => {
  it("matches a whole package id, not a prefix", () => {
    const output = "package:host.exp.exponent\r\npackage:com.android.settings\r\n";
    expect(packageInstalled(output, EXPO_GO_PACKAGE)).toBe(true);
    expect(packageInstalled(output, "com.lectoemocion.app")).toBe(false);
  });

  it("does not match a package that merely contains the id", () => {
    /*
     * `host.exp.exponent.dev` is a different application. Substring matching
     * would report Expo Go installed and then deep-link into nothing.
     */
    expect(packageInstalled("package:host.exp.exponent.dev\n", EXPO_GO_PACKAGE)).toBe(
      false
    );
  });
});

describe("expoGoDeepLink", () => {
  it("points at localhost, which is what adb reverse makes reachable", () => {
    expect(expoGoDeepLink()).toBe(`exp://localhost:${METRO_PORT}`);
  });

  it("never points at the emulator host alias", () => {
    /*
     * Expo's bundle loader rejects a cross-network bundle URL, and `10.0.2.2`
     * exists only inside an emulator — so a link written that way breaks on
     * real hardware. Both failures look like "the app won't load".
     */
    expect(expoGoDeepLink()).not.toContain("10.0.2.2");
  });
});

describe("reversedPorts", () => {
  it("tunnels Metro and the player's dev server", () => {
    const ports = reversedPorts(4173).map((entry: { port: number }) => entry.port);
    expect(ports).toEqual([METRO_PORT, 4173]);
  });

  it("follows the checkout's own player port", () => {
    /*
     * A worktree derives a different port. Hardcoding 4173 here would tunnel
     * the primary checkout's server into a worktree's emulator — the exact
     * silent-wrong-code trap `playerServer.ts` exists to prevent.
     */
    const ports = reversedPorts(4201).map((entry: { port: number }) => entry.port);
    expect(ports).toContain(4201);
    expect(ports).not.toContain(4173);
  });
});

describe("avdConfig", () => {
  it("is landscape at the tablet shape the product targets", () => {
    const config = avdConfig();
    expect(config).toContain("hw.initialOrientation=landscape");
    expect(config).toContain("hw.lcd.width=1920");
    expect(config).toContain("hw.lcd.height=1200");
  });

  it("enables the GPU, without which Phaser cannot render", () => {
    expect(avdConfig()).toContain("hw.gpu.enabled=yes");
  });

  it("enables audio output, because narration is not optional content", () => {
    expect(avdConfig()).toContain("hw.audioOutput=yes");
  });

  it("names no device profile", () => {
    /*
     * Device profiles come from `devices.xml`, which a Windows-only SDK without
     * `cmdline-tools` may not have. An explicit resolution needs no profile.
     */
    expect(avdConfig()).not.toContain("hw.device.name");
  });

  it("takes overrides, so a low-memory AVD is one argument away", () => {
    const config = avdConfig({ ramMb: 2048, name: "LectoEmocion_Small" });
    expect(config).toContain("hw.ramSize=2048");
    expect(config).toContain("AvdId=LectoEmocion_Small");
  });

  it("ends with a newline, as ini parsers expect", () => {
    expect(avdConfig().endsWith("\n")).toBe(true);
  });
});

describe("avdIni", () => {
  it("records the Windows path the emulator will read", () => {
    const ini = avdIni({ avdDirWindowsPath: "C:\\Users\\x\\.android\\avd\\A.avd", name: "A" });
    expect(ini).toContain("path=C:\\Users\\x\\.android\\avd\\A.avd");
    expect(ini).toContain("path.rel=avd\\A.avd");
  });
});

describe("toWindowsPath", () => {
  it("converts a WSL mount to a Windows path", () => {
    expect(toWindowsPath("/mnt/c/Users/x/.android/avd")).toBe(
      "C:\\Users\\x\\.android\\avd"
    );
  });

  it("refuses a Linux-only path", () => {
    /*
     * Failing loudly matters: the emulator is a Windows process, so an AVD
     * written to the WSL filesystem would be created successfully and then be
     * invisible to the tool meant to boot it.
     */
    expect(() => toWindowsPath("/home/user/avd")).toThrow(/Windows-backed/);
  });
});

describe("metroArgs", () => {
  it("defaults the host to localhost", () => {
    /*
     * The regression this exists for. Expo's LAN default advertised the
     * machine's LAN address, and Expo Go answered with
     * "java.io.IOException: Failed to download remote update" — a message that
     * names neither the address nor the firewall that dropped it. adb reverse
     * already tunnels the port, so localhost needs no firewall exception and
     * behaves the same over USB.
     */
    expect(metroArgs([])).toEqual(["--localhost"]);
  });

  it("keeps an explicit host choice", () => {
    expect(metroArgs(["--tunnel"])).toEqual(["--tunnel"]);
    expect(metroArgs(["--lan"])).toEqual(["--lan"]);
    expect(metroArgs(["--host", "lan"])).toEqual(["--host", "lan"]);
  });

  it("keeps unrelated arguments and still defaults the host", () => {
    expect(metroArgs(["--android"])).toEqual(["--localhost", "--android"]);
  });

  it("does not mutate what it is given", () => {
    const original = ["--android"];
    metroArgs(original);
    expect(original).toEqual(["--android"]);
  });
});

describe("selectLanHost", () => {
  /*
   * The layout of the machine this was written on. Six IPv4 addresses, exactly
   * one of which a phone on the house WiFi can reach — which is the whole
   * reason this function exists rather than a call to Expo's `--lan`.
   */
  const thisMachine = [
    { name: "lo", address: "127.0.0.1", family: "IPv4", internal: true },
    { name: "lo", address: "10.255.255.254", family: "IPv4", internal: true },
    { name: "eth0", address: "100.68.195.48", family: "IPv4", internal: false },
    { name: "eth1", address: "192.168.1.186", family: "IPv4", internal: false },
    { name: "br-9381c01191ad", address: "172.20.0.1", family: "IPv4", internal: false },
    { name: "br-ba55ca5ea61c", address: "172.19.0.1", family: "IPv4", internal: false }
  ];

  it("picks the one address a phone on the same network can reach", () => {
    expect(selectLanHost(thisMachine)).toEqual({
      kind: "resolved",
      host: "192.168.1.186",
      label: "eth1"
    });
  });

  it("rejects the Tailscale address", () => {
    /*
     * 100.64/10 is carrier-grade NAT space, which Tailscale uses. It is
     * reachable only from the tailnet, so advertising it to a phone on the
     * house WiFi yields a QR code that times out.
     */
    const only = [{ name: "eth0", address: "100.68.195.48", family: "IPv4", internal: false }];
    expect(selectLanHost(only)).toMatchObject({ kind: "unusable", problem: "none" });
  });

  it("rejects an adapter with no DHCP lease", () => {
    /*
     * The regression this exists for. This machine's WiFi adapter sits at
     * 169.254.5.75 — link-local, meaning no lease. It looks like a plausible
     * WiFi address and routes nowhere.
     */
    const only = [{ name: "wlan0", address: "169.254.5.75", family: "IPv4", internal: false }];
    expect(selectLanHost(only)).toMatchObject({ kind: "unusable", problem: "none" });
  });

  it("rejects container bridges by interface name", () => {
    const bridges = [
      { name: "br-9381c01191ad", address: "172.20.0.1", family: "IPv4", internal: false },
      { name: "docker0", address: "172.17.0.1", family: "IPv4", internal: false },
      { name: "vEthernet (Default Switch)", address: "172.20.144.1", family: "IPv4", internal: false }
    ];
    expect(selectLanHost(bridges)).toMatchObject({ kind: "unusable", problem: "none" });
  });

  it("rejects loopback and IPv6", () => {
    const neither = [
      { name: "lo", address: "127.0.0.1", family: "IPv4", internal: true },
      { name: "eth1", address: "fd7a:115c:a1e0::1", family: "IPv6", internal: false }
    ];
    expect(selectLanHost(neither)).toMatchObject({ kind: "unusable", problem: "none" });
  });

  it("refuses to guess between two real candidates", () => {
    /*
     * Guessing is the expensive failure. A wrong pick produces a QR code that
     * scans fine and then fails with Expo Go's generic error, which names
     * neither the address it tried nor why it was unreachable.
     */
    const two = [
      { name: "eth1", address: "192.168.1.186", family: "IPv4", internal: false },
      { name: "eth2", address: "10.0.0.4", family: "IPv4", internal: false }
    ];
    const result = selectLanHost(two);
    expect(result).toMatchObject({ kind: "unusable", problem: "ambiguous" });
    expect(result.candidates).toEqual([
      { host: "192.168.1.186", label: "eth1" },
      { host: "10.0.0.4", label: "eth2" }
    ]);
  });

  it("lists what it rejected when nothing qualifies", () => {
    /* A bare "no address found" costs a round trip to work out why. */
    const result = selectLanHost([
      { name: "eth0", address: "100.68.195.48", family: "IPv4", internal: false }
    ]);
    expect(result.candidates).toEqual([]);
    expect(result.rejected).toEqual([{ host: "100.68.195.48", label: "eth0" }]);
  });

  it("lets an explicit override win, including over an ambiguous set", () => {
    const two = [
      { name: "eth1", address: "192.168.1.186", family: "IPv4", internal: false },
      { name: "eth2", address: "10.0.0.4", family: "IPv4", internal: false }
    ];
    expect(selectLanHost(two, "10.0.0.4")).toEqual({
      kind: "resolved",
      host: "10.0.0.4",
      label: "MOBILE_LAN_HOST"
    });
  });

  it("accepts an override the interface list does not know about", () => {
    /*
     * Deliberate. Mirrored WSL networking and VPNs both produce addresses that
     * reach the phone but do not appear here; refusing them would make the
     * escape hatch useless exactly when it is needed.
     */
    expect(selectLanHost([], "192.168.4.20")).toMatchObject({
      kind: "resolved",
      host: "192.168.4.20"
    });
  });

  it("refuses an override that is not an IPv4 address", () => {
    for (const bad of ["my-laptop.local", "192.168.1", "192.168.1.999", ""]) {
      expect(selectLanHost([], bad)).toMatchObject({
        kind: "unusable",
        problem: "override-invalid"
      });
    }
  });

  it("does not mutate what it is given", () => {
    const original = [...thisMachine];
    selectLanHost(thisMachine);
    expect(thisMachine).toEqual(original);
  });
});

describe("selectSdk", () => {
  const windowsSdk = "/mnt/c/Users/x/AppData/Local/Android/Sdk";
  const linuxSdk = "/home/x/android-sdk";
  const hasWindowsAdb = (path: string) => path === `${windowsSdk}/platform-tools/adb.exe`;

  it("skips a Linux SDK in favour of the Windows one", () => {
    /*
     * The regression this exists for. A Linux SDK in ANDROID_SDK_ROOT is a real
     * SDK and it is the wrong one: only Windows' adb.exe can see an emulator
     * running as a Windows process. Choosing it yields "no devices attached",
     * which blames the emulator for a mistake made during discovery.
     */
    expect(selectSdk([linuxSdk, windowsSdk], hasWindowsAdb)).toBe(windowsSdk);
  });

  it("ignores empty candidates from unset environment variables", () => {
    expect(selectSdk([undefined, "", windowsSdk], hasWindowsAdb)).toBe(windowsSdk);
  });

  it("returns null when no candidate is a Windows SDK", () => {
    expect(selectSdk([linuxSdk], hasWindowsAdb)).toBeNull();
  });

  it("prefers the earlier candidate when several qualify", () => {
    expect(selectSdk([windowsSdk, "/mnt/c/other"], () => true)).toBe(windowsSdk);
  });
});

describe("checkoutMismatch", () => {
  it("passes when the dev server is this checkout's", () => {
    expect(checkoutMismatch({ expected: "abc123", actual: "abc123" })).toBeNull();
  });

  it("explains which checkout is actually serving", () => {
    const message = checkoutMismatch({ expected: "abc123", actual: "def456" });
    expect(message).toContain("abc123");
    expect(message).toContain("def456");
    expect(message).toContain("→");
  });
});

describe("problem", () => {
  it("tells the reader what to run next", () => {
    /*
     * Invariant 6: a failure is recoverable by an adult. Every message here is
     * the last thing someone reads before deciding what to do, so each must
     * carry an action, not just a diagnosis.
     */
    for (const kind of [
      "no-device",
      "player-down",
      "metro-down",
      "expo-go-missing",
      "no-adb",
      "no-emulator",
      "no-sdk",
      "no-system-image",
      "boot-timeout",
      "lan-host-unknown",
      "lan-host-ambiguous",
      "lan-host-invalid",
      "player-not-on-lan",
      "player-dev-exited"
    ]) {
      expect(
        problem(kind, {
          port: 4173,
          seconds: 180,
          path: "/x",
          searched: ["/y"],
          host: "192.168.1.186",
          candidates: [{ host: "10.0.0.4", label: "eth2" }],
          rejected: [{ host: "100.68.195.48", label: "eth0" }]
        })
      ).toContain("→");
    }
  });

  it("blames the port, not the network, when the dev server exits at once", () => {
    /*
     * The regression this exists for. An already-running `pnpm dev` makes Vite
     * exit with "Port 4173 is already in use" — and the LAN probe then spent
     * ninety seconds proving the obvious before reporting a firewall problem
     * that did not exist. Naming the wrong cause is worse than being slow.
     */
    const message = problem("player-dev-exited", { port: 4173 });
    expect(message).toContain("4173");
    expect(message).toContain("pnpm dev");
    expect(message).not.toContain("New-NetFirewallRule");
    expect(message).toContain("→");
  });

  it("names the firewall command when the player is unreachable on the LAN", () => {
    /*
     * Two different causes produce one symptom — a WebView that never loads —
     * and an adult cannot tell them apart from the device. Both are named.
     */
    const message = problem("player-not-on-lan", { host: "192.168.1.186", port: 4173 });
    expect(message).toContain("192.168.1.186:4173");
    expect(message).toContain("PLAYER_HOST");
    expect(message).toContain("New-NetFirewallRule");
  });

  it("names the AVD when no device is attached", () => {
    expect(problem("no-device")).toContain(AVD_NAME);
  });

  it("refuses an unknown kind rather than returning a vague string", () => {
    expect(() => problem("something-else")).toThrow(/Unknown problem/);
  });
});
