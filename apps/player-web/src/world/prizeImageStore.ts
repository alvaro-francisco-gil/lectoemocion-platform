import type { PrizeImageId } from "@lectoemocion/domain";

/**
 * A picture a child looks at on a map card, not a photograph to keep.
 *
 * A phone photo is several megabytes and the whole `localStorage` origin quota
 * is about five, so an un-resized upload would take the prize list down with
 * it. 512px is past what any card here renders.
 */
export const MAX_PRIZE_IMAGE_EDGE = 512;
export const PRIZE_IMAGE_QUALITY = 0.7;

/**
 * One key per picture, under the child whose gift it is inside.
 *
 * Separate from the prize list on purpose: a quota failure then costs one
 * picture, and the prize survives with the words the adult will read aloud.
 *
 * `owner` is the playing profile's id, because a picture belongs to the gift it
 * is inside and a gift belongs to the child who earned it. The goal is the only
 * part of the prizes that is the group's.
 */
export function prizeImageKey(owner: string, id: PrizeImageId): string {
  return `lectoemocion.prizeImage.${owner}.${id}`;
}

export type PrizePickProblem = "unreadable-picture" | "no-room";

/**
 * What came of an adult picking a photo.
 *
 * A result rather than `PrizeImageId | null`, on the same terms as
 * `checkPrizeGoal`: `null` collapses "the browser could not read that file"
 * and "there was no room to keep it" into silence, and the adult saves the
 * prize believing a picture is attached. Naming the problem is what lets the
 * form say which one happened — and still save the words, which are the half
 * an adult reads aloud.
 */
export type PrizePick =
  | { readonly ok: true; readonly id: PrizeImageId }
  | { readonly ok: false; readonly problem: PrizePickProblem };

export interface FittedSize {
  readonly width: number;
  readonly height: number;
}

/** Fits a picture inside a square, by its long edge, keeping its proportions. */
export function fittedSize(
  width: number,
  height: number,
  maxEdge: number
): FittedSize {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

type ImageStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface PrizeImageStore {
  /** `false` when storage refused it. The caller keeps the prize's words. */
  save(id: PrizeImageId, dataUrl: string): Promise<boolean>;
  read(id: PrizeImageId): Promise<string | null>;
  remove(id: PrizeImageId): Promise<void>;
}

export class LocalPrizeImageStore implements PrizeImageStore {
  constructor(
    private readonly storage: ImageStorage,
    private readonly owner: string
  ) {}

  async save(id: PrizeImageId, dataUrl: string): Promise<boolean> {
    try {
      this.storage.setItem(prizeImageKey(this.owner, id), dataUrl);
      return true;
    } catch {
      /*
       * Quota, or a browser denying storage outright. Reported rather than
       * thrown: the prize keeps the words, which is the half an adult reads.
       */
      return false;
    }
  }

  async read(id: PrizeImageId): Promise<string | null> {
    try {
      return this.storage.getItem(prizeImageKey(this.owner, id));
    } catch {
      return null;
    }
  }

  async remove(id: PrizeImageId): Promise<void> {
    try {
      this.storage.removeItem(prizeImageKey(this.owner, id));
    } catch {
      /* Nothing to recover: the picture is already unreachable. */
    }
  }
}

/**
 * Turns what an adult picked into a small JPEG, in the browser.
 *
 * The bytes never leave the device. `createImageBitmap` and a canvas are the
 * only path available in an aged WebView; a failure to decode throws, and the
 * caller turns it into a `PrizePick` of `"unreadable-picture"` so the adult is
 * shown that the picture did not work rather than storing something a child
 * would see as a broken card.
 */
export async function downscaleToDataUrl(
  file: Blob,
  maxEdge: number = MAX_PRIZE_IMAGE_EDGE
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const size = fittedSize(bitmap.width, bitmap.height, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;

  const context = canvas.getContext("2d");
  if (context === null) throw new Error("No 2D context for the prize picture");
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();

  return canvas.toDataURL("image/jpeg", PRIZE_IMAGE_QUALITY);
}
