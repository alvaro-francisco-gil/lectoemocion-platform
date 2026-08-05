import { Type, type Static } from "@sinclair/typebox";
import Ajv from "ajv";

/**
 * What a node plays, as data.
 *
 * A node names a template and its parameters; it does not hold a function.
 * Content stays engine-neutral and inert (invariant 2), and the dispatcher in
 * `createResourceForNode` is the one place that knows how to build each kind.
 */
const NodeResourceSchema = Type.Union([
  Type.Object(
    {
      template: Type.Literal("name-story"),
      seed: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
  ),
  Type.Object(
    {
      template: Type.Literal("initials-game"),
      seed: Type.String({ minLength: 1 }),
      targetInitial: Type.String({ minLength: 1, maxLength: 2 })
    },
    { additionalProperties: false }
  ),
  Type.Object(
    {
      template: Type.Literal("memory-album"),
      seed: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
  ),
  Type.Object(
    {
      template: Type.Literal("pairs-game"),
      seed: Type.String({ minLength: 1 }),
      pairCount: Type.Integer({ minimum: 2, maximum: 8 })
    },
    { additionalProperties: false }
  ),
  Type.Object(
    {
      template: Type.Literal("word-picture-game"),
      seed: Type.String({ minLength: 1 }),
      targetVocabularyItemId: Type.String({ minLength: 1 }),
      choiceCount: Type.Integer({ minimum: 2, maximum: 6 })
    },
    { additionalProperties: false }
  ),
  Type.Object(
    {
      template: Type.Literal("syllables-game"),
      seed: Type.String({ minLength: 1 }),
      targetVocabularyItemId: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
  )
]);

export const WorldNodeSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    title: Type.String({ minLength: 1, maxLength: 60 }),
    /** Every listed node must be completed before this one opens. */
    unlockedBy: Type.Array(Type.String({ minLength: 1 })),
    resource: NodeResourceSchema
  },
  { additionalProperties: false }
);

export const WorldSchema = Type.Object(
  {
    nodes: Type.Array(WorldNodeSchema, { minItems: 1 })
  },
  { additionalProperties: false }
);

export type NodeResource = Static<typeof NodeResourceSchema>;
export type WorldNode = Static<typeof WorldNodeSchema>;
export type World = Static<typeof WorldSchema>;

const validate = new Ajv({ allErrors: true }).compile(WorldSchema);

/**
 * Validates the graph's shape and then its structure.
 *
 * A broken world is a content defect that must fail closed (invariant 6) with
 * an adult-facing error, rather than rendering a map with a hole in it or a
 * node nobody can ever reach.
 */
export function parseWorld(value: unknown): World {
  if (!validate(value)) {
    throw new Error(`Invalid world: ${JSON.stringify(validate.errors)}`);
  }
  const world = value as World;

  const ids = new Set<string>();
  for (const node of world.nodes) {
    if (ids.has(node.id)) {
      throw new Error(`Duplicate world node id: ${node.id}`);
    }
    ids.add(node.id);
  }

  for (const node of world.nodes) {
    for (const required of node.unlockedBy) {
      if (!ids.has(required)) {
        throw new Error(`Node ${node.id} is unlocked by unknown node ${required}`);
      }
    }
  }

  const entries = world.nodes.filter((node) => node.unlockedBy.length === 0);
  if (entries.length === 0) {
    throw new Error("The world has no entry node: nothing is playable");
  }

  /*
   * Reachability doubles as the cycle check. A node in a cycle can never have
   * all its prerequisites met, so it never becomes reachable.
   */
  const reachable = new Set(entries.map((node) => node.id));
  let grew = true;
  while (grew) {
    grew = false;
    for (const node of world.nodes) {
      if (reachable.has(node.id)) continue;
      if (node.unlockedBy.every((id) => reachable.has(id))) {
        reachable.add(node.id);
        grew = true;
      }
    }
  }

  const stranded = world.nodes.filter((node) => !reachable.has(node.id));
  if (stranded.length > 0) {
    throw new Error(
      `Unreachable world nodes: ${stranded.map((node) => node.id).join(", ")}`
    );
  }

  return world;
}
