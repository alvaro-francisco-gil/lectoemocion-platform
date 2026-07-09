# Foundation and Synthetic Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the TypeScript workspace, engine-neutral resource contracts, deterministic template system, and a browser-playable animated story plus initials game using synthetic data.

**Architecture:** Shared packages own domain records, JSON-compatible resource manifests, validation, and deterministic participant selection. A React/Vite web shell owns routing and resource selection while a Phaser adapter renders template scenes; Phaser types never appear in shared contracts. This plan uses no backend, authentication, uploads, or real child data.

**Tech Stack:** pnpm workspaces, Turborepo, TypeScript, React, Vite, Phaser, TypeBox, Ajv, Vitest, Testing Library, Playwright

---

## Scope

This plan implements roadmap stage 1 only. All fixtures use generated names,
geometric avatars, and synthetic audio-free content. Do not add Firebase,
authentication, object storage, camera access, microphone access, analytics, or
production deployment.

The player pins Phaser 4.2.0, the current stable major release. Phaser is
isolated behind the player adapter so future renderer changes do not affect
resource contracts.

## Target file structure

```text
apps/player-web/
  src/
    app/App.tsx
    app/App.test.tsx
    game/createGame.ts
    game/createGame.test.ts
    game/scenes/ResourceScene.ts
    game/templates/renderInitialsGame.ts
    game/templates/renderNameStory.ts
    main.tsx
    styles.css
  e2e/player.spec.ts
  index.html
  package.json
  playwright.config.ts
  tsconfig.json
  vite.config.ts

packages/domain/
  src/childRecord.ts
  src/index.ts
  src/initial.ts
  src/initial.test.ts
  package.json
  tsconfig.json

packages/resource-schema/
  src/index.ts
  src/resourceManifest.ts
  src/resourceManifest.test.ts
  package.json
  tsconfig.json

packages/template-sdk/
  src/index.ts
  src/participantSelection.ts
  src/participantSelection.test.ts
  src/templateDefinition.ts
  package.json
  tsconfig.json

packages/template-catalog/
  src/fixtures/syntheticClass.ts
  src/index.ts
  src/initialsGame.ts
  src/nameStory.ts
  src/templates.test.ts
  package.json
  tsconfig.json

package.json
pnpm-workspace.yaml
turbo.json
tsconfig.base.json
vitest.config.ts
```

### Task 1: Initialise the TypeScript workspace

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`

- [ ] **Step 1: Create the root package manifest**

Create `package.json`:

```json
{
  "name": "lectoemocion-platform",
  "private": true,
  "packageManager": "pnpm@10.34.4",
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev --filter=@lectoemocion/player-web",
    "test": "vitest run",
    "test:e2e": "pnpm --filter @lectoemocion/player-web test:e2e",
    "typecheck": "turbo run typecheck"
  },
  "devDependencies": {
    "@vitest/coverage-v8": "^4.1.10",
    "turbo": "^2.10.4",
    "typescript": "^7.0.2",
    "vitest": "^4.1.10"
  }
}
```

- [ ] **Step 2: Define workspace and task configuration**

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - apps/*
  - packages/*
```

Create `turbo.json`:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "typecheck": {
      "dependsOn": ["^typecheck"]
    }
  }
}
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "packages/*/vitest.config.ts",
      "apps/player-web/vitest.config.ts"
    ]
  }
});
```

- [ ] **Step 3: Define strict shared TypeScript settings**

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noEmit": true,
    "skipLibCheck": true,
    "useDefineForClassFields": true
  }
}
```

Create `.gitignore`:

```gitignore
node_modules/
dist/
coverage/
playwright-report/
test-results/
.turbo/
.env
.env.*
!.env.example
```

- [ ] **Step 4: Install the locked dependency graph**

Run:

```bash
pnpm install
```

Expected: exit code 0 and a new `pnpm-lock.yaml`.

- [ ] **Step 5: Verify the installed toolchain**

Run:

```bash
pnpm exec tsc --version
pnpm exec turbo --version
```

Expected: both commands exit 0 and print the installed TypeScript and Turbo
versions.

- [ ] **Step 6: Commit**

```bash
git add .gitignore package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json vitest.config.ts
git commit -m "build: initialize TypeScript workspace"
```

### Task 2: Define child records and Spanish initial normalisation

**Files:**
- Create: `packages/domain/package.json`
- Create: `packages/domain/tsconfig.json`
- Create: `packages/domain/vitest.config.ts`
- Create: `packages/domain/src/childRecord.ts`
- Create: `packages/domain/src/initial.ts`
- Create: `packages/domain/src/initial.test.ts`
- Create: `packages/domain/src/index.ts`

