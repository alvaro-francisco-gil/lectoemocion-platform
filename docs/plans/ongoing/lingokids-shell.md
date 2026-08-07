# A tabbed shell of picture cards

**Status:** in progress on `feat/lingokids-shell`. Task 1 not started.

**Goal:** Replace the two-region map of circular discs with one flat world of
rectangular picture cards under a three-tab bottom bar — Juegos, Recursos,
Multijugador — and move the collection behind a corner button.

**Architecture:** `regions` leaves the world schema and `WorldNode` gains an
authored `surface` field naming the tab it stands on. `deriveMapView` becomes
`deriveWorldView` and returns `games` and `resources` in place of `regions`.
The shell gains a `tab` state and a collection screen; the reward ceremony,
progress storage and every template are untouched.

**Tech stack:** TypeBox + Ajv schemas, React 19, Vitest + Testing Library,
Playwright. No new dependencies.

## Global constraints

- No `any`, `@ts-nocheck`, or bare `@ts-ignore`. Strict TS 7 with
  `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
- Every switch over a union ends in `assertNever(value, "description")`.
- Templates never see `Progress`; the shell hands a manifest and a callback.
- RED → GREEN: the failing test is written and run before the implementation.
- Conventional commits. Commit after every task.
- Spanish user-facing copy: `Juegos`, `Recursos`, `Multijugador`, `Bloqueado`,
  `Mis animales`, `Cerrar`.
- Run `pnpm check` from the worktree root; `pnpm test:e2e` after Task 6.

## Why this shape

The two places were a navigation a child had to learn before reaching half the
chapters. The circles wasted the picture that is the only thing a
three-year-old navigates by. And the bottom band was spent on a record rather
than on the app's own top-level navigation.

Reference: the Lingokids home screen — a horizontal row of rectangular picture
cards over a flat background, with a floating pill of tabs across the bottom.

---

## Task 1: Flatten the world schema

Regions leave `packages/resource-schema`. Nothing about tabs yet — this task
only removes a level of nesting, so a failure here is unambiguous.

**Files:**
- Modify: `packages/resource-schema/src/worldSchema.ts:201-252` (region schema,
  `WorldSchema`, `worldNodes`, the duplicate-region check in `parseWorld`)
- Modify: `packages/template-catalog/src/world/index.ts:61-276` (the authored
  world)
- Test: `packages/template-catalog/src/world/world.test.ts`

**Interfaces:**
- Produces: `World = { nodes: readonly WorldNode[] }`;
  `worldNodes(world: World): readonly WorldNode[]` unchanged in signature.
- Removed: `WorldRegion`, `WorldRegionSchema`, `world.regions`.

- [ ] **Step 1: Rewrite the region cases in `world.test.ts` as flat-world cases**

Delete these four cases outright — they test a concept that no longer exists:
`"puts the entry chapter in the first region"`,
`"stands the forest chapters in the forest"`,
`"makes the farm wait on the forest, so the walk goes both ways"`,
`"gives every region a backdrop of its own"`.

In the `world validation` describe, replace the `worldOf` helper and the four
region-shaped validation cases with these:

```ts
  /** A world holding the nodes under test. */
  const worldOf = (...nodes: unknown[]) => ({ nodes });
```

```ts
  it("rejects a world with no nodes at all", () => {
    expect(() => parseWorld({ nodes: [] })).toThrow("Invalid world");
  });
```

Delete `"rejects a duplicate region id"`, `"rejects a region with no chapters
in it"`, `"rejects a world with no regions at all"`, and `"rejects a region
with no backdrop"`.

Rewrite `"rejects a cycle that spans two regions"` as a plain cycle across the
flat list — it is now the same case as `"rejects a cycle"`, so delete it.

- [ ] **Step 2: Run the tests to see them fail**

Run: `pnpm vitest run packages/template-catalog/src/world/world.test.ts`
Expected: FAIL — `parseWorld` rejects `{ nodes: [...] }` because
`additionalProperties: false` and `regions` is required.

- [ ] **Step 3: Flatten the schema**

In `packages/resource-schema/src/worldSchema.ts`, delete `WorldRegionSchema`
(lines 201–222) and the `WorldRegion` export, and replace `WorldSchema` and
`worldNodes` with:

```ts
export const WorldSchema = Type.Object(
  {
    /**
     * Every chapter, in the order a child meets them.
     *
     * One flat list: the world is one scroll, and what a child may reach is
     * `unlockedBy` node by node rather than a place they have to walk into.
     */
    nodes: Type.Array(WorldNodeSchema, { minItems: 1 })
  },
  { additionalProperties: false }
);
```

```ts
/** Every chapter in the world, in authored order. */
export function worldNodes(world: World): readonly WorldNode[] {
  return world.nodes;
}
```

Delete the `WorldRegion` line from the type exports and the duplicate-region
loop from `parseWorld` (lines 270–276).

- [ ] **Step 4: Flatten the authored world**

In `packages/template-catalog/src/world/index.ts`, replace `regions: [ ... ]`
with a single `nodes: [ ... ]` array holding all ten nodes in this order:
`encuentro`, `gallo-rayo`, `iniciales`, `parejas`, `cual-es`,
`primeras-letras`, `silabas`, `letras`, `empieza-igual`, `album`.

`parejas` and `cual-es` move inline where their prerequisites put them; every
`unlockedBy`, `resource`, `icon` and `reward` stays byte-identical. Replace the
"split into regions" paragraph of the doc comment with:

```ts
/**
 * The authored world.
 *
 * Fixed and product-authored: not user-composed, not editable, extended by
 * product updates (platform-design.md §6.1). Progression paces discovery
 * rather than gating difficulty, so the graph is a gentle chain with one
 * branch rather than a tree of prerequisites.
 *
 * One flat list in the order a child meets it. Every node plays on default
 * content; nothing here needs a roster.
 */
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run packages/template-catalog/src/world/world.test.ts packages/resource-schema`
Expected: PASS. `apps/player-web` still fails to typecheck — Task 3 fixes it.

- [ ] **Step 6: Commit**

```bash
git add packages/resource-schema/src/worldSchema.ts \
  packages/template-catalog/src/world/index.ts \
  packages/template-catalog/src/world/world.test.ts
git commit -m "refactor(world): make the world one flat list of chapters"
```

---

## Task 2: A node says which surface it stands on

**Files:**
- Modify: `packages/resource-schema/src/worldSchema.ts` (`WorldNodeSchema`)
- Modify: `packages/template-catalog/src/world/index.ts` (every node gains
  `surface`; `gallo-rayo` moves and loses its lock)
- Test: `packages/template-catalog/src/world/world.test.ts`

**Interfaces:**
- Produces: `WorldNode.surface: "juegos" | "recursos"`, required, no default.

