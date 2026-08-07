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
   * The book of names carries a seed and nothing else. What is in it is the
   * group's own roster, which the player supplies at play time — naming
   * children here would put child data in authored content, where it must
   * never live.
   */
  Type.Object(
    {
      template: Type.Literal("name-book"),
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
      template: Type.Literal("initial-letter-game"),
      seed: Type.String({ minLength: 1 }),
      pictureCount: Type.Integer({ minimum: 3, maximum: 4 })
    },
    { additionalProperties: false }
  ),
  Type.Object(
    {
      template: Type.Literal("initial-letter-game"),
      seed: Type.String({ minLength: 1 }),
      vocabulary: Type.Array(Type.String({ minLength: 1 }), {
        minItems: 3,
        maxItems: 4
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
  /*
   * The target only. Its match and its distractors are drawn from the same
   * catalogue by seed, so a node cannot name a "match" that does not open with
   * the target's syllable — the one thing this game is about.
   */
  Type.Object(
    {
      template: Type.Literal("initial-syllable-game"),
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
 * What a node gives the first time it is finished.
 *
 * One animal, authored rather than derived, so a content review can see every
 * animal a child can be handed. The chests the ceremony offers are theatre:
 * they are how the reward is handed over, not what it is, and how many of them
 * there are is a question for the shell rather than for the world.
 *
 * One rather than a choice of three because the book shows a child the shadow
 * of what each chapter still owes them. A shadow can only promise a specific
 * animal if the chapter grants a specific animal.
 */
const NodeRewardSchema = Type.Object(
  { animal: CollectibleAnimalSchema },
  { additionalProperties: false }
);

export const WorldNodeSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    title: Type.String({ minLength: 1, maxLength: 60 }),
    /**
     * The picture that stands for this chapter.
     *
     * Required, because it is how a child who cannot read finds a chapter
     * again: the world is a row of pictures, not a row of numbered buttons, and
     * a node without one would be a hole a three-year-old cannot navigate. The
     * title stays for the adult and for the screen reader.
     */
    icon: Type.String({ minLength: 1 }),
    /**
     * Which of the shell's sections this chapter stands in.
     *
     * Authored, never derived from the template. "A book belongs on the shelf"
     * is a rule that breaks the first time a game belongs there or a story
     * belongs on the path — and it would break silently, by filing the node
     * under the wrong section. Required with no default, so a node whose place
     * nobody decided is a content error rather than a node missing from both.
     */
    surface: Type.Union([Type.Literal("juegos"), Type.Literal("recursos")]),
    /** Every listed node must be completed before this one opens. */
    unlockedBy: Type.Array(Type.String({ minLength: 1 })),
    resource: NodeResourceSchema,
    reward: NodeRewardSchema
  },
  { additionalProperties: false }
);

export const WorldSchema = Type.Object(
  {
    /**
     * Every chapter, in the order a child meets them.
     *
     * One flat list: the world is one scroll rather than a set of places to
     * walk between, and what a child may reach is `unlockedBy` node by node.
     */
    nodes: Type.Array(WorldNodeSchema, { minItems: 1 })
  },
  { additionalProperties: false }
);

export type CollectibleAnimal = Static<typeof CollectibleAnimalSchema>;
export type NodeReward = Static<typeof NodeRewardSchema>;
export type NodeResource = Static<typeof NodeResourceSchema>;
export type WorldNode = Static<typeof WorldNodeSchema>;
export type World = Static<typeof WorldSchema>;

/** Every chapter in the world, in authored order. */
export function worldNodes(world: World): readonly WorldNode[] {
  return world.nodes;
}

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
  const nodes = worldNodes(world);

  const ids = new Set<string>();
  for (const node of nodes) {
    if (ids.has(node.id)) {
      throw new Error(`Duplicate world node id: ${node.id}`);
    }
    ids.add(node.id);
  }

  /*
   * No two chapters may grant the same animal. The book draws one page per
   * chapter and fills it with that chapter's animal, so a repeat would print
   * the same shadow twice and leave a page that can never be filled.
   */
  const animals = new Set<string>();
  for (const node of nodes) {
    const { animalId } = node.reward.animal;
    if (animals.has(animalId)) {
      throw new Error(`Two chapters grant the same animal: ${animalId}`);
    }
    animals.add(animalId);
  }

  for (const node of nodes) {
    for (const required of node.unlockedBy) {
      if (!ids.has(required)) {
        throw new Error(`Node ${node.id} is unlocked by unknown node ${required}`);
      }
    }
  }

  const entries = nodes.filter((node) => node.unlockedBy.length === 0);
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
    for (const node of nodes) {
      if (reachable.has(node.id)) continue;
      if (node.unlockedBy.every((id) => reachable.has(id))) {
        reachable.add(node.id);
        grew = true;
      }
    }
  }

  const stranded = nodes.filter((node) => !reachable.has(node.id));
  if (stranded.length > 0) {
    throw new Error(
      `Unreachable world nodes: ${stranded.map((node) => node.id).join(", ")}`
    );
  }

  return world;
}
