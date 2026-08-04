import type { ResourceManifest } from "@lectoemocion/resource-schema";

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

export interface TemplateDefinition {
  id: ResourceManifest["template"]["id"];
  version: 1;
  title: string;
  kind: ResourceKind;
  selection: SelectionStrategy;
  minimumParticipants: number;
  maximumParticipants: number;
}
