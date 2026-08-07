import { avatarId, type AvatarId } from "@lectoemocion/domain";

export interface Avatar {
  readonly id: AvatarId;
  /**
   * What the animal is called, in Spanish.
   *
   * A picture cannot be read aloud by a screen reader and cannot be described
   * by an adult over the phone, so every avatar carries a word as well.
   */
  readonly label: string;
}

/**
 * The avatars a child may choose from.
 *
 * The pictures are written by `scripts/import-avatars.mjs` into
 * `public/avatars/`, and `avatarCatalogue.test.ts` holds the two sides to each
 * other: a name here with no file, or a file with no name here, fails the
 * suite rather than a classroom.
 *
 * Animals rather than faces. A child choosing a fox is choosing a character,
 * which asks none of the questions that choosing a face for a child would.
 */
export const AVATARS: readonly Avatar[] = [
  { id: avatarId("zorro"), label: "Zorro" },
  { id: avatarId("panda"), label: "Panda" },
  { id: avatarId("gato"), label: "Gato" },
  { id: avatarId("perro"), label: "Perro" },
  { id: avatarId("leon"), label: "León" },
  { id: avatarId("rana"), label: "Rana" },
  { id: avatarId("buho"), label: "Búho" },
  { id: avatarId("pinguino"), label: "Pingüino" },
  { id: avatarId("tortuga"), label: "Tortuga" },
  { id: avatarId("unicornio"), label: "Unicornio" },
  { id: avatarId("koala"), label: "Koala" },
  { id: avatarId("tigre"), label: "Tigre" }
];

/** What the starter profile wears until an adult chooses otherwise. */
export const DEFAULT_AVATAR_ID: AvatarId = avatarId("zorro");

export function avatarImageUrl(id: AvatarId): string {
  return `/avatars/${id}.webp`;
}

/**
 * The label for an id, or the id itself.
 *
 * A profile saved with an avatar this build no longer ships still has to draw
 * *something*: this is the declared personalised-media exception, not a silent
 * fallback around a broken invariant. The picture falls back and play
 * continues.
 */
export function avatarLabel(id: AvatarId): string {
  return AVATARS.find((avatar) => avatar.id === id)?.label ?? id;
}
