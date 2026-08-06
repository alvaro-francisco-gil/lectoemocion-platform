import * as Phaser from "phaser";
import type { ManifestFor, StoryPage } from "@lectoemocion/resource-schema";
import { CARD } from "./vocabularyCard";
import {
  fitPage,
  PAGE_BACKGROUND,
  PAGE_BOX,
  pageAudioKey,
  pageKey,
  queueStoryPictures
} from "./storyPageFrame";

/** The source application faded the page out and in across a turn. */
const TURN_MS = 250;

/** A beat of quiet after a page finishes, before the next one speaks. */
const BETWEEN_PAGES_MS = 400;

const CONTROL = {
  /* The lower reach band: a child aged 3–5 cannot touch the top of an 86-inch
     panel, so everything pressable lives down here. */
  y: 660,
  pill: { x: 1120, width: 180, height: 56 },
  bar: { x: 640, width: 700, height: 10 }
} as const;

const PILL = { playing: "Pausar", paused: "Reproducir" } as const;

/**
 * An illustrated story, read aloud.
 *
 * A faithful port of the reading experience the book shipped with: the page
 * fills a card, its recording plays on arrival, and the book turns itself when
 * the recording ends. What is gone is the machinery — that version reloaded the
 * whole document per page, so a thirty-one page book was thirty-one navigations.
 *
 * The template is told nothing about progress and cannot ask (invariant 2). It
 * gets a manifest and a way to say it finished.
 */
export function renderIllustratedStory(
  scene: Phaser.Scene,
  resource: ManifestFor<"illustrated-story">,
  onComplete: () => void
): void {
  scene.cameras.main.setBackgroundColor(PAGE_BACKGROUND);

  const pages = resource.pages;
  const card = scene.add.graphics();
  drawCard(card);

  let index = 0;
  let picture = scene.add.image(PAGE_BOX.x, PAGE_BOX.y, pageKey(firstPage(pages)));
  fitPage(picture);

  /* The controls sit above the page, so a page turn never draws over them. */
  const progress = scene.add.graphics().setDepth(5);
  const pill = scene.add.graphics().setDepth(5);
  const pillLabel = scene.add
    .text(CONTROL.pill.x, CONTROL.y, PILL.playing, {
      fontFamily: "system-ui",
      fontSize: "26px",
      color: "#ffffff",
      fontStyle: "bold"
    })
    .setOrigin(0.5)
    .setDepth(6);

  /**
   * The page currently sounding.
   *
   * One at a time, and destroyed on the way out. Preloading thirty-one
   * recordings would be a few megabytes on the wire but hundreds of decoded
   * into memory, and the classroom panel is assumed to be weak ARM hardware
   * with a fixed browser. The source application fetched one per page too.
   */
  let voice: Phaser.Sound.BaseSound | null = null;
  let finished = false;

  const failClosed = () => {
    if (finished) return;
    finished = true;
    voice?.destroy();
    scene.add
      .text(
        640,
        320,
        "No se pudo cargar esta página del cuento.\n" +
          "Vuelve al mapa e inténtalo de nuevo.",
        {
          fontFamily: "system-ui",
          fontSize: "36px",
          color: "#402060",
          align: "center"
        }
      )
      .setOrigin(0.5)
      .setDepth(10);
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    onComplete();
  };

  /** Turns to a page: cross-fades the picture, then speaks it. */
  const openPage = (next: number) => {
    index = next;
    const page = pages[index];
    if (page === undefined) {
      finish();
      return;
    }

    scene.tweens.add({
      targets: picture,
      alpha: 0,
      duration: TURN_MS,
      onComplete: () => {
        picture.destroy();
        picture = scene.add
          .image(PAGE_BOX.x, PAGE_BOX.y, pageKey(page))
          .setAlpha(0);
        fitPage(picture);
        scene.tweens.add({ targets: picture, alpha: 1, duration: TURN_MS });
        drawProgress(progress, index + 1, pages.length);
        speak(page);
      }
    });
  };

  /**
   * Loads this page's recording, plays it, and turns the page when it ends.
   *
   * A recording that fails to arrive is missing *default* content, so it fails
   * closed (invariant 6) rather than leaving a book that looks fine and says
   * nothing.
   */
  const speak = (page: StoryPage) => {
    const key = pageAudioKey(page);
    let failed = false;

    const start = () => {
      if (failed || finished) return;
      /* Freeing the decoded buffer is the point of loading one at a time; the
         book only ever moves forward, so nothing needs the old page's voice. */
      if (voice !== null) {
        const spent = voice.key;
        voice.destroy();
        scene.cache.audio.remove(spent);
      }
      voice = scene.sound.add(key);
      setPill(true);
      voice.once(Phaser.Sound.Events.COMPLETE, () => {
        scene.time.delayedCall(BETWEEN_PAGES_MS, () => {
          if (index + 1 < pages.length) openPage(index + 1);
          else finish();
        });
      });
      voice.play();
    };

    if (scene.cache.audio.exists(key)) {
      start();
      return;
    }

    /*
     * Paired handlers, each removing the other. Phaser emits the file error
     * *and then* the batch completion, and a `once` that never fires stays
     * attached — thirty-one pages of leftover listeners would make one late
     * failure fire every page's error handler.
     */
    const onError = () => {
      failed = true;
      scene.load.off(Phaser.Loader.Events.COMPLETE, onLoaded);
      failClosed();
    };
    const onLoaded = () => {
      scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
      start();
    };
    scene.load.audio(key, page.audioUrl);
    scene.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
    scene.load.once(Phaser.Loader.Events.COMPLETE, onLoaded);
    scene.load.start();
  };

  const setPill = (playing: boolean) => {
    pillLabel.setText(playing ? PILL.playing : PILL.paused);
    drawPill(pill, playing);
  };

  /** Tapping anywhere on the page pauses or resumes the reading. */
  const toggle = () => {
    if (finished || voice === null) return;
    if (voice.isPaused) {
      voice.resume();
      setPill(true);
    } else if (voice.isPlaying) {
      voice.pause();
      setPill(false);
    }
  };

  scene.input.on(Phaser.Input.Events.POINTER_DOWN, toggle);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => voice?.destroy());

  drawProgress(progress, 1, pages.length);
  setPill(true);

  /*
   * Every browser blocks autoplay until a gesture, and an aged classroom
   * WebView is the case this has to survive. Phaser reports the lock and
   * releases it on the first touch anywhere, so the book waits on the child
   * rather than opening silently and looking broken.
   */
  if (scene.sound.locked) {
    const prompt = tapToStart(scene);
    scene.sound.once(Phaser.Sound.Events.UNLOCKED, () => {
      prompt.destroy();
      const page = pages[0];
      if (page !== undefined) speak(page);
    });
    return;
  }

  const page = pages[0];
  if (page !== undefined) speak(page);
}

