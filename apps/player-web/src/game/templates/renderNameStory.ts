import * as Phaser from "phaser";
import { resolveSlot, type ManifestFor } from "@lectoemocion/resource-schema";

export function renderNameStory(
  scene: Phaser.Scene,
  resource: ManifestFor<"name-story">,
  onComplete: () => void
): void {
  scene.add.text(640, 80, "Nuestra clase", {
    fontFamily: "system-ui",
    fontSize: "56px",
    color: "#402060"
  }).setOrigin(0.5);

  /*
   * A cinematic completes when it finishes playing: there is nothing to win.
   * The delay is the last character's entrance, so the chapter is over exactly
   * when the choreography is.
   */
  scene.time.delayedCall(resource.slots.length * 250 + 500, onComplete);

  resource.slots.forEach((slot, index) => {
    const child = resolveSlot(slot);
    const angle = (Math.PI * 2 * index) / resource.slots.length;
    const x = 640 + Math.cos(angle) * 360;
    const y = 380 + Math.sin(angle) * 220;
    const circle = scene.add.circle(x, y, 72, 0xffd166);
    const label = scene.add.text(x, y, child.displayName, {
      fontFamily: "system-ui",
      fontSize: "28px",
      color: "#241133"
    }).setOrigin(0.5);
    circle.setScale(0);
    label.setAlpha(0);
    scene.tweens.add({
      targets: circle,
      scale: 1,
      duration: 500,
      delay: index * 250,
      ease: "Back.Out"
    });
    scene.tweens.add({
      targets: label,
      alpha: 1,
      duration: 300,
      delay: index * 250 + 250
    });
  });
}
