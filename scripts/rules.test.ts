import { describe, expect, it } from "vitest";
// @ts-expect-error rules.mjs is untyped tooling, deliberately outside the workspace packages
import * as rules from "./rules.mjs";

interface ChromeSoundMeasurement {
  codec: number;
  channels: number;
  rate: number;
  bitsPerSample: number;
  seconds: number;
  lufs: number;
  truePeakDb: number;
  leadInMs: number;
}

interface ChromeSoundSpec {
  format: Pick<
    ChromeSoundMeasurement,
    "codec" | "channels" | "rate" | "bitsPerSample"
  >;
  maxSeconds: number;
  targetLufs: number;
  tolerance: number;
  truePeakCeilingDb: number;
  maxLeadInMs: number;
}

const {
  chromeSoundProblems,
  isChildNamespaceLiteral,
  isConsoleCall,
  isDeepAdultAreaImport,
  isFirebaseImport,
  isForbiddenInSharedPackage,
  isMediaFile,
  isPhaserImport,
  isProgressImport,
  isReactImport,
  isStrictTypeEscape,
  parseSoundIds
} = rules as {
  chromeSoundProblems: (
    measured: ChromeSoundMeasurement,
    spec: ChromeSoundSpec
  ) => string[];
  isChildNamespaceLiteral: (line: string) => boolean;
  isConsoleCall: (line: string) => boolean;
  isDeepAdultAreaImport: (line: string) => boolean;
  isFirebaseImport: (line: string) => boolean;
  isForbiddenInSharedPackage: (line: string) => boolean;
  isMediaFile: (name: string) => boolean;
  isPhaserImport: (line: string) => boolean;
  isProgressImport: (line: string) => boolean;
  isReactImport: (line: string) => boolean;
  isStrictTypeEscape: (line: string) => boolean;
  parseSoundIds: (source: string) => string[] | null;
};

describe("engine-neutrality rule", () => {
  it.each([
    'import * as Phaser from "phaser";',
    'import { Scene } from "phaser/src/scene";',
    "export { x } from 'phaser'"
  ])("flags %s", (line) => {
    expect(isPhaserImport(line)).toBe(true);
  });

  it("allows a phrase that merely mentions phaser", () => {
    expect(isPhaserImport("// the phaser adapter renders this")).toBe(false);
    expect(isPhaserImport('import { x } from "./phaserless";')).toBe(false);
  });
});

describe("shared-package neutrality rule", () => {
  it.each([
    'import { useState } from "react";',
    'import { createRoot } from "react-dom/client";',
    'import { getFirestore } from "firebase/firestore";',
    'import * as Phaser from "phaser";'
  ])("flags %s", (line) => {
    expect(isForbiddenInSharedPackage(line)).toBe(true);
  });

  it("allows a workspace import", () => {
    expect(
      isForbiddenInSharedPackage('import type { ChildRecord } from "@lectoemocion/domain";')
    ).toBe(false);
  });

  it("does not confuse a lookalike package name", () => {
    expect(isReactImport('import { x } from "react-native-web-shim";')).toBe(false);
  });
});

describe("firebase boundary rule", () => {
  it.each([
    'import { initializeApp } from "firebase/app";',
    'import admin from "firebase-admin";',
    'import { getAuth } from "@firebase/auth";'
  ])("flags %s", (line) => {
    expect(isFirebaseImport(line)).toBe(true);
  });

  it("allows a typed service import", () => {
    expect(
      isFirebaseImport('import { childRecords } from "@lectoemocion/firebase";')
    ).toBe(false);
  });
});

describe("logging rule", () => {
  it.each([
    "console.log(child.displayName);",
    "  console.error(error);",
    "console.debug({ manifest });"
  ])("flags %s", (line) => {
    expect(isConsoleCall(line)).toBe(true);
  });

  it("allows an unrelated identifier", () => {
    expect(isConsoleCall("const consoleWidth = 80;")).toBe(false);
  });
});

describe("strict-typing rule", () => {
  it.each([
    "const value = input as any;",
    "function f(value: any) {}",
    "const list: any[] = [];",
    "const parsed = <any>input;",
    "// @ts-nocheck",
    "/* @ts-ignore */"
  ])("flags %s", (line) => {
    expect(isStrictTypeEscape(line.replace(/^\/\/ /, ""))).toBe(true);
  });

  it("allows an explained ts-expect-error", () => {
    expect(
      isStrictTypeEscape("// @ts-expect-error untyped tooling module")
    ).toBe(false);
  });

  it("allows a prose line mentioning any", () => {
    expect(isStrictTypeEscape(" * any manifest may be validated")).toBe(false);
  });

  it("allows a legitimate type annotation", () => {
    expect(isStrictTypeEscape("const value: unknown = input;")).toBe(false);
  });
});

