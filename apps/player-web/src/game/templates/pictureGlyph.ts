import * as Phaser from "phaser";

/**
 * Stands in for a vocabulary item's picture.
 *
 * The manifest names an `imageUrl` for every item, but no default artwork is
 * authored yet, so the player draws a deterministic glyph instead of loading a
 * URL that would 404. Same item, same glyph, in preview and in class.
 */
const PALETTE = [
  0xef476f, 0xffd166, 0x06d6a0, 0x118ab2, 0x9b5de5, 0xf4845f, 0x43aa8b, 0xff70a6
];

function hash(value: string): number {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.codePointAt(0) ?? 0;
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

export function glyphColour(vocabularyItemId: string): number {
  return PALETTE[hash(vocabularyItemId) % PALETTE.length] ?? 0x118ab2;
}

export function addPictureGlyph(
  scene: Phaser.Scene,
  vocabularyItemId: string,
  x: number,
  y: number,
  radius: number
): Phaser.GameObjects.GameObject[] {
  const colour = glyphColour(vocabularyItemId);
  const sides = 3 + (hash(vocabularyItemId) % 4);
  const disc = scene.add.circle(x, y, radius, colour);
  const points: number[] = [];
  for (let index = 0; index < sides; index += 1) {
    const angle = (Math.PI * 2 * index) / sides - Math.PI / 2;
    points.push(Math.cos(angle) * radius * 0.55, Math.sin(angle) * radius * 0.55);
  }
  const inner = scene.add.polygon(x, y, points, 0xffffff, 0.85);
  return [disc, inner];
}
