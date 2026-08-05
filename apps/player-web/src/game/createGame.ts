import * as Phaser from "phaser";
import type { ResourceManifest } from "@lectoemocion/resource-schema";
import type { MapView } from "../world/mapView";
import { MapScene } from "./scenes/MapScene";
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
    autoCenter: Phaser.Scale.CENTER_BOTH,
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

export function createMapGame(
  parent: HTMLElement,
  view: MapView,
  onSelect: (nodeId: string) => void
): Phaser.Game {
  return new Phaser.Game({
    ...PRESENTATION,
    parent,
    scene: [new MapScene(view, onSelect)]
  });
}