describe("media rule", () => {
  it.each(["photo.JPG", "recording.m4a", "clip.mp4", "avatar.png"])(
    "flags %s",
    (name) => {
      expect(isMediaFile(name)).toBe(true);
    }
  );

  it("allows generated vector art", () => {
    expect(isMediaFile("avatar.svg")).toBe(false);
  });
});

describe("isDeepAdultAreaImport", () => {
  it("flags a screen reaching past the gate", () => {
    expect(
      isDeepAdultAreaImport('import { PrizeForm } from "./adult/PrizeForm";')
    ).toBe(true);
    expect(
      isDeepAdultAreaImport(
        'import { PrizeSettings } from "../app/adult/PrizeSettings";'
      )
    ).toBe(true);
  });

  /*
   * The gate itself lives outside the guarded directory — it is the shell's one
   * reusable `AdultGate`, and the profile drawer puts up the same one. Importing
   * it is not reaching past the door.
   */
  it("accepts the gate, which is not inside the area it guards", () => {
    expect(isDeepAdultAreaImport('import { AdultGate } from "../AdultGate";')).toBe(
      false
    );
  });

  it("accepts the gate's own entry point", () => {
    expect(isDeepAdultAreaImport('import { AdultArea } from "./adult";')).toBe(
      false
    );
  });

  it("accepts the entry point's explicit path", () => {
    expect(
      isDeepAdultAreaImport('import { AdultArea } from "./adult/index";')
    ).toBe(false);
  });

  it("accepts imports that have nothing to do with the adult area", () => {
    expect(isDeepAdultAreaImport('import { Gift } from "./Gift";')).toBe(false);
  });

  it("flags a dynamic import reaching past the gate", () => {
    expect(
      isDeepAdultAreaImport('const mod = await import("./adult/PrizeForm");')
    ).toBe(true);
  });

  it("flags a require reaching past the gate", () => {
    expect(
      isDeepAdultAreaImport('const { PrizeForm } = require("./adult/PrizeForm");')
    ).toBe(true);
  });
});

describe("progress-boundary rule", () => {
  it.each([
    'import { LocalProgressStore } from "../world/progressStore";',
    'import type { Progress } from "./worldView";',
    'export { deriveWorldView } from "../../world/worldView";',
    "import { EMPTY_PROGRESS } from '@lectoemocion/player-web/src/world/progressStore'"
  ])("flags %s", (line) => {
    expect(isProgressImport(line)).toBe(true);
  });

  it("allows a template importing its own contracts", () => {
    expect(
      isProgressImport('import type { ManifestFor } from "@lectoemocion/resource-schema";')
    ).toBe(false);
    expect(isProgressImport('import { resolveSlot } from "./slots";')).toBe(false);
  });

  it("allows prose that merely mentions progress", () => {
    expect(isProgressImport(" * The shell records progress after a win.")).toBe(
      false
    );
  });
});

/*
 * A profile's id is the namespace for everything that is that child's:
 * `storageKey(id)` builds `lectoemocion.progress.<id>` and `giftsKey(id)`
 * builds `lectoemocion.gifts.<id>`. That is only a guarantee while one
 * function builds each — a second place spelling a prefix out by hand can
 * namespace a child's things by something that is not a profile id, and two
 * children quietly share a set of stars, or a regalo.
 */
