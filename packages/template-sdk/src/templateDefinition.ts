import type { TemplateIdentifier } from "@lectoemocion/resource-schema";

/**
 * Resource kinds as defined in docs/product/platform-design.md section 6.3.
 *
 * `map` is deliberately absent: the map hub reads progress state, which
 * templates must not access, so it belongs to the player shell rather than the
 * catalogue.
 */
export type ResourceKind = "cinematic" | "minigame" | "non-interactive";

export type SelectionStrategy =
  | { kind: "whole-class" }
  | { kind: "matching-initial"; initial: string }
  | { kind: "seeded-subset"; count: number };

/**
 * What kind of thing each template is.
 *
 * A total `Record` over `TemplateIdentifier`, so adding a template fails to
 * compile here until its kind is declared. The world cannot silently acquire a
 * node it does not know how to describe.
 *
 * This replaced a `TemplateDefinition` interface that nothing constructed and
 * that still described participants rather than slots.
 */
export const TEMPLATE_KINDS: Record<TemplateIdentifier, ResourceKind> = {
  "name-story": "cinematic",
  "illustrated-story": "cinematic",
  "initials-game": "minigame",
  "memory-album": "non-interactive",
  "pairs-game": "minigame",
  "word-picture-game": "minigame",
  "initial-letter-game": "minigame",
  "syllables-game": "minigame",
  "initial-syllable-game": "minigame",
  "letters-game": "minigame"
};

export function templateKind(id: TemplateIdentifier): ResourceKind {
  return TEMPLATE_KINDS[id];
}
