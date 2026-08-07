import { describe, expect, it } from "vitest";
// @ts-expect-error rules.mjs is untyped tooling, deliberately outside the workspace packages
import * as rules from "./rules.mjs";

const {
  isConsoleCall,
  isDeepAdultAreaImport,
  isFirebaseImport,
  isForbiddenInSharedPackage,
  isMediaFile,
  isPhaserImport,
  isProgressImport,
  isReactImport,
  isStrictTypeEscape
} = rules as {
  isConsoleCall: (line: string) => boolean;
  isDeepAdultAreaImport: (line: string) => boolean;
  isFirebaseImport: (line: string) => boolean;
  isForbiddenInSharedPackage: (line: string) => boolean;
  isMediaFile: (name: string) => boolean;
  isPhaserImport: (line: string) => boolean;
  isProgressImport: (line: string) => boolean;
  isReactImport: (line: string) => boolean;
  isStrictTypeEscape: (line: string) => boolean;
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
        'import { AdultGate } from "../app/adult/AdultGate";'
      )
    ).toBe(true);
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
    'import type { Progress } from "./mapView";',
    'export { deriveMapView } from "../../world/mapView";',
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