describe("child-namespace rule", () => {
  it.each([
    'localStorage.getItem("lectoemocion.progress." + owner);',
    "const key = `lectoemocion.progress.${child}`;",
    "storage.removeItem('lectoemocion.progress.' + id)",
    'localStorage.getItem("lectoemocion.gifts." + owner);',
    "const key = `lectoemocion.gifts.${child}`;"
  ])("flags %s", (line) => {
    expect(isChildNamespaceLiteral(line)).toBe(true);
  });

  it("allows a key built through the one function that owns it", () => {
    expect(isChildNamespaceLiteral("storage.removeItem(storageKey(id));")).toBe(
      false
    );
    expect(isChildNamespaceLiteral("storage.getItem(giftsKey(child));")).toBe(
      false
    );
    expect(
      isChildNamespaceLiteral('return `lectoemocion.profiles`;')
    ).toBe(false);
  });

  /* The goal is one line for a whole family or class, so it is namespaced by
     the group and is not one of a child's things. */
  it("leaves the group's goal alone", () => {
    expect(
      isChildNamespaceLiteral('return `lectoemocion.prizeGoal.${group}`;')
    ).toBe(false);
  });

  it("allows prose that merely names the key", () => {
    expect(
      isChildNamespaceLiteral(" * Stored under lectoemocion.progress.<id>.")
    ).toBe(false);
    expect(
      isChildNamespaceLiteral("// the progress key is namespaced by profile id")
    ).toBe(false);
  });

  /* A comment quoting the key in backticks is documentation, not a second
     place that builds it. */
  it("allows a doc comment formatting the key as code", () => {
    expect(
      isChildNamespaceLiteral(" * leaving `lectoemocion.progress.<id>` behind")
    ).toBe(false);
    expect(
      isChildNamespaceLiteral("// writes to 'lectoemocion.progress.' + id")
    ).toBe(false);
  });
});

describe("chrome sound rule", () => {
  /* What `scripts/generate-chrome-sounds.mjs` actually produces. */
  const SPEC: ChromeSoundSpec = {
    format: { codec: 1, channels: 1, rate: 44100, bitsPerSample: 16 },
    maxSeconds: 1,
    targetLufs: -16,
    tolerance: 1,
    truePeakCeilingDb: -1,
    maxLeadInMs: 20
  };
  const GOOD: ChromeSoundMeasurement = {
    codec: 1,
    channels: 1,
    rate: 44100,
    bitsPerSample: 16,
    seconds: 0.36,
    lufs: -16,
    truePeakDb: -4.6,
    leadInMs: 0
  };

  it("accepts a sound the generator wrote", () => {
    expect(chromeSoundProblems(GOOD, SPEC)).toEqual([]);
  });

  it.each([
    ["a codec that is not PCM", { codec: 0xff }, /codec/],
    ["stereo", { channels: 2 }, /channels/],
    ["the wrong sample rate", { rate: 48000 }, /48000 Hz/],
    ["8-bit samples", { bitsPerSample: 8 }, /8-bit/],
    ["a sound over the duration budget", { seconds: 1.4 }, /longer than/],
    ["a sound mastered too loud", { lufs: -11 }, /LUFS/],
    ["a sound mastered too quiet", { lufs: -21 }, /LUFS/],
    ["a true peak above the ceiling", { truePeakDb: -0.2 }, /dBTP/],
    ["silence in front of the sound", { leadInMs: 55 }, /silence/]
  ])("flags %s", (_case, defect, expected) => {
    const problems = chromeSoundProblems({ ...GOOD, ...defect }, SPEC);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(expected);
  });

  /*
   * The soft onset a ceremony sound is allowed. This is the boundary the
   * threshold was actually set at, so it is worth pinning: `chest-open` begins
   * with a creak fading in, and its first few milliseconds are below the noise
   * floor without being latency.
   */
  it("allows a soft onset under the lead-in limit", () => {
    expect(chromeSoundProblems({ ...GOOD, leadInMs: 6 }, SPEC)).toEqual([]);
  });

  it("reports every fault at once rather than the first", () => {
    expect(
      chromeSoundProblems({ ...GOOD, channels: 2, rate: 22050 }, SPEC)
    ).toHaveLength(2);
  });

  it("honours a lower target for the deliberately quiet sound", () => {
    const quiet = { ...SPEC, targetLufs: -19 };
    expect(chromeSoundProblems({ ...GOOD, lufs: -19 }, quiet)).toEqual([]);
    expect(chromeSoundProblems(GOOD, quiet)).toHaveLength(1);
  });
});

describe("sound registry rule", () => {
  it("reads the ids the player declares", () => {
    expect(
      parseSoundIds('export const SOUND_IDS = [\n  "tap",\n  "star"\n] as const;')
    ).toEqual(["tap", "star"]);
  });

  it("reports a registry it cannot find rather than an empty one", () => {
    expect(parseSoundIds("export const OTHER = [];")).toBeNull();
    expect(parseSoundIds("export const SOUND_IDS = [] as const;")).toEqual([]);
  });
});
