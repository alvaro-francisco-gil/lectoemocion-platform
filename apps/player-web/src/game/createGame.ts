import * as Phaser from "phaser";
import type { ResourceManifest } from "@lectoemocion/resource-schema";
import { ResourceScene } from "./scenes/ResourceScene";

export function createGame(
  parent: HTMLElement,
  resource: ResourceManifest
): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#f7f2ff",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 1280,
      height: 720
    },
    input: { activePointers: 4 },
    scene: [new ResourceScene(resource)]
  });
}