- [ ] **Step 1: Write the failing tests**

Add to the `the authored world` describe in `world.test.ts`:

```ts
  /*
   * The shelf is not a reward. A book a child has to unlock is a book most of
   * them never open, so the story is reachable from the very first screen —
   * and it is the only thing on the shelf, which is why this names it.
   */
  it("keeps the story on the shelf, open from the first screen", () => {
    const shelf = worldNodes(world).filter(
      (node) => node.surface === "recursos"
    );
    expect(shelf.map((node) => node.id)).toEqual(["gallo-rayo"]);
    expect(shelf.every((node) => node.unlockedBy.length === 0)).toBe(true);
  });

  /* It is still a chapter of the world: it pays its stars and its chest, and
     it keeps its slot in the collection. */
  it("still pays a chest for the story on the shelf", () => {
    const story = worldNodes(world).find((node) => node.id === "gallo-rayo");
    expect(story?.reward.choices.map((choice) => choice.animalId)).toEqual([
      "gallo",
      "pollito",
      "raton"
    ]);
  });

  it("puts every other chapter under Juegos", () => {
    const games = worldNodes(world).filter((node) => node.surface === "juegos");
    expect(games).toHaveLength(worldNodes(world).length - 1);
  });
```

Add to the `world validation` describe:

```ts
  /* Where a chapter stands is authored, never guessed from its template: a
     node with no surface would be a node missing from both tabs. */
  it("rejects a node that does not say which surface it stands on", () => {
    const { surface: _dropped, ...homeless } = entry;
    expect(() => parseWorld(worldOf(homeless))).toThrow("Invalid world");
  });

  it("rejects a surface the shell has no tab for", () => {
    expect(() =>
      parseWorld(worldOf({ ...entry, surface: "multijugador" }))
    ).toThrow("Invalid world");
  });
```

The `entry` fixture in that describe gains `surface: "juegos"`:

```ts
  const entry = {
    id: "start",
    title: "Comienzo",
    icon: "/vocabulary/gato.webp",
    surface: "juegos",
    unlockedBy: [],
    resource: { template: "name-story", seed: "start" },
    reward
  };
```

Every other inline node literal in that describe (`second`, `a`, `b`, and the
one in `"rejects an unknown template"`) also gains `surface: "juegos"`.

Also fix `"has exactly one entry node"` — the world now has two, the entry
chapter and the story:

```ts
  it("has exactly one entry node under Juegos", () => {
    const entries = worldNodes(world).filter(
      (node) => node.surface === "juegos" && node.unlockedBy.length === 0
    );
    expect(entries.map((node) => node.id)).toEqual(["encuentro"]);
  });
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `pnpm vitest run packages/template-catalog/src/world/world.test.ts`
Expected: FAIL — `additionalProperties: false` rejects `surface`, so
`"validates"` throws `Invalid world`.

- [ ] **Step 3: Add the field to the schema**

In `WorldNodeSchema`, after `icon`:

```ts
    /**
     * Which of the shell's tabs this chapter stands on.
     *
     * Authored, never derived from the template. "A book belongs on the shelf"
     * is a rule that breaks the first time a game belongs there or a story
     * belongs on the path — and it would break silently, by putting the node
     * under the wrong tab. Required with no default, so a node whose place
     * nobody decided is a content error rather than a node missing from both.
     */
    surface: Type.Union([
      Type.Literal("juegos"),
      Type.Literal("recursos")
    ]),
```

- [ ] **Step 4: Author the surfaces**

In `packages/template-catalog/src/world/index.ts` give every node
`surface: "juegos"` except `gallo-rayo`, which gets `surface: "recursos"` and
`unlockedBy: []`. Replace the gallo-rayo comment with:

```ts
        /*
         * The book is on the shelf, not on the path, and it is open from the
         * first screen. It is thirty-one pages long — far the longest thing
         * here — and a book a child has to unlock is a book most of them never
         * open. It still pays its letriestrellas and its chest: what it is
         * worth does not depend on which tab it is reached from.
         */
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run packages/template-catalog packages/resource-schema`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/resource-schema/src/worldSchema.ts \
  packages/template-catalog/src/world/index.ts \
  packages/template-catalog/src/world/world.test.ts
git commit -m "feat(world): let a chapter say which surface it stands on"
```

---

## Task 3: `deriveWorldView` replaces `deriveMapView`

**Files:**
- Rename: `apps/player-web/src/world/mapView.ts` → `worldView.ts`
- Rename: `apps/player-web/src/world/mapView.test.ts` → `worldView.test.ts`
- Modify: `apps/player-web/src/app/App.tsx` (import only — the shell is Task 4)

**Interfaces:**
- Produces:
  ```ts
  export interface WorldView {
    readonly games: readonly MapNodeView[];
    readonly resources: readonly MapNodeView[];
    readonly nodes: readonly MapNodeView[];
    readonly collection: readonly CollectionSlotView[];
    readonly pendingReward: PendingRewardView | null;
    readonly stars: number;
  }
  export function deriveWorldView(
    world: World,
    progress: Progress,
    options?: WorldViewOptions
  ): WorldView;
  ```
- `MapNodeView` is renamed `WorldNodeView` and gains
  `readonly surface: "juegos" | "recursos"`.
- Removed: `MapRegionView`, `MapView`, `MapViewOptions`, `deriveMapView`.

- [ ] **Step 1: Move the test file and rewrite its region cases**

```bash
git mv apps/player-web/src/world/mapView.test.ts \
  apps/player-web/src/world/worldView.test.ts
git mv apps/player-web/src/world/mapView.ts \
  apps/player-web/src/world/worldView.ts
```

In `worldView.test.ts`, change the import to
`from "./worldView"` and `deriveMapView` → `deriveWorldView` throughout
(including the two `ReturnType<typeof deriveMapView>` helper signatures).

Replace the `chain` fixture with a flat four-chapter world that has one node on
the shelf, so the split has something to split:

```ts
/**
 * A four-chapter world with one thing on the shelf.
 *
 * `three` stands under Recursos and is unlocked from the start, which is what
 * the real world's story does — a fixture where every node is a game could not
 * tell the two lists apart.
 */
const chain: World = parseWorld({
  nodes: [
    {
      id: "one",
      title: "Uno",
      icon: "/vocabulary/gato.webp",
      surface: "juegos",
      unlockedBy: [],
      resource: { template: "name-story", seed: "one" },
      reward: chestsFor("one")
    },
    {
      id: "two",
      title: "Dos",
      icon: "/vocabulary/luna.webp",
      surface: "juegos",
      unlockedBy: ["one"],
      resource: { template: "pairs-game", seed: "two", pairCount: 3 },
      reward: chestsFor("two")
    },
    {
      id: "three",
      title: "Tres",
      icon: "/vocabulary/sol.webp",
      surface: "recursos",
      unlockedBy: [],
      resource: { template: "pairs-game", seed: "three", pairCount: 3 },
      reward: chestsFor("three")
    },
    {
      id: "four",
      title: "Cuatro",
      icon: "/vocabulary/pato.webp",
      surface: "juegos",
      unlockedBy: ["two", "three"],
      resource: { template: "memory-album", seed: "four" },
      reward: chestsFor("four")
    }
  ]
});
```