- [ ] **Step 1: Configure the domain package**

Create `packages/domain/package.json`:

```json
{
  "name": "@lectoemocion/domain",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "tsc --noEmit",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^7.0.2",
    "vitest": "^4.1.10"
  }
}
```

Create `packages/domain/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

Create `packages/domain/vitest.config.ts`:

```ts
import { defineProject } from "vitest/config";

export default defineProject({
  test: { environment: "node" }
});
```

- [ ] **Step 2: Write failing normalisation tests**

Create `packages/domain/src/initial.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { deriveInitial } from "./initial";

describe("deriveInitial", () => {
  it.each([
    ["Ana", "A"],
    ["álex", "A"],
    ["Érika", "E"],
    ["Íñigo", "I"],
    ["Óscar", "O"],
    ["Úrsula", "U"],
    ["ñora", "Ñ"]
  ])("derives %s as %s", (name, expected) => {
    expect(deriveInitial(name)).toBe(expected);
  });

  it("rejects an empty name", () => {
    expect(() => deriveInitial("   ")).toThrow("Name must not be empty");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run:

```bash
pnpm test packages/domain/src/initial.test.ts
```

Expected: FAIL because `./initial` does not exist.

- [ ] **Step 4: Implement domain types and normalisation**

Create `packages/domain/src/initial.ts`:

```ts
export function deriveInitial(name: string): string {
  const firstCharacter = Array.from(name.trim())[0];
  if (!firstCharacter) {
    throw new Error("Name must not be empty");
  }

  if (firstCharacter.toLocaleUpperCase("es-ES") === "Ñ") {
    return "Ñ";
  }

  return firstCharacter
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleUpperCase("es-ES");
}
```

Create `packages/domain/src/childRecord.ts`:

```ts
export type ChildRecordId = string;

export interface ChildRecord {
  id: ChildRecordId;
  displayName: string;
  verifiedInitial: string;
  photoAssetId: string;
  pronunciationAssetId: string;
}
```

Create `packages/domain/src/index.ts`:

```ts
export type { ChildRecord, ChildRecordId } from "./childRecord";
export { deriveInitial } from "./initial";
```

- [ ] **Step 5: Run tests and type checking**

Run:

```bash
pnpm test packages/domain/src/initial.test.ts
pnpm --filter @lectoemocion/domain typecheck
```

Expected: 8 tests pass and type checking exits 0.

- [ ] **Step 6: Commit**

```bash
git add packages/domain
git commit -m "feat(domain): define child records and initials"
```

### Task 3: Define and validate the engine-neutral resource manifest

**Files:**
- Create: `packages/resource-schema/package.json`
- Create: `packages/resource-schema/tsconfig.json`
- Create: `packages/resource-schema/vitest.config.ts`
- Create: `packages/resource-schema/src/resourceManifest.ts`
- Create: `packages/resource-schema/src/resourceManifest.test.ts`
- Create: `packages/resource-schema/src/index.ts`

- [ ] **Step 1: Configure the schema package**

Create `packages/resource-schema/package.json`:

```json
{
  "name": "@lectoemocion/resource-schema",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "tsc --noEmit",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@sinclair/typebox": "^0.34.50",
    "ajv": "^8.20.0"
  },
  "devDependencies": {
    "typescript": "^7.0.2",
    "vitest": "^4.1.10"
  }
}
```

Create `packages/resource-schema/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

Create `packages/resource-schema/vitest.config.ts`:

```ts
import { defineProject } from "vitest/config";

export default defineProject({
  test: { environment: "node" }
});
```

- [ ] **Step 2: Write failing manifest validation tests**

Create `packages/resource-schema/src/resourceManifest.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseResourceManifest } from "./resourceManifest";

const validManifest = {
  schemaVersion: 1,
  resourceId: "resource-1",
  template: { id: "name-story", version: 1 },
  seed: "class-a-lesson-1",
  participants: [
    {
      childRecordId: "child-1",
      displayName: "Luna",
      verifiedInitial: "L",
      photoUrl: "/synthetic/luna.svg",
      pronunciationUrl: "/synthetic/silence.mp3"
    }
  ]
};

describe("parseResourceManifest", () => {
  it("accepts a valid version-one manifest", () => {
    expect(parseResourceManifest(validManifest)).toEqual(validManifest);
  });

  it("rejects executable template data", () => {
    expect(() =>
      parseResourceManifest({
        ...validManifest,
        script: "alert('unsafe')"
      })
    ).toThrow("Invalid resource manifest");
  });

  it("rejects an unknown schema version", () => {
    expect(() =>
      parseResourceManifest({ ...validManifest, schemaVersion: 2 })
    ).toThrow("Invalid resource manifest");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run:

```bash
pnpm test packages/resource-schema/src/resourceManifest.test.ts
```

Expected: FAIL because `./resourceManifest` does not exist.

- [ ] **Step 4: Implement the closed manifest schema**

Create `packages/resource-schema/src/resourceManifest.ts`:

```ts
import { Type, type Static } from "@sinclair/typebox";
import Ajv from "ajv";

export const ParticipantSchema = Type.Object(
  {
    childRecordId: Type.String({ minLength: 1 }),
    displayName: Type.String({ minLength: 1, maxLength: 80 }),
    verifiedInitial: Type.String({ minLength: 1, maxLength: 2 }),
    photoUrl: Type.String({ minLength: 1 }),
    pronunciationUrl: Type.String({ minLength: 1 })
  },
  { additionalProperties: false }
);

export const ResourceManifestSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    resourceId: Type.String({ minLength: 1 }),
    template: Type.Union([
      Type.Object(
        {
          id: Type.Literal("name-story"),
          version: Type.Literal(1)
        },
        { additionalProperties: false }
      ),
      Type.Object(
        {
          id: Type.Literal("initials-game"),
          version: Type.Literal(1),
          targetInitial: Type.String({ minLength: 1, maxLength: 2 })
        },
        { additionalProperties: false }
      )
    ]),
    seed: Type.String({ minLength: 1 }),
    participants: Type.Array(ParticipantSchema, {
      minItems: 1,
      maxItems: 30
    })
  },
  { additionalProperties: false }
);

export type ResourceManifest = Static<typeof ResourceManifestSchema>;

const validate = new Ajv({ allErrors: true }).compile(ResourceManifestSchema);

export function parseResourceManifest(value: unknown): ResourceManifest {
  if (!validate(value)) {
    throw new Error(`Invalid resource manifest: ${JSON.stringify(validate.errors)}`);
  }
  return value as ResourceManifest;
}
```

Create `packages/resource-schema/src/index.ts`:

```ts
export {
  ParticipantSchema,
  ResourceManifestSchema,
  parseResourceManifest
} from "./resourceManifest";
export type { ResourceManifest } from "./resourceManifest";
```

- [ ] **Step 5: Run tests and type checking**

Run:

```bash
pnpm install
pnpm test packages/resource-schema/src/resourceManifest.test.ts
pnpm --filter @lectoemocion/resource-schema typecheck
```

Expected: 3 tests pass and type checking exits 0.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml packages/resource-schema
git commit -m "feat(schema): add versioned resource manifest"
```

### Task 4: Add deterministic participant selection and template contracts

**Files:**
- Create: `packages/template-sdk/package.json`
- Create: `packages/template-sdk/tsconfig.json`
- Create: `packages/template-sdk/vitest.config.ts`
- Create: `packages/template-sdk/src/templateDefinition.ts`
- Create: `packages/template-sdk/src/participantSelection.ts`
- Create: `packages/template-sdk/src/participantSelection.test.ts`
- Create: `packages/template-sdk/src/index.ts`

- [ ] **Step 1: Configure the template SDK package**

Create `packages/template-sdk/package.json`:

```json
{
  "name": "@lectoemocion/template-sdk",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "tsc --noEmit",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@lectoemocion/domain": "workspace:*",
    "@lectoemocion/resource-schema": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^7.0.2",
    "vitest": "^4.1.10"
  }
}
```

Create `packages/template-sdk/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

Create `packages/template-sdk/vitest.config.ts`:

```ts
import { defineProject } from "vitest/config";

export default defineProject({
  test: { environment: "node" }
});
```

- [ ] **Step 2: Write deterministic-selection tests**

Create `packages/template-sdk/src/participantSelection.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { ChildRecord } from "@lectoemocion/domain";
import { selectParticipants } from "./participantSelection";

const roster: ChildRecord[] = [
  { id: "1", displayName: "Ana", verifiedInitial: "A", photoAssetId: "p1", pronunciationAssetId: "a1" },
  { id: "2", displayName: "Álex", verifiedInitial: "A", photoAssetId: "p2", pronunciationAssetId: "a2" },
  { id: "3", displayName: "Bruno", verifiedInitial: "B", photoAssetId: "p3", pronunciationAssetId: "a3" },
  { id: "4", displayName: "Luna", verifiedInitial: "L", photoAssetId: "p4", pronunciationAssetId: "a4" }
];

describe("selectParticipants", () => {
  it("returns the whole class without mutation", () => {
    expect(selectParticipants(roster, { kind: "whole-class" }, "seed")).toEqual(roster);
    expect(roster.map((child) => child.id)).toEqual(["1", "2", "3", "4"]);
  });

  it("filters records by verified initial", () => {
    expect(
      selectParticipants(roster, { kind: "matching-initial", initial: "A" }, "seed")
        .map((child) => child.id)
    ).toEqual(["1", "2"]);
  });

  it("returns the same seeded subset on repeated calls", () => {
    const strategy = { kind: "seeded-subset", count: 2 } as const;
    expect(selectParticipants(roster, strategy, "lesson-1"))
      .toEqual(selectParticipants(roster, strategy, "lesson-1"));
  });

  it("rejects an oversized subset", () => {
    expect(() =>
      selectParticipants(roster, { kind: "seeded-subset", count: 5 }, "seed")
    ).toThrow("requires 5 participants but only 4 are available");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run:

```bash
pnpm install
pnpm test packages/template-sdk/src/participantSelection.test.ts
```

Expected: FAIL because `./participantSelection` does not exist.

- [ ] **Step 4: Implement selection and template definitions**

Create `packages/template-sdk/src/templateDefinition.ts`:

```ts
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
```

Create `packages/template-sdk/src/participantSelection.ts`:

```ts
import type { ChildRecord } from "@lectoemocion/domain";
import type { SelectionStrategy } from "./templateDefinition";

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (const character of seed) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function nextRandom(state: number): [number, number] {
  const next = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return [next / 2 ** 32, next];
}

export function selectParticipants(
  roster: readonly ChildRecord[],
  strategy: SelectionStrategy,
  seed: string
): ChildRecord[] {
  if (strategy.kind === "whole-class") {
    return [...roster];
  }

  if (strategy.kind === "matching-initial") {
    return roster.filter(
      (child) => child.verifiedInitial === strategy.initial
    );
  }

  if (strategy.count > roster.length) {
    throw new Error(
      `Template requires ${strategy.count} participants but only ${roster.length} are available`
    );
  }

  let state = hashSeed(seed);
  const shuffled = [...roster];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const [random, nextState] = nextRandom(state);
    state = nextState;
    const target = Math.floor(random * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target]!, shuffled[index]!];
  }
  return shuffled.slice(0, strategy.count);
}
```

Create `packages/template-sdk/src/index.ts`:

```ts
export { selectParticipants } from "./participantSelection";
export type {
  SelectionStrategy,
  TemplateDefinition
} from "./templateDefinition";
```

- [ ] **Step 5: Run tests and type checking**

Run:

```bash
pnpm test packages/template-sdk/src/participantSelection.test.ts
pnpm --filter @lectoemocion/template-sdk typecheck
```

Expected: 4 tests pass and type checking exits 0.

- [ ] **Step 6: Commit**

```bash
git add pnpm-lock.yaml packages/template-sdk
git commit -m "feat(templates): add deterministic participant selection"
```

### Task 5: Build the synthetic template catalogue

**Files:**
- Create: `packages/template-catalog/package.json`
- Create: `packages/template-catalog/tsconfig.json`
- Create: `packages/template-catalog/vitest.config.ts`
- Create: `packages/template-catalog/src/fixtures/syntheticClass.ts`
- Create: `packages/template-catalog/src/nameStory.ts`
- Create: `packages/template-catalog/src/initialsGame.ts`
- Create: `packages/template-catalog/src/templates.test.ts`
- Create: `packages/template-catalog/src/index.ts`

- [ ] **Step 1: Configure the catalogue package**

Create `packages/template-catalog/package.json`:

```json
{
  "name": "@lectoemocion/template-catalog",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "tsc --noEmit",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@lectoemocion/domain": "workspace:*",
    "@lectoemocion/resource-schema": "workspace:*",
    "@lectoemocion/template-sdk": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^7.0.2",
    "vitest": "^4.1.10"
  }
}
```

Create `packages/template-catalog/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

Create `packages/template-catalog/vitest.config.ts`:

```ts
import { defineProject } from "vitest/config";

export default defineProject({
  test: { environment: "node" }
});
```

- [ ] **Step 2: Write failing catalogue tests**

Create `packages/template-catalog/src/templates.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseResourceManifest } from "@lectoemocion/resource-schema";
import {
  createInitialsGameResource,
  createNameStoryResource,
  syntheticClass
} from ".";

describe("synthetic template catalogue", () => {
  it("creates a valid whole-class name story", () => {
    const resource = createNameStoryResource(syntheticClass, "story-seed");
    expect(parseResourceManifest(resource)).toEqual(resource);
    expect(resource.participants).toHaveLength(syntheticClass.length);
  });

  it("creates a valid initials game", () => {
    const resource = createInitialsGameResource(
      syntheticClass,
      "A",
      "game-seed"
    );
    expect(parseResourceManifest(resource)).toEqual(resource);
    expect(resource.participants.some((child) => child.verifiedInitial === "A"))
      .toBe(true);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run:

```bash
pnpm install
pnpm test packages/template-catalog/src/templates.test.ts
```

Expected: FAIL because the catalogue exports do not exist.

- [ ] **Step 4: Add synthetic records and manifest mapping**

Create `packages/template-catalog/src/fixtures/syntheticClass.ts`:

```ts
import type { ChildRecord } from "@lectoemocion/domain";

export const syntheticClass: ChildRecord[] = [
  { id: "ana", displayName: "Ana", verifiedInitial: "A", photoAssetId: "avatar-ana", pronunciationAssetId: "silent-ana" },
  { id: "alex", displayName: "Álex", verifiedInitial: "A", photoAssetId: "avatar-alex", pronunciationAssetId: "silent-alex" },
  { id: "bruno", displayName: "Bruno", verifiedInitial: "B", photoAssetId: "avatar-bruno", pronunciationAssetId: "silent-bruno" },
  { id: "luna", displayName: "Luna", verifiedInitial: "L", photoAssetId: "avatar-luna", pronunciationAssetId: "silent-luna" }
];
```

Create `packages/template-catalog/src/nameStory.ts`:

```ts
import type { ChildRecord } from "@lectoemocion/domain";
import type { ResourceManifest } from "@lectoemocion/resource-schema";
import { selectParticipants } from "@lectoemocion/template-sdk";

function toParticipant(child: ChildRecord) {
  return {
    childRecordId: child.id,
    displayName: child.displayName,
    verifiedInitial: child.verifiedInitial,
    photoUrl: `/synthetic/${child.photoAssetId}.svg`,
    pronunciationUrl: `/synthetic/${child.pronunciationAssetId}.mp3`
  };
}

export function createNameStoryResource(
  roster: readonly ChildRecord[],
  seed: string
): ResourceManifest {
  return {
    schemaVersion: 1,
    resourceId: `name-story-${seed}`,
    template: { id: "name-story", version: 1 },
    seed,
    participants: selectParticipants(roster, { kind: "whole-class" }, seed)
      .map(toParticipant)
  };
}
```

Create `packages/template-catalog/src/initialsGame.ts`:

```ts
import type { ChildRecord } from "@lectoemocion/domain";
import type { ResourceManifest } from "@lectoemocion/resource-schema";
import { selectParticipants } from "@lectoemocion/template-sdk";

export function createInitialsGameResource(
  roster: readonly ChildRecord[],
  initial: string,
  seed: string
): ResourceManifest {
  const targets = selectParticipants(
    roster,
    { kind: "matching-initial", initial },
    seed
  );
  if (targets.length === 0) {
    throw new Error(`No participants match initial ${initial}`);
  }

  return {
    schemaVersion: 1,
    resourceId: `initials-game-${seed}`,
    template: { id: "initials-game", version: 1, targetInitial: initial },
    seed,
    participants: [...roster].map((child) => ({
      childRecordId: child.id,
      displayName: child.displayName,
      verifiedInitial: child.verifiedInitial,
      photoUrl: `/synthetic/${child.photoAssetId}.svg`,
      pronunciationUrl: `/synthetic/${child.pronunciationAssetId}.mp3`
    }))
  };
}
```

Create `packages/template-catalog/src/index.ts`:

```ts
export { syntheticClass } from "./fixtures/syntheticClass";
export { createInitialsGameResource } from "./initialsGame";
export { createNameStoryResource } from "./nameStory";
```

- [ ] **Step 5: Run tests and type checking**

Run:

```bash
pnpm test packages/template-catalog/src/templates.test.ts
pnpm --filter @lectoemocion/template-catalog typecheck
```

Expected: 2 tests pass and type checking exits 0.

- [ ] **Step 6: Commit**

```bash
git add pnpm-lock.yaml packages/template-catalog
git commit -m "feat(catalog): add synthetic story and initials resources"
```

### Task 6: Create the React and Phaser player

**Files:**
- Create: `apps/player-web/package.json`
- Create: `apps/player-web/tsconfig.json`
- Create: `apps/player-web/vite.config.ts`
- Create: `apps/player-web/vitest.config.ts`
- Create: `apps/player-web/index.html`
- Create: `apps/player-web/src/main.tsx`
- Create: `apps/player-web/src/app/App.tsx`
- Create: `apps/player-web/src/app/App.test.tsx`
- Create: `apps/player-web/src/game/createGame.ts`
- Create: `apps/player-web/src/game/scenes/ResourceScene.ts`
- Create: `apps/player-web/src/game/templates/renderNameStory.ts`
- Create: `apps/player-web/src/game/templates/renderInitialsGame.ts`
- Create: `apps/player-web/src/styles.css`

- [ ] **Step 1: Configure the web application**

Create `apps/player-web/package.json`:

```json
{
  "name": "@lectoemocion/player-web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "vite build",
    "dev": "vite",
    "typecheck": "tsc --noEmit",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@lectoemocion/resource-schema": "workspace:*",
    "@lectoemocion/template-catalog": "workspace:*",
    "phaser": "4.2.0",
    "react": "^19.2.7",
    "react-dom": "^19.2.7"
  },
  "devDependencies": {
    "@playwright/test": "^1.61.1",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.3",
    "jsdom": "^29.1.1",
    "typescript": "^7.0.2",
    "vite": "^8.1.4",
    "vitest": "^4.1.10"
  }
}
```

Create `apps/player-web/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "jsx": "react-jsx" },
  "include": ["src", "vite.config.ts", "vitest.config.ts"]
}
```

Create `apps/player-web/vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: { host: "127.0.0.1", port: 4173 }
});
```

Create `apps/player-web/vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineProject } from "vitest/config";

