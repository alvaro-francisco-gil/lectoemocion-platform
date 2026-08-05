import * as Phaser from "phaser";
import type { ResourceManifest } from "@lectoemocion/resource-schema";
import { ResourceScene } from "./scenes/ResourceScene";

/**
 * One logical resolution for every surface. Large panels upscale; compositing
 * a full 4K canvas is not achievable on typical panel hardware (ADR 0003).
 */
const PRESENTATION = {
  type: Phaser.AUTO,
  backgroundColor: "#f7f2ff",
  scale: {
    mode: Phaser.Scale.FIT,
    /*
     * Centering is the host element's job. Phaser centres by writing a margin
     * onto the canvas, and a margin is layout: it grows the host, so the next
     * parent measurement is larger than the one that produced it and the
     * picture walks down the screen. CSS centres the canvas without changing
     * the box the scale manager measures.
     */
    autoCenter: Phaser.Scale.NO_CENTER,
    width: 1280,
    height: 720
  },
  input: { activePointers: 4 }
} as const;

export function createGame(
  parent: HTMLElement,
  resource: ResourceManifest,
  onComplete: () => void
): Phaser.Game {
  return new Phaser.Game({
    ...PRESENTATION,
    parent,
    scene: [new ResourceScene(resource, onComplete)]
  });
}