Two existing cases assumed `three` was locked and must be updated to the new
fixture, where it is on the shelf and open from the start:

```ts
  it("opens the entry node and the shelf, and nothing else, to a new player", () => {
    const view = deriveWorldView(chain, EMPTY_PROGRESS);
    expect(stateOf(view, "one")).toBe("unlocked");
    expect(stateOf(view, "three")).toBe("unlocked");
    expect(stateOf(view, "two")).toBe("locked");
    expect(stateOf(view, "four")).toBe("locked");
  });
```

```ts
  it("unlocks successors when their prerequisite is completed", () => {
    const view = deriveWorldView(chain, progressAfter("one"));
    expect(stateOf(view, "one")).toBe("completed");
    expect(stateOf(view, "two")).toBe("unlocked");
  });
```

`"keeps a node locked until every prerequisite is done"` becomes:

```ts
  it("keeps a node locked until every prerequisite is done", () => {
    const partial = deriveWorldView(chain, progressAfter("one", "two"));
    expect(stateOf(partial, "four")).toBe("locked");

    const complete = deriveWorldView(chain, progressAfter("one", "two", "three"));
    expect(stateOf(complete, "four")).toBe("unlocked");
  });
```

Replace the whole `describe("the world's places", ...)` block with:

```ts
describe("the world's two surfaces", () => {
  it("splits the chapters into the tab each one stands on", () => {
    const view = deriveWorldView(chain, EMPTY_PROGRESS);
    expect(view.games.map((node) => node.id)).toEqual(["one", "two", "four"]);
    expect(view.resources.map((node) => node.id)).toEqual(["three"]);
  });

  /* The flat list is the same chapters, so nothing that reads it — the
     collection, the ceremony — has to learn about tabs. */
  it("keeps every chapter in one list, in authored order", () => {
    const view = deriveWorldView(chain, EMPTY_PROGRESS);
    expect(view.nodes.map((node) => node.id)).toEqual([
      "one",
      "two",
      "three",
      "four"
    ]);
  });

  it("carries each node's surface, so the shell does not re-derive it", () => {
    const view = deriveWorldView(chain, EMPTY_PROGRESS);
    expect(view.nodes.find((node) => node.id === "three")?.surface).toBe(
      "recursos"
    );
  });
});
```

Finally, the last describe expected exactly one playable node in the real
world; there are now two, the entry chapter and the always-open story:

```ts
describe("the authored world through the shell", () => {
  it("starts a real player on one game and the whole shelf", () => {
    const view = deriveWorldView(world, EMPTY_PROGRESS);
    expect(view.games.filter((node) => node.playable)).toHaveLength(1);
    expect(view.resources.every((node) => node.playable)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `pnpm vitest run apps/player-web/src/world/worldView.test.ts`
Expected: FAIL — `deriveWorldView` is not exported.

- [ ] **Step 3: Rewrite the view module**

In `worldView.ts`: rename `MapNodeView` → `WorldNodeView` and give it
`readonly surface: "juegos" | "recursos";`. Delete `MapRegionView` and its doc
comment. Rename `MapView` → `WorldView` and `MapViewOptions` →
`WorldViewOptions`, replacing the `regions` field with:

```ts
  /**
   * The chapters on the path, in authored order.
   *
   * Split here rather than in the shell so that "which tab is this on" has one
   * answer, next to the rule that decides what may be played at all.
   */
  readonly games: readonly WorldNodeView[];
  /** The chapters on the shelf: books and, later, anything else to browse. */
  readonly resources: readonly WorldNodeView[];