export default defineProject({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["@testing-library/jest-dom/vitest"]
  }
});
```

- [ ] **Step 2: Write the failing application-shell test**

Create `apps/player-web/src/app/App.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

vi.mock("../game/createGame", () => ({
  createGame: vi.fn(() => ({ destroy: vi.fn() }))
}));

describe("App", () => {
  it("switches between the story and game resources", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: "Historia de nombres" }))
      .toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Juego de iniciales" }));
    expect(screen.getByRole("button", { name: "Juego de iniciales" }))
      .toHaveAttribute("aria-pressed", "true");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run:

```bash
pnpm install
pnpm test apps/player-web/src/app/App.test.tsx
```

Expected: FAIL because `App` does not exist.

- [ ] **Step 4: Implement the shell and Phaser lifecycle**

Create `apps/player-web/src/game/createGame.ts`:

```ts
import * as Phaser from "phaser";
import type { ResourceManifest } from "@lectoemocion/resource-schema";
import { ResourceScene } from "./scenes/ResourceScene";

export function createGame(
  parent: HTMLElement,
  resource: ResourceManifest
): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#f7f2ff",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 1280,
      height: 720
    },
    input: { activePointers: 4 },
    scene: [new ResourceScene(resource)]
  });
}
```

Create `apps/player-web/src/app/App.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createInitialsGameResource,
  createNameStoryResource,
  syntheticClass
} from "@lectoemocion/template-catalog";
import { createGame } from "../game/createGame";

type ResourceChoice = "story" | "game";

export function App() {
  const [choice, setChoice] = useState<ResourceChoice>("story");
  const gameHost = useRef<HTMLDivElement>(null);
  const resource = useMemo(
    () =>
      choice === "story"
        ? createNameStoryResource(syntheticClass, "demo-story")
        : createInitialsGameResource(syntheticClass, "A", "demo-game"),
    [choice]
  );

  useEffect(() => {
    if (!gameHost.current) return;
    const game = createGame(gameHost.current, resource);
    return () => game.destroy(true);
  }, [resource]);

  return (
    <main>
      <header>
        <h1>LectoEmoción</h1>
        <nav aria-label="Recursos">
          <button
            aria-pressed={choice === "story"}
            onClick={() => setChoice("story")}
          >
            Historia de nombres
          </button>
          <button
            aria-pressed={choice === "game"}
            onClick={() => setChoice("game")}
          >
            Juego de iniciales
          </button>
        </nav>
      </header>
      <div ref={gameHost} className="game-host" data-testid="game-host" />
    </main>
  );
}
```

