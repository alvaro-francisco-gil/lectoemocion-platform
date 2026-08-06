import * as Phaser from "phaser";
import { assertNever } from "@lectoemocion/domain";
import { isTemplate, type ResourceManifest } from "@lectoemocion/resource-schema";
import { renderIllustratedStory } from "../templates/renderIllustratedStory";
import { renderInitialLetterGame } from "../templates/renderInitialLetterGame";
import { renderInitialSyllableGame } from "../templates/renderInitialSyllableGame";
import { renderInitialsGame } from "../templates/renderInitialsGame";
import { renderLettersGame } from "../templates/renderLettersGame";
import { renderMemoryAlbum } from "../templates/renderMemoryAlbum";
import { renderNameStory } from "../templates/renderNameStory";
import { renderPairsGame } from "../templates/renderPairsGame";
import { renderSyllablesGame } from "../templates/renderSyllablesGame";
import { renderWordPictureGame } from "../templates/renderWordPictureGame";
import { queueStoryPictures } from "../templates/storyPageFrame";
import { queueVocabularyPictures } from "../templates/vocabularyCard";

export class ResourceScene extends Phaser.Scene {
  private missingAssets = 0;

  constructor(
    private readonly resource: ResourceManifest,
    private readonly onComplete: () => void
  ) {
    super(`resource-${resource.resourceId}`);
  }

  /**
   * A resource's own pictures are *default* content, so one that fails to load
   * is invariant 6's fail-closed case, not its personalised-media exception.
   * Count the failures here and refuse to render the resource.
   *
   * A story's recordings are deliberately not queued here: they are fetched a
   * page at a time while the book plays, and the renderer fails closed on its
   * own when one does not arrive.
   */
  preload(): void {
    const resource = this.resource;
    if ("vocabulary" in resource) {
      queueVocabularyPictures(this, resource.vocabulary);
    }
    if ("pages" in resource) {
      queueStoryPictures(this, resource.pages);
    }
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, () => {
      this.missingAssets += 1;
    });
  }

  /**
   * `isTemplate` narrows where a nested discriminant cannot, so each false
   * branch whittles the union down. Once every template is handled the
   * remainder is `never` and `assertNever` compiles; adding a template makes it
   * stop compiling here rather than silently rendering the wrong scene.
   *
   * The final call is unreachable for any manifest that came through
   * `parseResourceManifest`; it exists so the compiler proves that.
   *
   * A template receives a completion callback and nothing else. It cannot read
   * progress and cannot tell whether anything is listening, which is what
   * keeps invariant 2 true while the world still learns what was played.
   */
  create(): void {
    if (this.missingAssets > 0) {
      this.reportMissingContent();
      return;
    }

    const resource = this.resource;
    const done = () => this.onComplete();

    if (isTemplate(resource, "name-story")) {
      renderNameStory(this, resource, done);
      return;
    }
    /*
     * The story loads its own pages. It is the one template whose content is
     * too large to preload — thirty-one pictures and thirty-one recordings —
     * so it fetches page by page and reports a missing one itself.
     */
    if (isTemplate(resource, "illustrated-story")) {
      renderIllustratedStory(this, resource, done);
      return;
    }
    if (isTemplate(resource, "initials-game")) {
      renderInitialsGame(this, resource, done);
      return;
    }
    if (isTemplate(resource, "memory-album")) {
      renderMemoryAlbum(this, resource, done);
      return;
    }
    if (isTemplate(resource, "pairs-game")) {
      renderPairsGame(this, resource, done);
      return;
    }
    if (isTemplate(resource, "word-picture-game")) {
      renderWordPictureGame(this, resource, done);
      return;
    }
    if (isTemplate(resource, "initial-letter-game")) {
      renderInitialLetterGame(this, resource, done);
      return;
    }
    if (isTemplate(resource, "syllables-game")) {
      renderSyllablesGame(this, resource, done);
      return;
    }
    if (isTemplate(resource, "initial-syllable-game")) {
      renderInitialSyllableGame(this, resource, done);
      return;
    }
    if (isTemplate(resource, "letters-game")) {
      renderLettersGame(this, resource, done);
      return;
    }
    assertNever(resource, "resource manifest");
  }

  /** Adult-facing and recoverable: it names the fault and offers the way back. */
  private reportMissingContent(): void {
    this.add
      .text(
        640,
        320,
        "No se pudo cargar el contenido de esta actividad.\n" +
          "Vuelve al mapa e inténtalo de nuevo.",
        {
          fontFamily: "system-ui",
          fontSize: "36px",
          color: "#402060",
          align: "center"
        }
      )
      .setOrigin(0.5);
  }
}