```

Rename the function to `deriveWorldView`, add `surface: node.surface` to what
`project` returns, and replace the `regions` computation and the return's
`regions`/`nodes` fields with:

```ts
  const nodes = worldNodes(world).map(project);

  return {
    stars: progress.stars,
    games: nodes.filter((node) => node.surface === "juegos"),
    resources: nodes.filter((node) => node.surface === "recursos"),
    nodes,
    // …collection and pendingReward unchanged
```

Note the existing local `const nodes = worldNodes(world)` at the top of the
function is the `WorldNode[]`, used by `earned` and `owed`; rename the projected
list to `projected` and return `nodes: projected` rather than shadowing it.

- [ ] **Step 4: Point the shell at the new names**

In `App.tsx`, change the import block from `"../world/mapView"` to
`"../world/worldView"`, `deriveMapView` → `deriveWorldView`, and
`type MapNodeView` → `type WorldNodeView`. Leave everything else in `App.tsx`
broken — Task 4 rewrites it. Type errors here are expected until then.

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run apps/player-web/src/world/worldView.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/player-web/src/world apps/player-web/src/app/App.tsx
git commit -m "refactor(player): derive the world as two surfaces, not two regions"
```

---

## Task 4: Tabs, and the collection as a screen

**Files:**
- Modify: `apps/player-web/src/app/App.tsx`
- Test: `apps/player-web/src/app/App.test.tsx`

**Interfaces:**
- Consumes: `deriveWorldView`, `WorldView.games`, `WorldView.resources`,
  `WorldNodeView.surface` from Task 3.
- Produces: DOM contract the stylesheet and the e2e suite rely on —
  `nav.tab-bar` labelled `Secciones`; `nav[aria-label="Mundo"]` still wraps the
  card row on both tabs; `button.collection-button` labelled `Mis animales`;
  `main.collection-screen` as `role="dialog"` labelled `Mis animales`;
  `.world-node` retained as the card class.

- [ ] **Step 1: Write the failing tests**

In `App.test.tsx`, delete the whole `describe("the doors between regions", …)`
block and the `"shows one region as an ordered path, with the way on at its
end"` case. Replace the `collection` helper and add tab helpers:

```ts
/** Moves to a tab by its label in the bottom bar. */
function openTab(name: string): void {
  fireEvent.click(
    within(screen.getByRole("navigation", { name: "Secciones" })).getByRole(
      "button",
      { name }
    )
  );
}

/** The animals, in world order — `null` for a slot still to fill. Opens the
    collection screen, reads it, and closes it again. */
function collection(container: HTMLElement): (string | null)[] {
  fireEvent.click(screen.getByRole("button", { name: "Mis animales" }));
  const slots = [...container.querySelectorAll(".collection__slot")].map(
    (slot) =>
      slot.getAttribute("data-filled") === "true"
        ? (slot.querySelector(".collection__name")?.textContent ?? "")
        : null
  );
  fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
  return slots;
}
```

Update `pathTitles` — it now reads whichever tab is on screen, with no doors:

```ts
/** What the tab on screen reads as, left to right. */
function pathTitles(): (string | null | undefined)[] {
  return worldButtons().map(
    (button) => button.querySelector(".world-node__title")?.textContent
  );
}
```

Add a new describe:

```ts
describe("the three sections", () => {
  beforeEach(() => {
    localStorage.clear();
    createGame.mockClear();
  });

  it("opens on Juegos, with every game and nothing from the shelf", () => {
    render(<App />);
    expect(pathTitles()).toEqual([
      "El encuentro",
      "Las iniciales",
      "El bosque de parejas",
      "¿Cuál es?",
      "Las primeras letras",
      "El puente de sílabas",
      "El taller de letras",
      "Empieza igual",
      "Nuestro álbum"
    ]);
  });

  it("shows the shelf under Recursos, and only the shelf", () => {
    render(<App />);
    openTab("Recursos");
    expect(pathTitles()).toEqual(["El gallo Rayo"]);
  });

  /* A book a child has to unlock is a book most of them never open. */
  it("opens the story from the shelf on a brand new profile", () => {
    render(<App />);
    openTab("Recursos");

    fireEvent.click(screen.getByRole("button", { name: "El gallo Rayo" }));

    expect(createGame).toHaveBeenCalledTimes(1);
  });

  /* Stars for reading it, and a chest the first time — what a chapter is worth
     does not depend on which tab it was reached from. */
  it("pays the story its stars and its chest", async () => {
    render(<App />);
    openTab("Recursos");
    fireEvent.click(screen.getByRole("button", { name: "El gallo Rayo" }));
    completeActiveResource();

    expect(await collectStars()).toContain("+3");
    expect(
      await screen.findByRole("button", { name: "Abrir el cofre 1" })
    ).toBeInTheDocument();
  });

  /* Leaving the story lands back on the shelf, not on the games: a child is
     put back where they were, not where the app opens. */
  it("returns to the tab the resource was opened from", async () => {
    render(<App />);
    openTab("Recursos");
    fireEvent.click(screen.getByRole("button", { name: "El gallo Rayo" }));
    returnToMap();

    await waitFor(() => expect(pathTitles()).toEqual(["El gallo Rayo"]));
  });

  it("marks the tab a child is standing on", () => {
    render(<App />);
    const bar = screen.getByRole("navigation", { name: "Secciones" });
    expect(
      within(bar).getByRole("button", { name: "Juegos" })
    ).toHaveAttribute("aria-current", "page");

    openTab("Recursos");
    expect(
      within(bar).getByRole("button", { name: "Recursos" })
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(bar).getByRole("button", { name: "Juegos" })
    ).not.toHaveAttribute("aria-current");
  });

  /* Shut, and said to be shut: dimming alone tells a screen reader nothing. */
  it("keeps Multijugador shut and inert", () => {
    render(<App />);
    const bar = screen.getByRole("navigation", { name: "Secciones" });
    const blocked = within(bar).getByRole("button", { name: /Multijugador/ });

    expect(blocked).toBeDisabled();
    expect(blocked.textContent).toContain("Bloqueado");

    fireEvent.click(blocked);
    /* Still on the games: a shut section is refused, not merely dimmed. */
    expect(pathTitles()).toContain("El encuentro");
  });

  /* Chrome belongs to the world screens. A game gets the screen to itself. */
  it("takes the bar and the collection away while a resource plays", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "El encuentro" }));

    expect(screen.queryByRole("navigation", { name: "Secciones" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mis animales" })).toBeNull();
  });
});

describe("the collection screen", () => {
  beforeEach(() => {
    localStorage.clear();
    createGame.mockClear();
  });

  it("opens from the corner and closes again", () => {
    render(<App />);
    expect(screen.queryByRole("dialog", { name: "Mis animales" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Mis animales" }));
    expect(
      screen.getByRole("dialog", { name: "Mis animales" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByRole("dialog", { name: "Mis animales" })).toBeNull();
  });

  /* A screen with no way out is a trap on a device with no back button. */
  it("closes on Escape", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Mis animales" }));

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Mis animales" })).toBeNull();
  });

  /* One screen at a time: the world is not left underneath to be tapped
     through. */
  it("puts the world away while it is open", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Mis animales" }));

    expect(screen.queryByRole("navigation", { name: "Mundo" })).toBeNull();
  });

  /* Slots are a record, not a route. */
  it("keeps every slot unpressable", () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Mis animales" }));

    expect(
      container.querySelectorAll(".collection__slots button")
    ).toHaveLength(0);
  });

  it("reaches the collection from the shelf as well as the games", () => {
    render(<App />);
    openTab("Recursos");

    fireEvent.click(screen.getByRole("button", { name: "Mis animales" }));
    expect(
      screen.getByRole("dialog", { name: "Mis animales" })
    ).toBeInTheDocument();
  });
});
```

Two existing cases need updating for the new chrome. In
`"keeps the collection out of the world's list of destinations"`, drop the
`.collection button` assertion (covered above) and keep the slot count. In
`"hides the world list while a resource is playing"`, the button sweep now
expects only the way back, which still holds — but the collection button must
be gone, which the new case above covers; leave it as it is.

`"marks each node's state without relying on colour"` referenced
`world.regions[0]`. Replace with:

```ts
  it("marks each node's state without relying on colour", () => {
    render(<App />);
    const states = worldButtons().map(
      (button) => button.querySelector(".world-node__state")?.textContent
    );
    /* The entry chapter, then every game behind it. */
    expect(states).toEqual([
      "Historia",
      ...worldNodes(world)
        .filter((node) => node.surface === "juegos")
        .slice(1)
        .map(() => "Bloqueado")
    ]);
  });
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `pnpm vitest run apps/player-web/src/app/App.test.tsx`
Expected: FAIL — no navigation named `Secciones`.

- [ ] **Step 3: Rewrite the shell**

In `App.tsx`:

Delete `RegionDoor` entirely, along with the `MapRegionView` import and the
`regionIndex` state and its doc comment. Replace them with:

```ts
/**
 * Which section a child is standing in.
 *
 * Session state, deliberately not stored: the app opens on the games, because
 * that is what it is for. Multijugador is absent on purpose — a section with
 * nothing behind it is a button, not a place, so it cannot be a value here.
 */
type TabId = "juegos" | "recursos";
```

State becomes:

```ts
  const [tab, setTab] = useState<TabId>("juegos");
  /* The collection is a screen of its own, so whether it is on is part of
     which one. Same shape as the menu. */
  const [collectionOpen, setCollectionOpen] = useState(false);
```

`region` and the `before`/`after` locals go away. The screen chain gains one
entry, after `menuOpen`:

```ts
  if (collectionOpen) {
    return (
      <CollectionScreen
        slots={view.collection}
        onClose={() => setCollectionOpen(false)}
      />
    );
  }
```

The map return becomes:

```ts
  const standing = tab === "juegos" ? view.games : view.resources;

  return (
    <main className="world">
      <StarCounter stars={view.stars} />
      <button
        type="button"
        className="menu-button"
        aria-label="Menú"
        onClick={() => setMenuOpen(true)}
      >
        <MenuIcon />
      </button>
      {/*
        An ordered list because a section is a sequence: that is what a screen
        reader should hear, and it is the order the cards are authored in.

        Named "Mundo" whichever section is on screen: it is one row of places
        to go, and which section it is showing is said by the bar below it.
      */}
      <nav aria-label="Mundo" className="world__row" ref={panWorld}>
        <ol className="world-path">
          {standing.map((node) => (
            <li key={node.id}>
              <WorldNode node={node} onSelect={select} />
            </li>
          ))}
        </ol>
      </nav>
      <TabBar tab={tab} onChange={setTab} />
      <button
        type="button"
        className="collection-button"
        aria-label="Mis animales"
        onClick={() => setCollectionOpen(true)}
      >
        <PawIcon />
      </button>
    </main>
  );
```

`select` is left exactly as it is. `tab` is never cleared when a resource
opens, so leaving one already lands the child back where they were — that is
what the "returns to the tab" test pins.

Add the three new components:

```ts
/**
 * The three sections, as a bar along the bottom.
 *
 * Low and central, because unlike the star counter and the menu this is
 * something a child uses: the corners are for the app talking, the bottom band
 * is for hands.
 *
 * Multijugador is a button that refuses rather than a section that is missing.
 * A child who is shown three doors and finds one shut has learned the shape of
 * the app; one who is shown two learns it again when the third appears.
 */
function TabBar({
  tab,
  onChange
}: {
  tab: TabId;
  onChange: (tab: TabId) => void;
}) {
  return (
    <nav className="tab-bar" aria-label="Secciones">
      <ul className="tab-bar__tabs">
        <li>
          <Tab id="juegos" label="Juegos" tab={tab} onChange={onChange}>
            <GamesIcon />
          </Tab>
        </li>
        <li>
          <Tab id="recursos" label="Recursos" tab={tab} onChange={onChange}>
            <ShelfIcon />
          </Tab>
        </li>
        <li>
          <button type="button" className="tab" disabled data-state="locked">
            <span className="tab__icon" aria-hidden="true">
              <LockIcon />
            </span>
            <span className="tab__label">Multijugador</span>
            {/*
              Spoken but not drawn. The dimming says "shut" to someone looking
              at it; this is the same sentence for someone who is not.
            */}
            <span className="visually-hidden">Bloqueado</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

function Tab({
  id,
  label,
  tab,
  onChange,
  children
}: {
  id: TabId;
  label: string;
  tab: TabId;
  onChange: (tab: TabId) => void;
  children: ReactNode;
}) {
  const current = tab === id;
  return (
    <button
      type="button"
      className="tab"
      /* `aria-current`, not `aria-pressed`: these are destinations, and where
         you are standing is not a toggle you have switched on. */
      {...(current ? { "aria-current": "page" as const } : {})}
      onClick={() => onChange(id)}
    >
      <span className="tab__icon" aria-hidden="true">
        {children}
      </span>
      <span className="tab__label">{label}</span>
    </button>
  );
}
```

Rewrite `Collection` as a screen. It keeps its slot markup verbatim — only the
wrapper changes:

```ts
/**
 * The animals won so far, one slot per chapter, in world order.
 *
 * A screen rather than a row along the bottom: that band is the tab bar's now,
 * and a record a child looks at has no business competing with the app's own
 * navigation for the place their hands land.
 *
 * Display only. Its slots exist from the first screen so the row reads as a
 * thing to fill rather than a thing that grows.
 */
function CollectionScreen({
  slots,
  onClose
}: {
  slots: readonly CollectionSlotView[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <main
      className="collection-screen"
      role="dialog"
      aria-modal="true"
      aria-label="Mis animales"
    >
      <button
        type="button"
        className="menu__close"
        aria-label="Cerrar"
        onClick={onClose}
      >
        <CloseIcon />
      </button>
      <section className="collection" ref={useDragScroll()}>
        <ul className="collection__slots">
          {/* …every slot exactly as it was… */}
        </ul>
      </section>
    </main>
  );
}
```

The menu's close button keeps its own label `"Cerrar el menú"`; this screen's
is `"Cerrar"`, which is what the new tests query.

Add the three drawn icons beside the existing ones:

```ts
/** A die: the one shape that reads as "things to play" without a word. */
function GamesIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" fill="currentColor" />
      <circle cx="8.5" cy="8.5" r="1.8" fill="#fff" />
      <circle cx="15.5" cy="15.5" r="1.8" fill="#fff" />
      <circle cx="15.5" cy="8.5" r="1.8" fill="#fff" />
      <circle cx="8.5" cy="15.5" r="1.8" fill="#fff" />
    </svg>
  );
}

/** An open book: the shelf holds one, and will hold more of the same kind. */
function ShelfIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <path
        d="M12 6.5C10.2 5.2 7.8 4.8 4 5.2v13c3.8-.4 6.2 0 8 1.3 1.8-1.3 4.2-1.7 8-1.3v-13c-3.8-.4-6.2 0-8 1.3Z"
        fill="currentColor"
      />
      <path d="M12 6.5v13" fill="none" stroke="#fff" strokeWidth="1.6" />
    </svg>
  );
}