Create `apps/player-web/src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode><App /></StrictMode>
);
```

Create `apps/player-web/index.html`:

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LectoEmoción Player</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Implement template renderers**

Create `apps/player-web/src/game/templates/renderNameStory.ts`:

```ts
import * as Phaser from "phaser";
import type { ResourceManifest } from "@lectoemocion/resource-schema";

export function renderNameStory(
  scene: Phaser.Scene,
  resource: ResourceManifest
): void {
  scene.add.text(640, 80, "Nuestra clase", {
    fontFamily: "system-ui",
    fontSize: "56px",
    color: "#402060"
  }).setOrigin(0.5);

  resource.participants.forEach((child, index) => {
    const angle = (Math.PI * 2 * index) / resource.participants.length;
    const x = 640 + Math.cos(angle) * 360;
    const y = 380 + Math.sin(angle) * 220;
    const circle = scene.add.circle(x, y, 72, 0xffd166);
    const label = scene.add.text(x, y, child.displayName, {
      fontFamily: "system-ui",
      fontSize: "28px",
      color: "#241133"
    }).setOrigin(0.5);
    circle.setScale(0);
    label.setAlpha(0);
    scene.tweens.add({
      targets: circle,
      scale: 1,
      duration: 500,
      delay: index * 250,
      ease: "Back.Out"
    });
    scene.tweens.add({
      targets: label,
      alpha: 1,
      duration: 300,
      delay: index * 250 + 250
    });
  });
}
```