/** A manifest of at least one page is a schema guarantee; this satisfies the compiler. */
function firstPage(pages: readonly StoryPage[]): StoryPage {
  const page = pages[0];
  if (page === undefined) throw new Error("A story must have a page");
  return page;
}

function drawCard(card: Phaser.GameObjects.Graphics): void {
  const padding = CARD.inset * 2;
  const width = PAGE_BOX.width + padding;
  const height = PAGE_BOX.height + padding;
  const left = PAGE_BOX.x - width / 2;
  const top = PAGE_BOX.y - height / 2;
  card.fillStyle(CARD.fill, 1);
  card.fillRoundedRect(left, top, width, height, CARD.radius);
  card.lineStyle(CARD.borderWidth, CARD.border, 1);
  card.strokeRoundedRect(left, top, width, height, CARD.radius);
}

/**
 * How far through the book we are.
 *
 * The source application computed this percentage on every page and never drew
 * it. Thirty-one pages is long enough that an adult deciding whether to start
 * it before break needs to see where it ends.
 */
function drawProgress(
  bar: Phaser.GameObjects.Graphics,
  page: number,
  total: number
): void {
  const { x, width, height } = CONTROL.bar;
  const left = x - width / 2;
  const top = CONTROL.y - height / 2;
  bar.clear();
  bar.fillStyle(CARD.fill, 1);
  bar.fillRoundedRect(left, top, width, height, height / 2);
  bar.fillStyle(CARD.border, 1);
  bar.fillRoundedRect(left, top, (width * page) / total, height, height / 2);
}

/** The source application's green pill, in the same corner it sat in. */
function drawPill(pill: Phaser.GameObjects.Graphics, playing: boolean): void {
  const { x, width, height } = CONTROL.pill;
  pill.clear();
  pill.fillStyle(playing ? 0x2f9e5f : 0x7b2cbf, 1);
  pill.fillRoundedRect(
    x - width / 2,
    CONTROL.y - height / 2,
    width,
    height,
    height / 2
  );
}

/** Shown only while audio is locked: one instruction, no way to get it wrong. */
function tapToStart(scene: Phaser.Scene): Phaser.GameObjects.Text {
  return scene.add
    .text(640, PAGE_BOX.y, "Toca para empezar", {
      fontFamily: "system-ui",
      fontSize: "44px",
      color: "#ffffff",
      backgroundColor: "#7b2cbf",
      padding: { x: 32, y: 20 },
      fontStyle: "bold"
    })
    .setOrigin(0.5)
    .setDepth(10);
}