/** A paw: what the collection is full of, at a size where a word would not fit. */
function PawIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
      <circle cx="7" cy="8" r="2.4" fill="currentColor" />
      <circle cx="12" cy="6" r="2.4" fill="currentColor" />
      <circle cx="17" cy="8" r="2.4" fill="currentColor" />
      <circle cx="19.4" cy="13" r="2.1" fill="currentColor" />
      <path
        d="M12 11c3.2 0 5.6 2.4 5.6 4.9 0 2-1.6 3.1-3.4 3.1-1 0-1.6-.4-2.2-.4s-1.2.4-2.2.4c-1.8 0-3.4-1.1-3.4-3.1C6.4 13.4 8.8 11 12 11Z"
        fill="currentColor"
      />
    </svg>
  );
}
```

`ReactNode` joins the React import. The `CSSProperties` import goes, with
`--map-scene`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run apps/player-web`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/player-web/src/app
git commit -m "feat(player): put the world under three sections with a bottom bar"
```

---

## Task 5: Cards, a flat backdrop, and the bar

CSS only. The DOM contract was settled in Task 4, so this task changes how the
shell looks and nothing about what it does.

**Files:**
- Modify: `apps/player-web/src/styles.css`
- Delete: `apps/player-web/public/world/granero.webp`,
  `apps/player-web/public/world/bosque.webp`
- Modify: `apps/player-web/public/world/PROVENANCE.md`

- [ ] **Step 1: Replace the map block with the world block**

Replace `.map` (lines 79–100) and `.map__world` (114–121) with:

```css
/*
 * The world reads left to right as one row of cards, so progress is a place
 * you have reached rather than a number.
 *
 * Three bands: the row, holding the middle of the screen, and the bar over the
 * bottom edge. The row keeps the reachable band on a panel and the comfortable
 * one on a tablet; the bar sits under it, where hands rest.
 *
 * The bar and the collection button are out of the flow on purpose. They are
 * fixed chrome, and as grid bands they would drag the row off the middle of the
 * display whenever their height changed. The row is the thing a child aims at,
 * so it is the thing that stays put.
 *
 * Flat, not a scene. The backdrop used to be the place a child was standing in;
 * with one world there is no place to name, and a picture behind a row of
 * picture cards is a second thing competing with the first. The colour is dark
 * so that every card — each its own bright rectangle — carries the screen.
 */
