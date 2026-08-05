import * as Phaser from "phaser";
import { resolveSlot, type ManifestFor } from "@lectoemocion/resource-schema";

const PAGE_MS = 1800;

/**
 * The non-interactive kind: a fixed timeline, one character per page.
 *
 * Nothing here is interactive by design — no card takes a pointer, and there
 * is no export, download, or share affordance anywhere in the scene
 * (platform-design.md §6.3). It is rendered live rather than encoded as a
 * video, so it always reflects the current slots.
 */
export function renderMemoryAlbum(
  scene: Phaser.Scene,
  resource: ManifestFor<"memory-album">,
  onComplete: () => void
): void {
  const title = scene.add
    .text(640, 90, "Nuestro álbum", {
      fontFamily: "system-ui",
      fontSize: "56px",
      color: "#402060"
    })
    .setOrigin(0.5);

  const pages = resource.slots.map((slot, index) => {
    const character = resolveSlot(slot);
    const frame = scene.add.rectangle(640, 400, 460, 380, 0xffffff)
      .setStrokeStyle(8, 0x7b2cbf)
      .setAlpha(0);
    const portrait = scene.add.circle(640, 350, 110, 0xffd166).setAlpha(0);
    const label = scene.add
      .text(640, 530, character.displayName, {
        fontFamily: "system-ui",
        fontSize: "44px",
        color: "#241133"
      })
      .setOrigin(0.5)
      .setAlpha(0);

    return { index, parts: [frame, portrait, label] };
  });

  pages.forEach(({ index, parts }) => {
    scene.tweens.add({
      targets: parts,
      alpha: 1,
      duration: 400,
      delay: index * PAGE_MS
    });
    scene.tweens.add({
      targets: parts,
      alpha: 0,
      duration: 400,
      delay: index * PAGE_MS + PAGE_MS - 400
    });
  });

  scene.time.delayedCall(pages.length * PAGE_MS, () => {
    title.setText("Fin");
    onComplete();
  });
}