Create `apps/player-web/src/game/templates/renderInitialsGame.ts`:

```ts
import * as Phaser from "phaser";
import type { ResourceManifest } from "@lectoemocion/resource-schema";

export function renderInitialsGame(
  scene: Phaser.Scene,
  resource: ResourceManifest
): void {
  if (resource.template.id !== "initials-game") {
    throw new Error("Initials renderer received an incompatible resource");
  }
  const targetInitial = resource.template.targetInitial;
  let remaining = resource.participants.filter(
    (child) => child.verifiedInitial === targetInitial
  ).length;

  const instruction = scene.add.text(
    640,
    80,
    `Toca los nombres que empiezan por ${targetInitial}`,
    { fontFamily: "system-ui", fontSize: "42px", color: "#402060" }
  ).setOrigin(0.5);

  resource.participants.forEach((child, index) => {
    const column = index % 4;
    const row = Math.floor(index / 4);
    const x = 260 + column * 250;
    const y = 260 + row * 190;
    const card = scene.add.rectangle(x, y, 210, 130, 0xffffff)
      .setStrokeStyle(6, 0x7b2cbf)
      .setInteractive({ useHandCursor: true });
    const label = scene.add.text(x, y, child.displayName, {
      fontFamily: "system-ui",
      fontSize: "34px",
      color: "#241133"
    }).setOrigin(0.5);

    card.on("pointerdown", () => {
      if (!card.input?.enabled) return;
      if (child.verifiedInitial === targetInitial) {
        card.disableInteractive().setFillStyle(0x95d5b2);
        remaining -= 1;
        if (remaining === 0) {
          instruction.setText("¡Muy bien!");
          scene.tweens.add({
            targets: [instruction, label],
            scale: 1.15,
            yoyo: true,
            duration: 220
          });
        }
      } else {
        scene.tweens.add({
          targets: card,
          x: { from: x - 10, to: x + 10 },
          yoyo: true,
          repeat: 2,
          duration: 70,
          onComplete: () => card.setX(x)
        });
      }
    });
  });
}
```