.world {
  /*
   * How big a card is, in one place.
   *
   * The card, the gap between cards and the height the connecting line is
   * drawn at are all derived from it, so the row stays one row rather than
   * three measurements kept in agreement by hand.
   *
   * Bounded by the shorter side of the viewport as well as the wider one: the
   * row is a middle band with the bar under it, and a card sized off width
   * alone would push that bar off a laptop in landscape.
   */
  --card-width: clamp(140px, min(38vw, 34vh), 300px);
  position: relative;
  display: grid;
  grid-template-rows: 1fr;
  overflow: hidden;
  background: #2c1250;
  color: #f4eefc;
}

/*
 * The row itself scrolls, not the page. `.world` fills the screen exactly, so
 * a row wider than it has to take its overflow here.
 *
 * The band is the whole screen rather than a strip around the cards, because
 * what a hand grabs to pan the world is the world. The row is then centred
 * *inside* that full-height band — `align-content` on the grid, so the cards
 * keep their own `flex-start` alignment and the connecting line stays on one
 * level across titles of different heights.
 */
.world__row {
  align-self: stretch;
  display: grid;
  align-content: center;
  overflow-x: auto;
  overflow-y: hidden;
  padding-block: clamp(0.75rem, 4vh, 3rem);
  /* Clear of the bar, which floats over this band rather than pushing it. */
  padding-bottom: clamp(6rem, 18vh, 11rem);
}
```

Update the drag-scroll rules to the new class names:

```css
.world__row,
.collection {
  cursor: grab;
  user-select: none;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
}
.world__row::-webkit-scrollbar,
.collection::-webkit-scrollbar { display: none; }
.world__row[data-dragging],
.collection[data-dragging] { cursor: grabbing; }
```

- [ ] **Step 2: Turn the disc into a card**

Replace `.world-path > li + li::before`'s `top` (line 164) with a value derived
from the card's own height, and replace `.world-node`, `.world-node__marker`,
`.world-node__icon`, the completed and locked rules, and both `.region-door`
blocks (lines 175–283) with:

```css
.world-node {
  width: var(--card-width);
  display: grid;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  cursor: pointer;
}
.world-node[disabled] { cursor: not-allowed; }

/*
 * The card a chapter's picture fills.
 *
 * 4:3 and rounded, with the picture covering it edge to edge: a rectangle is
 * the shape that gives an illustration the most of itself, which is the part a
 * child recognises. `grid` with one cell, so the padlock and the title chip
 * stack over the picture rather than beside it.
 */
.world-node__marker {
  width: 100%;
  aspect-ratio: 4 / 3;
  display: grid;
  grid-template: 1fr / 1fr;
  overflow: hidden;
  border-radius: 24px;
  background: #4a2a75;
  box-shadow: 0 8px 0 rgb(0 0 0 / 0.22);
}
.world-node__marker > * {
  grid-area: 1 / 1;
  place-self: center;
  min-width: 0;
  min-height: 0;
}

