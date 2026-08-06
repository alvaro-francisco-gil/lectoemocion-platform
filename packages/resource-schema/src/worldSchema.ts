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
  /*
   * A story is named, not inlined. Thirty-one pages written out here would
   * bury the shape of the world in content, and the catalogue is where
   * authored content lives.
   */
  Type.Object(
    {
      template: Type.Literal("illustrated-story"),
      seed: Type.String({ minLength: 1 }),
      storyId: Type.String({ minLength: 1 })
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
  /*
   * A vocabulary game either names its pictures or asks for a number of them,
   * never both. Two branches rather than two optional fields, so "three pairs,
   * but also these four specific ones" cannot be written down and then quietly
   * resolved by whichever field the builder happened to read first.
   */
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
      template: Type.Literal("pairs-game"),
      seed: Type.String({ minLength: 1 }),
      vocabulary: Type.Array(Type.String({ minLength: 1 }), {
        minItems: 2,
        maxItems: 8
      })
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
      template: Type.Literal("word-picture-game"),
      seed: Type.String({ minLength: 1 }),
      targetVocabularyItemId: Type.String({ minLength: 1 }),
      /** The wrong answers, named. The target is added to them. */
      distractors: Type.Array(Type.String({ minLength: 1 }), {
        minItems: 1,
        maxItems: 5
      })
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
  ),
  Type.Object(
    {
      template: Type.Literal("letters-game"),
      seed: Type.String({ minLength: 1 }),
      targetVocabularyItemId: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
  )
]);

/** One animal a child can collect. Engine-neutral: a picture and a name. */
export const CollectibleAnimalSchema = Type.Object(
  {
    animalId: Type.String({ minLength: 1 }),
    label: Type.String({ minLength: 1, maxLength: 40 }),
    imageUrl: Type.String({ minLength: 1 })
  },
  { additionalProperties: false }
);

/**
 * How many chests a node offers.
 *
 * Fixed rather than per-node: three is a choice a child aged 3–5 can hold in
 * mind at once, and a node that offered a different number would make the
 * ceremony a thing to learn again each time.
 */
export const CHEST_COUNT = 3;

/**
 * What a node gives the first time it is finished.
 *
 * The choices are authored, not derived, so a content review can see every
 * animal a child can be handed. Which of the three they get is decided by the
 * chest they open and by nothing else.
 */
const NodeRewardSchema = Type.Object(
  {
    choices: Type.Array(CollectibleAnimalSchema, {
      minItems: CHEST_COUNT,
      maxItems: CHEST_COUNT
    })
  },
  { additionalProperties: false }
);

export const WorldNodeSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    title: Type.String({ minLength: 1, maxLength: 60 }),
    /** Every listed node must be completed before this one opens. */
    unlockedBy: Type.Array(Type.String({ minLength: 1 })),
    resource: NodeResourceSchema,
    reward: NodeRewardSchema
  },
  { additionalProperties: false }
);

export const WorldSchema = Type.Object(
  {
    nodes: Type.Array(WorldNodeSchema, { minItems: 1 })
  },
  { additionalProperties: false }
);

export type CollectibleAnimal = Static<typeof CollectibleAnimalSchema>;
export type NodeReward = Static<typeof NodeRewardSchema>;
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

  /*
   * Three chests must hold three different animals. Two chests hiding the same
   * one turns a choice into a trick: the child weighs three doors and two of
   * them were never distinct.
   */
  for (const node of world.nodes) {
    const animals = new Set(node.reward.choices.map((choice) => choice.animalId));
    if (animals.size !== node.reward.choices.length) {
      throw new Error(`Node ${node.id} offers the same animal in two chests`);
    }
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