Create `apps/player-web/src/game/scenes/ResourceScene.ts`:

```ts
import * as Phaser from "phaser";
import type { ResourceManifest } from "@lectoemocion/resource-schema";
import { renderInitialsGame } from "../templates/renderInitialsGame";
import { renderNameStory } from "../templates/renderNameStory";

export class ResourceScene extends Phaser.Scene {
  constructor(private readonly resource: ResourceManifest) {
    super(`resource-${resource.resourceId}`);
  }

  create(): void {
    if (this.resource.template.id === "name-story") {
      renderNameStory(this, this.resource);
      return;
    }
    renderInitialsGame(this, this.resource);
  }
}
```

Create `apps/player-web/src/styles.css`:

```css
:root {
  font-family: system-ui, sans-serif;
  color: #241133;
  background: #f7f2ff;
}

* { box-sizing: border-box; }
body { margin: 0; min-width: 320px; min-height: 100vh; }
main { min-height: 100vh; display: grid; grid-template-rows: auto 1fr; }
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: white;
}
h1 { margin: 0; font-size: 1.4rem; }
nav { display: flex; flex-wrap: wrap; gap: 0.5rem; }
button {
  min-height: 44px;
  padding: 0.6rem 0.9rem;
  border: 2px solid #7b2cbf;
  border-radius: 999px;
  background: white;
  color: #402060;
  font: inherit;
  font-weight: 700;
}
button[aria-pressed="true"] { background: #7b2cbf; color: white; }
.game-host { min-height: 0; display: grid; place-items: center; overflow: hidden; }
.game-host canvas { max-width: 100%; max-height: 100%; touch-action: none; }

@media (max-width: 600px) {
  header { align-items: stretch; flex-direction: column; }
  nav > button { flex: 1; }
}
```

