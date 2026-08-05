import * as Phaser from "phaser";
import { assertNever } from "@lectoemocion/domain";
import type { ManifestFor } from "@lectoemocion/resource-schema";
import {
  chooseWordPicture,
  createWordPictureRound
} from "@lectoemocion/template-sdk";
import { addPictureGlyph } from "./pictureGlyph";

const CHOICE_ROW_Y = 480;

export function renderWordPictureGame(
  scene: Phaser.Scene,
  resource: ManifestFor<"word-picture-game">,
  onComplete: () => void
): void {
  let round = createWordPictureRound(resource);

  const banner = scene.add
    .text(640, 70, "¿Cuál es?", {
      fontFamily: "system-ui",
      fontSize: "40px",
      color: "#402060"
    })
    .setOrigin(0.5);

  scene.add
    .rectangle(640, 190, 520, 130, 0xffffff)
    .setStrokeStyle(8, 0x7b2cbf);
  scene.add
    .text(640, 190, round.word, {
      fontFamily: "system-ui",
      fontSize: "72px",
      color: "#241133"
    })
    .setOrigin(0.5);

  const lives = scene.add
    .text(640, 300, "", {
      fontFamily: "system-ui",
      fontSize: "30px",
      color: "#7b2cbf"
    })
    .setOrigin(0.5);

  const frames = new Map<string, Phaser.GameObjects.Rectangle>();
  const total = round.choices.length;
  const spacing = Math.min(300, 1180 / total);

  round.choices.forEach((choice, index) => {
    const x = 640 + (index - (total - 1) / 2) * spacing;
    const frame = scene.add
      .rectangle(x, CHOICE_ROW_Y, 240, 240, 0xffffff)
      .setStrokeStyle(6, 0x7b2cbf)
      .setInteractive({ useHandCursor: true });
    addPictureGlyph(scene, choice.vocabularyItemId, x, CHOICE_ROW_Y, 80);
    frames.set(choice.vocabularyItemId, frame);

    frame.on("pointerdown", () => {
      const result = chooseWordPicture(round, choice.vocabularyItemId);
      round = result.round;
      const outcome = result.attempt;

      switch (outcome.kind) {
        case "correct":
          frame.setFillStyle(0x95d5b2);
          banner.setText("¡Muy bien!");
          for (const other of frames.values()) other.disableInteractive();
          paint();
          onComplete();
          return;
        case "incorrect":
          frame.setFillStyle(0xffadad);
          scene.tweens.add({
            targets: frame,
            x: { from: x - 12, to: x + 12 },
            yoyo: true,
            repeat: 2,
            duration: 70,
            onComplete: () => {
              frame.setX(x).setFillStyle(0xffffff);
            }
          });
          if (round.status === "lost") {
            banner.setText("Vamos a intentarlo otra vez");
            for (const other of frames.values()) other.disableInteractive();
          }
          paint();
          return;
        case "ignored":
          return;
        default:
          assertNever(outcome, "word-picture attempt");
      }
    });
  });

  function paint(): void {
    lives.setText(`Vidas: ${"♥".repeat(round.livesRemaining)}`);
  }

  paint();
}
