import * as Phaser from "phaser";
import { assertNever } from "@lectoemocion/domain";
import { isTemplate, type ResourceManifest } from "@lectoemocion/resource-schema";
import { renderInitialsGame } from "../templates/renderInitialsGame";
import { renderNameStory } from "../templates/renderNameStory";
import { renderPairsGame } from "../templates/renderPairsGame";
import { renderSyllablesGame } from "../templates/renderSyllablesGame";
import { renderWordPictureGame } from "../templates/renderWordPictureGame";

export class ResourceScene extends Phaser.Scene {
  constructor(private readonly resource: ResourceManifest) {
    super(`resource-${resource.resourceId}`);
  }

  /**
   * `isTemplate` narrows where a nested discriminant cannot, so each false
   * branch whittles the union down. Once every template is handled the
   * remainder is `never` and `assertNever` compiles; adding a template makes it
   * stop compiling here rather than silently rendering the wrong scene.
   *
   * The final call is unreachable for any manifest that came through
   * `parseResourceManifest`; it exists so the compiler proves that.
   */
  create(): void {
    const resource = this.resource;
    if (isTemplate(resource, "name-story")) {
      renderNameStory(this, resource);
      return;
    }
    if (isTemplate(resource, "initials-game")) {
      renderInitialsGame(this, resource);
      return;
    }
    if (isTemplate(resource, "pairs-game")) {
      renderPairsGame(this, resource);
      return;
    }
    if (isTemplate(resource, "word-picture-game")) {
      renderWordPictureGame(this, resource);
      return;
    }
    if (isTemplate(resource, "syllables-game")) {
      renderSyllablesGame(this, resource);
      return;
    }
    assertNever(resource, "resource manifest");
  }
}