- [ ] **Step 6: Run unit tests, type checking, and build**

Run:

```bash
pnpm test apps/player-web/src/app/App.test.tsx
pnpm --filter @lectoemocion/player-web typecheck
pnpm --filter @lectoemocion/player-web build
```

Expected: the application test passes, type checking exits 0, and Vite creates
`apps/player-web/dist`.

- [ ] **Step 7: Commit**

```bash
git add pnpm-lock.yaml apps/player-web
git commit -m "feat(player): render synthetic story and initials game"
```

### Task 7: Add browser-level responsive verification

**Files:**
- Create: `apps/player-web/playwright.config.ts`
- Create: `apps/player-web/e2e/player.spec.ts`
- Modify: `apps/player-web/package.json`

- [ ] **Step 1: Configure Playwright**

Create `apps/player-web/playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI
  },
  projects: [
    {
      name: "phone",
      use: { ...devices["iPhone 13"] }
    },
    {
      name: "classroom-hd",
      use: {
        browserName: "chromium",
        viewport: { width: 1920, height: 1080 },
        hasTouch: true
      }
    },
    {
      name: "classroom-4k",
      use: {
        browserName: "chromium",
        viewport: { width: 3840, height: 2160 },
        deviceScaleFactor: 1,
        hasTouch: true
      }
    }
  ]
});
```

