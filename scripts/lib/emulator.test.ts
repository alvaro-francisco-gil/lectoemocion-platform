import { describe, expect, it } from "vitest";
// prettier-ignore
// @ts-expect-error -- plain .mjs script module, deliberately untyped
import { AVD_NAME, EXPO_GO_PACKAGE, METRO_PORT, avdConfig, avdIni, bootCompleted, checkoutMismatch, expoGoDeepLink, packageInstalled, parseAttachedDevices, problem, reversedPorts, selectSdk, toWindowsPath, metroArgs } from "./emulator.mjs";

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
      "boot-timeout"
    ]) {
      expect(problem(kind, { port: 4173, seconds: 180, path: "/x", searched: ["/y"] })).toContain(
        "→"
      );
    }
  });

  it("names the AVD when no device is attached", () => {
    expect(problem("no-device")).toContain(AVD_NAME);
  });

  it("refuses an unknown kind rather than returning a vague string", () => {
    expect(() => problem("something-else")).toThrow(/Unknown problem/);
  });
});
