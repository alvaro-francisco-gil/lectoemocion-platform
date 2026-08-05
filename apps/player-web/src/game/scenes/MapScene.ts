import * as Phaser from "phaser";
import { assertNever } from "@lectoemocion/domain";
import type { MapNodeView, MapView, NodeState } from "../../world/mapView";

const COLUMNS = 3;

/**
 * Draws the map and reports taps.
 *
 * It receives a `MapView` and a callback, and nothing else — no progress, no
 * store, no world graph. Progression is decided in the shell; this scene only
 * knows that a node is locked, open, or done, which is what stops the map
 * quietly becoming a template that reads progress (invariant 2).
 *
 * Nodes sit in the lower reach band: a child aged 3–5 cannot touch the top of
 * an 86-inch display.
 */
export class MapScene extends Phaser.Scene {
  constructor(
    private readonly view: MapView,
    private readonly onSelect: (nodeId: string) => void
  ) {
    super("map");
  }

  create(): void {
    this.add
      .text(640, 70, "El mundo", {
        fontFamily: "system-ui",
        fontSize: "56px",
        color: "#402060"
      })
      .setOrigin(0.5);

    this.view.nodes.forEach((node, index) => this.drawNode(node, index));
  }

  private drawNode(node: MapNodeView, index: number): void {
    const column = index % COLUMNS;
    const row = Math.floor(index / COLUMNS);
    const x = 320 + column * 320;
    const y = 260 + row * 210;

    const card = this.add
      .rectangle(x, y, 280, 150, fillFor(node.state))
      .setStrokeStyle(6, node.playable ? 0x7b2cbf : 0xb9a7c9);

    this.add
      .text(x, y - 18, node.title, {
        fontFamily: "system-ui",
        fontSize: "30px",
        color: node.playable ? "#241133" : "#6f6280",
        align: "center",
        wordWrap: { width: 250 }
      })
      .setOrigin(0.5);

    this.add
      .text(x, y + 46, badgeFor(node), {
        fontFamily: "system-ui",
        fontSize: "22px",
        color: node.playable ? "#4a3a63" : "#6f6280"
      })
      .setOrigin(0.5);

    if (!node.playable) return;

    card
      .setInteractive({ useHandCursor: true })
      .setData("nodeId", node.id)
      .on("pointerdown", () => this.onSelect(node.id));
  }
}

function fillFor(state: NodeState): number {
  switch (state) {
    case "completed":
      return 0x95d5b2;
    case "unlocked":
      return 0xffffff;
    case "locked":
      return 0xe7e1ef;
    default:
      return assertNever(state, "map node state");
  }
}

function badgeFor(node: MapNodeView): string {
  if (node.state === "locked") return "Bloqueado";
  if (node.state === "completed") return "Repetir";
  return node.kind === "cinematic" ? "Historia" : "Jugar";
}