- [ ] **Step 2: Write the failing end-to-end test**

Create `apps/player-web/e2e/player.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("switches resources and keeps the game canvas visible", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "LectoEmoción" })).toBeVisible();
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();

  await page.getByRole("button", { name: "Juego de iniciales" }).click();
  await expect(
    page.getByRole("button", { name: "Juego de iniciales" })
  ).toHaveAttribute("aria-pressed", "true");
  await expect(canvas).toBeVisible();

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  expect(box!.height).toBeLessThanOrEqual(await page.evaluate(() => innerHeight));
});
```

- [ ] **Step 3: Install browser support and run the test**

Run:

```bash
pnpm exec playwright install chromium webkit
pnpm --filter @lectoemocion/player-web test:e2e
```

Expected: all three viewport projects pass. If the managed environment blocks
browser installation, rerun the install with the required system permission;
do not remove the phone or classroom projects.

- [ ] **Step 4: Run the complete verification suite**

Run:

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Expected: all type checks, unit tests, builds, and three Playwright projects
exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/player-web/e2e apps/player-web/playwright.config.ts
git commit -m "test(player): cover phone and classroom layouts"
```

### Task 8: Record the implemented foundation

**Files:**
- Modify: `README.md`
- Modify: `docs/product/implementation-roadmap.md`

- [ ] **Step 1: Update the README with verified commands**

Add this section to `README.md`:

````markdown
## Development

Prerequisites: Node.js 22 and pnpm 10.

```bash
pnpm install
pnpm dev
```

Verification:

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Only synthetic records are permitted until pilot-readiness controls are
approved.
````

- [ ] **Step 2: Mark roadmap stage 1 complete only after verification**

Under the stage-1 heading in `docs/product/implementation-roadmap.md`, add:

```markdown
Status: implemented and verified.
```

Do not add this line if any command from Task 7 fails.

- [ ] **Step 3: Verify documentation and repository state**

Run:

```bash
git diff --check
git status --short
```

Expected: `git diff --check` exits 0. Status shows only the two intended
documentation files.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/product/implementation-roadmap.md
git commit -m "docs: record synthetic player workflow"
```

## Final acceptance

Before declaring this plan complete, run:

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
git status --short
```

Required result:

- all commands exit 0;
- both resource types render through the same Phaser runtime;
- switching resources does not require a phone;
- phone, HD classroom, and 4K classroom Playwright projects pass;
- no real child data, credentials, Firebase configuration, or production media
  exists in the repository;
- `git status --short` is empty.