.world-node__icon {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/*
 * The title on a chip over the bottom-left corner, not a line of text under
 * the card. It is for the adult and the screen reader, and a word under every
 * card turns a row of pictures into a row of labels; on the picture it reads as
 * part of the card instead.
 */
.world-node__title {
  place-self: end start;
  z-index: 1;
  max-width: 85%;
  margin: 0 0 0.6rem;
  padding: 0.3em 0.9em;
  border-radius: 0 999px 999px 0;
  background: #fff;
  color: #241133;
  font-weight: 800;
  font-size: clamp(0.85rem, 1.6vw, 1.15rem);
  line-height: 1.2;
  text-align: left;
}

/* Spoken, not drawn: the state is already carried by the padlock and by the
   star, and a second copy of it in words under every card is noise on a screen
   a child is looking at. */
.world-node__state {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  border: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/*
 * A finished chapter wears a star in its corner rather than changing colour:
 * the picture is what a child navigates by, and repainting it would move the
 * landmark every time they finished something.
 */
.world-node[data-state="completed"] .world-node__marker::after {
  content: "★";
  place-self: start end;
  z-index: 1;
  margin: 0.5rem;
  width: 1.9em;
  height: 1.9em;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #f4c95d;
  color: #6b4a05;
  font-size: clamp(0.8rem, 1.5vw, 1.1rem);
  line-height: 1;
}

/*
 * A locked chapter still shows its picture, dimmed, with the padlock over it:
 * what is behind the lock is the reason to come back for it. Dimmed, never
 * hidden — the state is also read aloud, so the dimming never carries it alone.
 */
.world-node[data-state="locked"] .world-node__marker { background: #3a2159; }
.world-node[data-state="locked"] .world-node__icon { opacity: 0.35; }
.world-node[data-state="locked"] .world-node__title {
  background: #d9cfe8;
  color: #4a3a63;
}

.world-node__lock {
  z-index: 1;
  width: 34%;
  height: 34%;
}

.world-node:focus-visible { outline: 4px solid #f4c95d; outline-offset: 4px; }
.world-node:not([disabled]):hover .world-node__marker { transform: scale(1.04); }

@media (prefers-reduced-motion: no-preference) {
  .world-node__marker { transition: transform 120ms ease-out; }
}
```

The connecting line's `top` no longer resolves against `--node-size`. Update
`.world-path > li + li::before` and its neighbours:

```css
.world-path {
  display: flex;
  align-items: flex-start;
  gap: clamp(0.75rem, 3vw, 2rem);
  margin: 0;
  padding: 0 clamp(1rem, 5vw, 4rem);
  list-style: none;
  min-width: max-content;
  justify-content: center;
}

/* The line that makes a row of cards read as one journey. */
.world-path > li {
  position: relative;
  display: flex;
}
.world-path > li + li::before {
  content: "";
  position: absolute;
  /* Half a card down, less half the line's own thickness: the middle of it. */
  top: calc(var(--card-width) * 3 / 8 - 3px);
  right: 100%;
  width: clamp(0.75rem, 3vw, 2rem);
  height: 6px;
  border-radius: 3px;
  background: rgb(255 255 255 / 0.28);
}
.world-path > li:has(.world-node[data-state="completed"]) + li::before {
  background: #f4c95d;
}
```

- [ ] **Step 3: Style the bar and the corner button**

Add after the star-counter block:

```css
/* ---------------------------------------------------------- the sections */

/*
 * The three sections, as a pill floating over the bottom edge.
 *
 * Centred and low: this is the one piece of chrome a child uses, so it goes
 * where their hands are, while the star counter and the menu keep the corners.
 * Out of the flow so it cannot move the row of cards when its height changes.
 */
.tab-bar {
  position: absolute;
  inset: auto 0 clamp(0.75rem, 3vh, 2rem);
  z-index: 2;
  display: grid;
  justify-items: center;
  pointer-events: none;
}

.tab-bar__tabs {
  display: flex;
  align-items: stretch;
  gap: clamp(0.25rem, 2vw, 1.5rem);
  margin: 0;
  padding: 0.5rem clamp(0.75rem, 3vw, 2rem);
  border-radius: 28px;
  background: #4a2a75;
  box-shadow: 0 6px 24px rgb(0 0 0 / 0.35);
  list-style: none;
  pointer-events: auto;
}

.tab {
  display: grid;
  justify-items: center;
  gap: 0.15rem;
  min-width: clamp(64px, 16vw, 130px);
  padding: 0.4rem 0.6rem;
  border: 0;
  border-radius: 20px;
  background: none;
  font: inherit;
  font-weight: 700;
  font-size: clamp(0.75rem, 1.7vw, 1.05rem);
  color: #d6c4ee;
  cursor: pointer;
}
.tab__icon { display: grid; place-items: center; }
.tab__icon > svg { width: clamp(24px, 5vw, 34px); height: auto; }

/* Where you are standing, said twice: brighter, and on a plate of its own. */
.tab[aria-current="page"] {
  background: rgb(255 255 255 / 0.16);
  color: #fff;
}

/* Shut. Dimmed here and said in words to a screen reader, never one alone. */
.tab[disabled] {
  color: #8a76a8;
  cursor: not-allowed;
}

.tab:focus-visible { outline: 3px solid #f4c95d; outline-offset: 2px; }

/*
 * The way into the collection, beside the bar rather than in it.
 *
 * It is not a fourth section: the animals are a record of what a child has
 * done, and a tab for them would put a place to look next to two places to go.
 */
.collection-button {
  position: absolute;
  right: clamp(0.5rem, 3vw, 2rem);
  bottom: clamp(0.75rem, 3vh, 2rem);
  z-index: 2;
  width: clamp(56px, 11vw, 76px);
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: #f4c95d;
  color: #6b4a05;
  box-shadow: 0 6px 20px rgb(0 0 0 / 0.35);
  cursor: pointer;
}
.collection-button > svg { width: 55%; height: auto; }
.collection-button:focus-visible {
  outline: 3px solid #fff;
  outline-offset: 3px;
}
```

- [ ] **Step 4: Turn the collection row into a screen**

Replace the `.collection` block (lines 392–400) with:

```css
/* A screen, not a layer: the world is gone while this is up, so there is
   nothing underneath to tap through. */
.collection-screen {
  position: relative;
  display: grid;
  align-content: center;
  background: #2c1250;
}

/*
 * The animals, one slot per chapter. Display only — nothing here is a button.
 * It scrolls sideways when the row outgrows the screen, dragged rather than
 * scrolled with a bar, for the same reason the world row is.
 */
.collection {
  overflow-x: auto;
  overflow-y: hidden;
  padding: clamp(1rem, 4vh, 3rem) clamp(0.5rem, 3vw, 2rem);
}
```

Add `flex-wrap: wrap` to `.collection__slots` so a long collection uses the
screen it now has:

```css
.collection__slots {
  display: flex;
  flex-wrap: wrap;
  align-items: start;
  justify-content: center;
  gap: clamp(0.4rem, 2vw, 1.5rem);
  margin: 0 auto;
  padding: 0;
  list-style: none;
}
```

Note `min-width: max-content` is dropped: it fought `flex-wrap`.

- [ ] **Step 5: Delete the backdrops and record it**

```bash
git rm apps/player-web/public/world/granero.webp \
  apps/player-web/public/world/bosque.webp
```

In `apps/player-web/public/world/PROVENANCE.md`, delete the two table rows and
the two paragraphs describing them, and add one line under the table:

```markdown
`granero.webp` and `bosque.webp` were removed when the world stopped being two
places with a backdrop each; the shell's background is now a flat colour.
```

- [ ] **Step 6: Run the tests to verify nothing regressed**

Run: `pnpm vitest run apps/player-web`
Expected: PASS — these are jsdom tests and do not read CSS, so this confirms
the class renames in Task 4 and here agree.

- [ ] **Step 7: Commit**

```bash
git add apps/player-web/src/styles.css apps/player-web/public/world
git commit -m "feat(player): draw each chapter as a picture card on a flat world"
```

---

## Task 6: The end-to-end suite and the docs

**Files:**
- Modify: `apps/player-web/e2e/player.spec.ts`
- Modify: `apps/player-web/AGENTS.md`

- [ ] **Step 1: Rewrite the region-shaped e2e helpers and tests**

Replace `openChapter` — there is no walk any more, only a tab:

```ts
/**
 * Opens a chapter, moving to the section it stands on first.
 *
 * Which section that is comes from the world rather than from a list here, so
 * a chapter that moves to the shelf does not quietly stop being covered.
 */
async function openChapter(page: Page, nodeId: string) {
  const node = worldNodes(world).find((candidate) => candidate.id === nodeId);
  if (!node) throw new Error(`No such world node: ${nodeId}`);

  if (node.surface === "recursos") {
    await page.getByRole("button", { name: "Recursos" }).click();
  } else {
    await page.getByRole("button", { name: "Juegos" }).click();
  }
  await page.getByRole("button", { name: node.title, exact: true }).click();
}
```

Delete these three tests outright — the concept is gone:
`"walking through the door changes the place, and the way back leads home"`,
`"the door to a region with nothing open in it stays shut"`, and
`"the collection sits below the path, and the path is centred"` (the collection
is no longer on the map).

Replace `"the collection sits below the path…"` with a check that the bar does
not sit on top of the cards:

```ts
test("the bar sits below the cards without covering them", async ({ page }) => {
  await withProgress(page, ["encuentro"]);
  await page.goto("/");

  const row = (await page.locator(".world-path").boundingBox())!;
  const bar = (await page.locator(".tab-bar__tabs").boundingBox())!;
  const viewport = await page.evaluate(() => ({ height: innerHeight }));

  /* Below, and not overlapping: the bar is chrome, not a second row. */
  expect(bar.y).toBeGreaterThanOrEqual(row.y + row.height);

  /* The cards hold the middle band rather than the bottom edge. */
  const centre = row.y + row.height / 2;
  expect(centre).toBeGreaterThan(viewport.height * 0.15);
  expect(centre).toBeLessThan(viewport.height * 0.7);
});
```

In `"finishing a chapter hands out an animal for the collection"`, the
collection is behind a button now. Open it before counting, and close it before
playing:

```ts
test("finishing a chapter hands out an animal for the collection", async ({
  page
}) => {
  await page.goto("/");

  const openCollection = () =>
    page.getByRole("button", { name: "Mis animales" }).click();
  const closeCollection = () =>
    page.getByRole("button", { name: "Cerrar", exact: true }).click();
  const empty = page.locator('.collection__slot[data-filled="false"]');
  const filled = page.locator('.collection__slot[data-filled="true"]');

  /* One slot per chapter, counted from the world so a new one does not fail
     this test for having been added. */
  await openCollection();
  await expect(empty).toHaveCount(worldNodes(world).length);
  await closeCollection();

  await page.getByRole("button", { name: ENTRY }).click();
  await completed(page, "encuentro");

  await takeTheStars(page);

  const chests = page.getByRole("button", { name: /Abrir el cofre/ });
  await expect(chests).toHaveCount(3);
  await chests.nth(1).click();
  await page.getByRole("button", { name: "Seguir" }).click();

  await openCollection();
  await expect(filled).toHaveCount(1);
  await expect(filled.locator("img")).toBeVisible();
  await expect(empty).toHaveCount(worldNodes(world).length - 1);
});
```

In `"the world reads as one horizontal path, with no page header"` and
`"every chapter is a picture, drawn large and with no glyph on it"`, replace
`world.regions[0]!.nodes.length + 1` and `world.regions[0]!.nodes.length` with
the games count, and drop `:not(.region-door)`:

```ts
  const games = worldNodes(world).filter((node) => node.surface === "juegos");
```

```ts
  const nodes = page.locator(".world-node");
  await expect(nodes).toHaveCount(games.length);
```

```ts
  const markers = page.locator(".world-node .world-node__marker");
  await expect(markers).toHaveCount(games.length);
```

The marker case asserts `marker.text === ""`. The title chip is now *inside*
`.world-node__marker`, so measure the picture instead:

```ts
  const drawn = await markers.evaluateAll((elements) =>
    elements.map((element) => ({
      hasPicture: element.querySelector("img") !== null,
      size: element.getBoundingClientRect().width
    }))
  );

  for (const marker of drawn) {
    expect(marker.hasPicture, "the chapter's own picture").toBe(true);
    expect(marker.size).toBeGreaterThanOrEqual(120);
  }
```

Delete the `"no digit or letter on the marker"` assertion and rename the test
`"every chapter is a picture card, drawn large"`.

In `"the world list is gone while a resource plays"`, add the bar:

```ts
  await expect(page.getByRole("navigation", { name: "Secciones" })).toHaveCount(
    0
  );
```

In `"playing shows only the way back"`, the button count still holds — the bar
and the collection button are gone with the world. Leave it.

Add one new test:

```ts
/* The shelf is open from the first screen, and what is on it is not on the
   path: two sections, not one list shown twice. */
test("the story is on the shelf, open to a brand new player", async ({
  page
}) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "El gallo Rayo" })).toHaveCount(
    0
  );

  await page.getByRole("button", { name: "Recursos" }).click();
  const story = page.getByRole("button", { name: "El gallo Rayo" });
  await expect(story).toBeEnabled();
  await expect(page.getByRole("button", { name: ENTRY })).toHaveCount(0);

  await story.click();
  await expect(page.locator("canvas")).toBeVisible();
});
```

- [ ] **Step 2: Run the suite**

Run: `pnpm test:e2e`
Expected: PASS. It is slow — three viewport projects; budget several minutes.

- [ ] **Step 3: Correct the player's contract**

In `apps/player-web/AGENTS.md`, replace the `## The map` section with:

```markdown
## The world

The world is what a child who cannot read navigates, so it is pictures first.

- **A chapter is its own illustration on a card, never a glyph.** No numbers,
  no letters, no ordinal. The picture is authored per node as `icon` in the
  world schema; the title on the chip is for the adult and the screen reader.
- **There are three sections and one of them is shut.** Juegos and Recursos are
  `WorldNode.surface`, authored per node. Multijugador is a disabled button, not
  a value of the shell's `TabId` union — a screen that cannot be built is a
  state that cannot be represented.
- **What a chapter is worth does not depend on the section it is in.** The
  story on the shelf pays letriestrellas and a chest exactly as a game does, and
  keeps its slot in the collection. Rewards are the world's.
- **Which section a child is in is session state, not stored progress.** The
  app opens on Juegos.
- **Exactly one screen is on at a time**: a playing resource, the stars, the
  reveal, the chests, the menu, the collection, or a section. They are
  exclusive rather than layered so that nothing a child can touch is ever
  hidden behind something else.
```

Also update line 12 and line 18: `the map view derived from it` →
`the world view derived from it`, and `derives a `MapView`` →
`derives a `WorldView``.

- [ ] **Step 4: Run the full gate**

Run: `pnpm check`
Expected: PASS — guardrails, typecheck, tests, build.

- [ ] **Step 5: Commit**

```bash
git add apps/player-web/e2e/player.spec.ts apps/player-web/AGENTS.md
git commit -m "test(player): sweep the world through its sections rather than its regions"
```

---

## Task 7: Retire the plan

- [ ] **Step 1: Distil and delete**

Once `pnpm check` and `pnpm test:e2e` are green, write
`docs/decisions/0007-one-world-three-sections.md` recording the two durable
decisions — the world is flat and a node's `surface` is authored, not derived —
and delete this plan.

```bash
git add docs/decisions/0007-one-world-three-sections.md
git rm docs/plans/ongoing/lingokids-shell.md
git commit -m "docs(decisions): record the flat world and its authored sections"
```
