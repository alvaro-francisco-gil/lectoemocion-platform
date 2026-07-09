import * as Phaser from "phaser";
import type { ResourceManifest } from "@lectoemocion/resource-schema";
import { renderInitialsGame } from "../templates/renderInitialsGame";
import { renderNameStory } from "../templates/renderNameStory";

export class ResourceScene extends Phaser.Scene {
  constructor(private readonly resource: ResourceManifest) {
    super(`resource-${resource.resourceId}`);
  }

  create(): void {
    if (this.resource.template.id === "name-story") {
      renderNameStory(this, this.resource);
      return;
    }
    renderInitialsGame(this, this.resource);
  }
}
