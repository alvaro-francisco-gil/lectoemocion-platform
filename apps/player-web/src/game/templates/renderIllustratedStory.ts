import * as Phaser from "phaser";
import {
  pageLabel,
  pageShortLabel,
  type ManifestFor,
  type StoryPage
} from "@lectoemocion/resource-schema";
import {
  layOutPage,
  PAGE,
  storyAudioKey,
  storyPictureKey
} from "./storyPageFrame";

const OVERLAY_DEPTH = 100;
const PICKER_COLUMNS = 8;

/** The one thing a child is asked to do before the book will speak. */
const OPEN_PROMPT = "Toca para leer";

/**
 * An illustrated story, read aloud page by page.
 *
 * Three things are carried over from the application the book shipped with,
 * because they are what made it work in a classroom: the page turns itself when
 * the recording ends, any page can be reached directly without listening to the
 * ones before it, and the whole thing pauses with one press.
 *
 * Recordings are fetched as they are needed rather than up front. They are five
 * of the book's six megabytes; a school network would spend all of it before
 * the cover appeared, and a child would be looking at nothing while it did. The
 * pictures came with the scene (`queueStoryPictures`), so a turn is never
 * waiting on one.
 */
export function renderIllustratedStory(
  scene: Phaser.Scene,
  resource: ManifestFor<"illustrated-story">,
  onComplete: () => void
): void {
  const pages = resource.pages;
  scene.cameras.main.setBackgroundColor(PAGE.backdrop);

  const sheet = scene.add.graphics();
  const progress = scene.add.graphics();
  let picture: Phaser.GameObjects.Image | null = null;
  let voice: Phaser.Sound.BaseSound | null = null;
  /** What is on screen. `-1` until the first page arrives. */
  let current = -1;
  /** What the reader is heading for, which may not be on screen yet. */
  let target = 0;
  let completed = false;

  const label = scene.add.text(64, 40, "", {
    fontFamily: "system-ui",
    fontSize: "30px",
    color: PAGE.ink,
    fontStyle: "bold"
  });

  const counter = scene.add
    .text(1216, 606, "", {
      fontFamily: "system-ui",
      fontSize: "24px",
      color: PAGE.quiet
    })
    .setOrigin(1, 0.5);

  /* --------------------------------------------------------------- loading */

  /*
   * One page at a time, in the order asked for. A scene has a single loader,
   * and starting a second fetch while the first runs interleaves the two
   * queues. The work is wrapped in a thunk rather than a promise so that
   * nothing reaches `load.start()` until its turn actually comes — a promise
   * would have run its executor, and the fetch, the moment it was created.
   */
  let queue: Promise<unknown> = Promise.resolve();

  function fetchPage(page: StoryPage): Promise<boolean> {
    const audioKey = storyAudioKey(page);
    if (scene.cache.audio.exists(audioKey)) return Promise.resolve(true);

    const run = () =>
      new Promise<boolean>((resolve) => {
        if (scene.cache.audio.exists(audioKey)) {
          resolve(true);
          return;
        }
        let broken = false;
        const onError = () => {
          broken = true;
        };
        scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
        scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
          scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
          resolve(!broken);
        });
        scene.load.audio(audioKey, page.audioUrl);
        scene.load.start();
      });

    const result = queue.then(run);
    /* The queue must survive a failed page, or every later page waits forever. */
    queue = result.catch(() => undefined);
    return result;
  }

  /**
   * How far through the book, as a bar along the very bottom.
   *
   * The source application computed this on every page and never drew it. It is
   * worth drawing: thirty-one pages is long enough that an adult deciding
   * whether to start one before break wants to see where the end is.
   */
  function drawProgress(index: number): void {
    progress.clear();
    progress.fillStyle(PAGE.sheetEdge, 1);
    progress.fillRect(0, 714, 1280, 6);
    progress.fillStyle(PAGE.accent, 1);
    progress.fillRect(0, 714, (1280 * (index + 1)) / pages.length, 6);
  }

  /* -------------------------------------------------------------- playback */

  function stopVoice(): void {
    voice?.destroy();
    voice = null;
  }

  /**
   * Reads the page aloud, then turns it.
   *
   * The last page finishes the resource instead of turning. `completed` guards
   * that because a book can be read again from the picker, and a second finish
   * would pay the child twice for one chapter.
   */
  function speak(index: number): void {
    const page = pages[index];
    if (page === undefined) return;

    stopVoice();
    const sound = scene.sound.add(storyAudioKey(page));
    voice = sound;
    sound.once(Phaser.Sound.Events.COMPLETE, () => {
      if (index + 1 < pages.length) {
        goTo(index + 1, true);
        return;
      }
      if (!completed) {
        completed = true;
        onComplete();
      }
    });
    sound.play();
    setPlaying(true);
  }

  /* --------------------------------------------------------------- turning */

  async function turnTo(index: number, autoplay: boolean): Promise<void> {
    const page = pages[index];
    if (page === undefined) return;

    stopVoice();
    setPlaying(false);

    /* Show the page at once; only the voice is worth waiting for. */
    current = index;
    picture?.destroy();
    picture = scene.add.image(PAGE.centreX, PAGE.centreY, storyPictureKey(page));
    layOutPage(sheet, picture);
    label.setText(pageLabel(page));
    counter.setText(`${index + 1} / ${pages.length}`);
    drawProgress(index);
    highlightPicker(index);
    updateArrows();

    if (!scene.cache.audio.exists(storyAudioKey(page))) curtain.waiting();

    const ready = await fetchPage(page);
    /* The reader moved on while this was in flight; that page owns the screen. */
    if (index !== target) return;

    /*
     * A page of the book is *default* content, so a recording that fails to
     * arrive is invariant 6's fail-closed case rather than its personalised-
     * media exception. The reader stops on an adult-facing message rather than
     * sitting silently on a page that will never speak.
     */
    if (!ready) {
      curtain.broken();
      return;
    }

    if (autoplay) {
      curtain.hide();
      speak(index);
    } else {
      curtain.prompt();
    }

    /* One page of look-ahead, so an auto-turn lands on a voice already here. */
    const upcoming = pages[index + 1];
    if (upcoming !== undefined) void fetchPage(upcoming);
  }

  function goTo(index: number, autoplay: boolean): void {
    if (index < 0 || index >= pages.length) return;
    target = index;
    void turnTo(index, autoplay);
  }

  /* -------------------------------------------------------------- controls */

  function pill(
    x: number,
    width: number,
    text: string,
    fill: number,
    colour: string,
    onTap: () => void
  ): {
    readonly setText: (value: string) => void;
    readonly setEnabled: (on: boolean) => void;
  } {
    const shape = scene.add.graphics();
    const caption = scene.add
      .text(x, PAGE.controlsY, text, {
        fontFamily: "system-ui",
        fontSize: "26px",
        color: colour,
        fontStyle: "bold"
      })
      .setOrigin(0.5);
    const hit = scene.add
      .zone(x, PAGE.controlsY, width, 64)
      .setInteractive({ useHandCursor: true });
    hit.on("pointerdown", onTap);

    const draw = (enabled: boolean) => {
      shape.clear();
      shape.fillStyle(fill, enabled ? 1 : 0.35);
      shape.fillRoundedRect(x - width / 2, PAGE.controlsY - 30, width, 60, 30);
      shape.lineStyle(2, PAGE.controlEdge, enabled ? 1 : 0.35);
      shape.strokeRoundedRect(x - width / 2, PAGE.controlsY - 30, width, 60, 30);
    };
    draw(true);

    return {
      setText: (value: string) => caption.setText(value),
      setEnabled: (on: boolean) => {
        draw(on);
        caption.setAlpha(on ? 1 : 0.35);
        if (on) hit.setInteractive({ useHandCursor: true });
        else hit.disableInteractive();
      }
    };
  }

  /*
   * A page turned by hand reads itself, exactly like one turned by the book.
   * Somebody who presses `▶`, or picks `Ñ` out of the list, wants to hear that
   * page — making them press play afterwards is a second step for one intent.
   */
  const back = pill(470, 110, "◀", PAGE.control, PAGE.ink, () =>
    goTo(current - 1, true)
  );
  const playPause = pill(640, 190, "Reproducir", PAGE.accent, "#ffffff", () =>
    togglePlay()
  );
  const forward = pill(810, 110, "▶", PAGE.control, PAGE.ink, () =>
    goTo(current + 1, true)
  );

  function setPlaying(playing: boolean): void {
    playPause.setText(playing ? "Pausar" : "Reproducir");
  }

  function togglePlay(): void {
    if (voice?.isPlaying === true) {
      voice.pause();
      setPlaying(false);
      return;
    }
    if (voice?.isPaused === true) {
      voice.resume();
      setPlaying(true);
      return;
    }
    curtain.hide();
    speak(current);
  }

  function updateArrows(): void {
    back.setEnabled(current > 0);
    forward.setEnabled(current < pages.length - 1);
  }

  /* ----------------------------------------------------------- page picker */

  /**
   * Every page, reachable in one press.
   *
   * The source application had this as an adult's dropdown, and it is what
   * makes a thirty-one page book usable in a twenty minute lesson: a teacher
   * working on `Ñ` opens `Ñ` instead of sitting through twenty-six letters
   * first. It sits at the top of the display, out of the band a child reaches
   * during play.
   */
  const picker = scene.add
    .container(0, 0)
    .setDepth(OVERLAY_DEPTH)
    .setVisible(false);
  const cells: Phaser.GameObjects.Graphics[] = [];

  function cellCentre(position: number): { readonly x: number; readonly y: number } {
    return {
      x: 190 + (position % PICKER_COLUMNS) * 137,
      y: 160 + Math.floor(position / PICKER_COLUMNS) * 104
    };
  }

  const pickerButton = scene.add
    .text(1216, 44, "Páginas", {
      fontFamily: "system-ui",
      fontSize: "24px",
      color: PAGE.ink,
      backgroundColor: "#ffffff",
      padding: { x: 16, y: 10 }
    })
    .setOrigin(1, 0.5)
    .setInteractive({ useHandCursor: true });
  pickerButton.on("pointerdown", () => picker.setVisible(!picker.visible));

  const veil = scene.add
    .rectangle(640, 360, 1280, 720, 0x1b2a3a, 0.85)
    .setInteractive();
  veil.on("pointerdown", () => picker.setVisible(false));
  picker.add(veil);
  picker.add(
    scene.add
      .text(640, 62, "Ir a una página", {
        fontFamily: "system-ui",
        fontSize: "34px",
        color: "#ffffff",
        fontStyle: "bold"
      })
      .setOrigin(0.5)
  );

  pages.forEach((page, index) => {
    const { x, y } = cellCentre(index);
    const cell = scene.add.graphics();
    cells.push(cell);

    const caption = scene.add
      .text(x, y, pageShortLabel(page), {
        fontFamily: "system-ui",
        fontSize: page.kind === "cover" ? "20px" : "30px",
        color: "#ffffff",
        fontStyle: "bold"
      })
      .setOrigin(0.5);

    const hit = scene.add
      .zone(x, y, 124, 88)
      .setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => {
      picker.setVisible(false);
      goTo(index, true);
    });

    picker.add([cell, caption, hit]);
  });

  function highlightPicker(index: number): void {
    cells.forEach((cell, position) => {
      const { x, y } = cellCentre(position);
      cell.clear();
      cell.fillStyle(position === index ? PAGE.accent : 0x3d5163, 1);
      cell.fillRoundedRect(x - 62, y - 44, 124, 88, 14);
    });
  }

  /* ---------------------------------------------------------- the curtain */

  /**
   * What covers the page when it is not ready to be read.
   *
   * One object for three states rather than three overlays, because they are
   * mutually exclusive by nature: the book is waiting to be opened, waiting for
   * a voice, or stopped on a page that will not speak.
   */
  const curtain = (() => {
    const cover = scene.add
      .rectangle(640, 360, 1280, 720, PAGE.backdrop, 0.9)
      .setDepth(OVERLAY_DEPTH - 1);
    const message = scene.add
      .text(640, 360, "", {
        fontFamily: "system-ui",
        fontSize: "40px",
        color: PAGE.ink,
        align: "center",
        fontStyle: "bold"
      })
      .setOrigin(0.5)
      .setDepth(OVERLAY_DEPTH - 1);

    function hide(): void {
      cover.setVisible(false);
      message.setVisible(false);
      cover.disableInteractive();
    }

    const show = (text: string, tappable: boolean) => {
      message.setText(text);
      cover.setVisible(true);
      message.setVisible(true);
      if (tappable) cover.setInteractive({ useHandCursor: true });
      else cover.disableInteractive();
    };

    /*
     * The book opens on a press rather than on arrival. Every browser blocks
     * autoplay until a gesture inside the page, and an aged classroom WebView
     * is the one most likely to refuse a gesture that happened on the map
     * screen before this canvas existed. One press here is unambiguous.
     */
    cover.on("pointerdown", () => {
      if (message.text !== OPEN_PROMPT) return;
      hide();
      speak(current);
    });

    return {
      prompt: () => show(OPEN_PROMPT, true),
      waiting: () => show("Cargando…", false),
      broken: () =>
        show(
          "No se pudo cargar esta página.\nVuelve al mapa e inténtalo de nuevo.",
          false
        ),
      hide
    };
  })();

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, stopVoice);

  goTo(0, false);
}
