import type { ResourceManifest } from "@lectoemocion/resource-schema";

export type SelectionStrategy =
  | { kind: "whole-class" }
  | { kind: "matching-initial"; initial: string }
  | { kind: "seeded-subset"; count: number };

export interface TemplateDefinition {
  id: ResourceManifest["template"]["id"];
  version: 1;
  title: string;
  kind: "animated-story" | "interactive-game";
  selection: SelectionStrategy;
  minimumParticipants: number;
  maximumParticipants: number;
}
