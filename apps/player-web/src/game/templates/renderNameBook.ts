import * as Phaser from "phaser";
import {
  pageLetterLabel,
  type ManifestFor,
  type NameBookPage,
  type PersonalisedCharacter
} from "@lectoemocion/resource-schema";
import { createPicker, createPill, createProgressBar } from "./bookChrome";
import { PAGE } from "./storyPageFrame";

const PHOTO_PREFIX = "name-photo:";

export function namePhotoKey(name: PersonalisedCharacter): string {
  return `${PHOTO_PREFIX}${name.childRecordId}`;
}

function nameVoiceKey(name: PersonalisedCharacter): string {
  return `name-voice:${name.childRecordId}`;
}

/**
 * Whether a loader key belongs to a child's photo.
 *
 * `ResourceScene` asks this to decide whether a failed load is fatal. A child's
 * photo is the only *personalised* asset in the player, so it is the only one
 * whose absence is invariant 6's exception rather than its fail-closed rule.
 */
export function isNamePhotoKey(key: string): boolean {
  return key.startsWith(PHOTO_PREFIX);
}

/**
 * Queues every photo the book needs.
 *
 * Call from a scene's `preload`, like `queueStoryPictures`. A page turn should
 * never wait on a picture, and the whole class is a handful of small images —
 * far less than a story's pages. The recordings are not queued: they are
 * fetched when a face is actually tapped, because most never will be.
 */
export function queueNamePhotos(
  scene: Phaser.Scene,
  pages: readonly NameBookPage[]
): void {
  for (const page of pages) {
    for (const name of page.names) {
      scene.load.image(namePhotoKey(name), name.photoUrl);
    }
  }
}

/* The area the cards are laid out in, between the letter and the controls. */
const GRID = { left: 300, top: 120, width: 900, height: 460 } as const;
const MAX_COLUMNS = 5;

/**
 * El libro de los nombres: the class's own names, a letter to a page.
 *
 * It is a book to linger on rather than one to be read to, which is the whole
 * difference from `El gallo Rayo` beside it. Nothing plays on its own and no
 * page turns itself: a child stays on their own letter for as long as they
 * want, and taps a face to hear that name. What is being taught is that these
 * marks are somebody — most often themselves — and that is not something to be
 * paced through.
 *
 * Reaching the last page finishes the chapter, once. `completed` guards the
 * replay, because a book can be opened again from the letter picker and a
 * second finish would pay the child twice for one chapter.
 */
