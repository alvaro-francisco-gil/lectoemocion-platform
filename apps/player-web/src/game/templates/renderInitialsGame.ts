import * as Phaser from "phaser";
import type { ResourceManifest } from "@lectoemocion/resource-schema";

export function renderInitialsGame(
  scene: Phaser.Scene,
  resource: ResourceManifest
): void {
  if (resource.template.id !== "initials-game") {
    throw new Error("Initials renderer received an incompatible resource");
  }
  const targetInitial = resource.template.targetInitial;
  let remaining = resource.participants.filter(
    (child) => child.verifiedInitial === targetInitial
  ).length;

  const instruction = scene.add.text(
    640,
    80,
    `Toca los nombres que empiezan por ${targetInitial}`,
    { fontFamily: "system-ui", fontSize: "42px", color: "#402060" }
  ).setOrigin(0.5);

  resource.participants.forEach((child, index) => {
    const column = index % 4;
    const row = Math.floor(index / 4);
    const x = 260 + column * 250;
    const y = 260 + row * 190;
    const card = scene.add.rectangle(x, y, 210, 130, 0xffffff)
      .setStrokeStyle(6, 0x7b2cbf)
      .setInteractive({ useHandCursor: true });
    const label = scene.add.text(x, y, child.displayName, {
      fontFamily: "system-ui",
      fontSize: "34px",
      color: "#241133"
    }).setOrigin(0.5);

    card.on("pointerdown", () => {
      if (!card.input?.enabled) return;
      if (child.verifiedInitial === targetInitial) {
        card.disableInteractive().setFillStyle(0x95d5b2);
        remaining -= 1;
        if (remaining === 0) {
          instruction.setText("¡Muy bien!");
          scene.tweens.add({
            targets: [instruction, label],
            scale: 1.15,
            yoyo: true,
            duration: 220
          });
        }
      } else {
        scene.tweens.add({
          targets: card,
          x: { from: x - 10, to: x + 10 },
          yoyo: true,
          repeat: 2,
          duration: 70,
          onComplete: () => card.setX(x)
        });
      }
    });
  });
}
