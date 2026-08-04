import * as Phaser from "phaser";
import { assertNever } from "@lectoemocion/domain";
import type { ResourceManifest } from "@lectoemocion/resource-schema";
import { renderInitialsGame } from "../templates/renderInitialsGame";
import { renderNameStory } from "../templates/renderNameStory";

export class ResourceScene extends Phaser.Scene {
  constructor(private readonly resource: ResourceManifest) {
    super(`resource-${resource.resourceId}`);
  }

  create(): void {
    const template = this.resource.template;
    switch (template.id) {
      case "name-story":
        renderNameStory(this, this.resource);
        return;
      case "initials-game":
        renderInitialsGame(this, this.resource);
        return;
      default:
        assertNever(template, "template id");
    }
  }
}