export function renderNameBook(
  scene: Phaser.Scene,
  resource: ManifestFor<"name-book">,
  onComplete: () => void
): void {
  const pages = resource.pages;
  scene.cameras.main.setBackgroundColor(PAGE.backdrop);

  const progress = createProgressBar(scene);
  let current = -1;
  let completed = false;
  let voice: Phaser.Sound.BaseSound | null = null;
  /** Everything drawn for the page on screen, cleared on every turn. */
  let cards: Phaser.GameObjects.GameObject[] = [];

  const label = scene.add.text(64, 40, "", {
    fontFamily: "system-ui",
    fontSize: "30px",
    color: PAGE.ink,
    fontStyle: "bold"
  });

  /* The letter itself, big enough to be the page rather than a caption on it. */
  const letter = scene.add
    .text(150, 330, "", {
      fontFamily: "system-ui",
      fontSize: "180px",
      color: PAGE.ink,
      fontStyle: "bold"
    })
    .setOrigin(0.5);

  const counter = scene.add
    .text(1216, 606, "", {
      fontFamily: "system-ui",
      fontSize: "24px",
      color: PAGE.quiet
    })
    .setOrigin(1, 0.5);

  /* ---------------------------------------------------------------- voices */

  function stopVoice(): void {
    voice?.destroy();
    voice = null;
  }

  /**
   * Says a name aloud, fetching the recording the first time it is asked for.
   *
   * A recording that never arrives is the same declared exception as a missing
   * photo: the card still enlarges and the name is still written, and the book
   * carries on. There is nothing adult-facing to report, because there is
   * nothing an adult reading this screen could do about it mid-page.
   */
  function say(name: PersonalisedCharacter): void {
    const key = nameVoiceKey(name);
    stopVoice();

    if (scene.cache.audio.exists(key)) {
      voice = scene.sound.add(key);
      voice.play();
      return;
    }

    scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
      if (!scene.cache.audio.exists(key)) return;
      voice = scene.sound.add(key);
      voice.play();
    });
    scene.load.audio(key, name.pronunciationUrl);
    scene.load.start();
  }

  /* ----------------------------------------------------------------- cards */

  /**
   * One name: the face above, the name written below.
   *
   * The written name is always there, never revealed by the tap. A child
   * learning to recognise their own name has to see it while they hear it, and
   * a card that hid it until pressed would be a guessing game instead.
   */
  function drawCard(
    name: PersonalisedCharacter,
    x: number,
    y: number,
    size: number
  ): void {
    const plate = scene.add.graphics();
    plate.fillStyle(PAGE.sheet, 1);
    plate.fillRoundedRect(x - size / 2, y - size / 2, size, size * 1.28, PAGE.radius);
    plate.lineStyle(2, PAGE.sheetEdge, 1);
    plate.strokeRoundedRect(x - size / 2, y - size / 2, size, size * 1.28, PAGE.radius);
    cards.push(plate);

    /*
     * A photo that failed to load leaves the card without one rather than
     * without the child. `textures.exists` is the check: the loader has already
     * finished by the time a page is drawn, and a missing personalised asset is
     * invariant 6's exception.
     */
    let picture: Phaser.GameObjects.Image | null = null;
    if (scene.textures.exists(namePhotoKey(name))) {
      const image = scene.add.image(x, y - size * 0.06, namePhotoKey(name));
      const scale = Math.min(
        (size * 0.78) / image.width,
        (size * 0.78) / image.height
      );
      image.setScale(scale);
      picture = image;
      cards.push(image);
    }

    const written = scene.add
      .text(x, y + size * 0.52, name.displayName, {
        fontFamily: "system-ui",
        fontSize: `${Math.round(size * 0.2)}px`,
        color: PAGE.ink,
        fontStyle: "bold"
      })
      .setOrigin(0.5);
    cards.push(written);

    const hit = scene.add
      .zone(x, y + size * 0.14, size, size * 1.28)
      .setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => {
      say(name);
      /* A press has to show it landed, on a card that may have no picture. */
      scene.tweens.add({
        targets: picture === null ? written : [picture, written],
        scale: "*=1.12",
        yoyo: true,
        duration: 160
      });
    });
    cards.push(hit);
  }

  /**
   * Lays a page out.
   *
   * The grid is derived from how many names the letter has, so a page with two
   * children gives them a card each the size of a hand rather than two small
   * ones adrift in the space a class of thirty would have filled.
   */
  function drawPage(page: NameBookPage): void {
    for (const card of cards) card.destroy();
    cards = [];

    const count = page.names.length;
    const columns = Math.min(MAX_COLUMNS, count);
    const rows = Math.ceil(count / columns);
    const cellWidth = GRID.width / columns;
    const cellHeight = GRID.height / rows;
    const size = Math.min(cellWidth, cellHeight / 1.28) * 0.86;

    page.names.forEach((name, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      drawCard(
        name,
        GRID.left + cellWidth * (column + 0.5),
        GRID.top + cellHeight * (row + 0.5),
        size
      );
    });
  }

  /* --------------------------------------------------------------- turning */

  function goTo(index: number): void {
    const page = pages[index];
    if (page === undefined) return;

    stopVoice();
    current = index;
    drawPage(page);
    label.setText(pageLetterLabel(page));
    letter.setText(page.grapheme);
    counter.setText(`${index + 1} / ${pages.length}`);
    progress.draw(index, pages.length);
    picker.highlight(index);
    back.setEnabled(index > 0);
    forward.setEnabled(index < pages.length - 1);

    if (index === pages.length - 1 && !completed) {
      completed = true;
      onComplete();
    }
  }

  /* -------------------------------------------------------------- controls */

  const back = createPill(scene, {
    x: 470,
    width: 110,
    text: "◀",
    fill: PAGE.control,
    colour: PAGE.ink,
    onTap: () => goTo(current - 1)
  });
  const forward = createPill(scene, {
    x: 810,
    width: 110,
    text: "▶",
    fill: PAGE.control,
    colour: PAGE.ink,
    onTap: () => goTo(current + 1)
  });

  const picker = createPicker(scene, {
    buttonLabel: "Letras",
    title: "Ir a una letra",
    labels: pages.map((page) => page.grapheme),
    onPick: goTo
  });

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, stopVoice);

  goTo(0);
}
