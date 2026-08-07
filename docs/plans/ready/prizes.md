# Prizes

## Goal

Letriestrellas accumulate toward a goal an adult sets — 30 by default. Reaching
it puts a wrapped gift on screen. An adult, behind a gate a preschooler cannot
pass, says what is inside; then the child opens it and the animation shows them
where their real-world prize is.

Nothing here spends stars as currency. Filling a meter is the mechanic.

## Context

`Progress.stars` already exists: three letriestrellas per finished chapter,
paid on replays too, shown by a counter in the map's top-left corner. Twenty-two
chapters means 66 stars from first finishes alone, so a goal of 30 lands a
little past halfway and repeats comfortably.

[PR #2](https://github.com/alvaro-francisco-gil/lectoemocion-platform/pull/2)
proposed the other reading of the same idea: adults write priced coupons, a
child buys them from a shop, stars are spent. It is being closed. The economy
it built — a balance that goes down, a shelf of standing offers, a purchase
history — asks a three-year-old to hold too much at once, and the mechanism
that actually teaches waiting is watching something fill.

That PR carried an ADR of its own, `0008-incentives-and-the-star-economy.md`,
which never reached `main` and now never will. Its rejected alternatives are
still the record of why this concept changed, so the ADR this work writes when
it ships — which takes the number 0008 — restates them as the alternatives it
rejected, and links the closed PR for the rest.

That PR also declared what would have been the repository's only exception to
the player's reach-band rule, because its star counter opened the shop. Closing
the PR leaves that exception unwritten on `main`, and nothing here re-opens it:
the counter stays display-only and the one thing a child touches — a waiting
gift — sits low in the reach band. **The rule keeps having no exceptions**, and
`apps/player-web/AGENTS.md` needs no change to say so.

## Naming

`Chests` already means the three chests a child chooses an animal from at the
end of a chapter. A second thing called a chest is ambiguous in the code and in
the room, so the new one is a **regalo** — a wrapped gift, `Prize` in code, and
visually a gift rather than a chest.

## The cycle

Stored: a goal, and the prizes awarded so far. The meter is **derived**, never
stored:

```text
filled = starsEarned − Σ prize.costStars
a prize is owed while filled ≥ goal
```

This is the trick `deriveMapView` already uses for `pendingReward`: state that
can be computed from what happened is computed, so closing the tab between the
last frame of a game and the ceremony cannot quietly cost a reward.

Three consequences fall out of it rather than being rules of their own:

- **The 30 are consumed the moment the gift appears**, not when it is opened,
  because `costStars` is recorded at award time. The meter starts refilling
  straight away and stars earned while a gift waits are never thrown away.
- **Gifts queue.** Two goals reached with nothing opened means two wrapped gifts
  waiting, each configured on its own.
- **A goal change applies immediately.** Lower it to 10 with 17 filled and a
  gift is owed at once; raise it to 50 and the meter reads 17/50. Each prize
  keeps the `costStars` it was actually awarded for, so changing the goal never
  rewrites what an earlier prize cost.

Bounds on the goal are 5–200, whole numbers only. That is a typo guard, the way
`MAX_COUPON_COST` was, not a design opinion.

## Domain — `packages/domain/src/prize.ts`

A prize is a three-state union, so "opened but never configured" cannot be
written down:

```ts
export type Prize =
  | { id: PrizeId; state: "unconfigured"; awardedAt: string; costStars: number }
  | { id: PrizeId; state: "ready"; awardedAt: string; costStars: number;
      content: PrizeContent }
  | { id: PrizeId; state: "opened"; awardedAt: string; costStars: number;
      content: PrizeContent; openedAt: string };
```

`PrizeContent` is a discriminated union closed with `assertNever` at every site
that renders it:

```ts
export type PrizeContent =
  | { kind: "preset"; preset: PrizePresetKey }
  | { kind: "custom"; text: string; imageId: PrizeImageId | null };
```

`PrizePresetKey` is a closed literal union — `"patio" | "mesa" | "puerta" |
"habitacion"` — rather than a branded id, and that is the point: the player's
illustration lookup is a switch closed with `assertNever`, so adding a preset
fails to compile until it has a picture. A branded string would accept the new
key silently and render nothing. The catalog supplies each key's phrase as a
`Record<PrizePresetKey, string>`, so a preset without copy is a compile error
too.

Custom text is required, 1–80 characters. The adult reads the words aloud, so a
photo with no words leaves nothing to say; the image is the optional half.

`checkCustomPrize(text)` and `checkPrizeGoal(value)` return results rather than
throwing, for the reason `checkCouponDraft` did: the caller is a form with an
adult mid-sentence in it, and it must say which part is wrong instead of
failing.

`PrizeId` and `PrizeImageId` are branded ids added to
`packages/domain/src/ids.ts`.

## The adult gate — `packages/domain/src/adultGate.ts`

```ts
export function isPlausibleBirthYear(year: number, currentYear: number): boolean
```

Sensical means a whole number in `[currentYear − 100, currentYear − 18]`. The
current year is a parameter, so the domain holds no clock and the rule is
testable at a fixed date.

It is not security and is not documented as such. It is a speed bump sized to
the actual threat — a curious three-year-old with a finger — and a four-digit
year typed on a numeric keypad is past what that child can do, while costing a
literate adult two seconds.

**The gate guards entry to the adult area, not individual buttons.** One answer
per visit; going back to the map closes it again. Every present and future adult
control then inherits the gate instead of each one growing its own, and there is
one place to change if the mechanism ever needs to be stronger.

### Guardrail

An adult-only area is exactly the kind of invariant that decays: the next
adult-facing screen gets added next to the others and nobody notices it was
reachable without the gate. `scripts/check-adult-gate.mjs`, with its rule in
`scripts/rules.mjs` and its test in `scripts/rules.test.ts`, asserts that no
module outside `src/app/adult/` imports anything from inside it except the gate
entry point — the same shape of import-boundary check
`check-firebase-boundary.mjs` already performs.

## Presets — `packages/template-catalog/src/prizes/`

Product-authored content: an id, a Spanish phrase, an illustration. The starting
set is four places a prize can plausibly be hidden in a home or a school:

| Preset | Phrase |
|---|---|
| `patio` | Encuentra tu regalo en el patio |
| `mesa` | Encuentra tu regalo debajo de la mesa |
| `puerta` | Encuentra tu regalo detrás de la puerta |
| `habitacion` | Encuentra tu regalo en tu habitación |

Illustrations are drawn as inline SVG, following the reason `ChestIcon` and
`StarIcon` already are: they are on screen the instant a ceremony starts, and on
a classroom panel's cold cache a loaded picture arriving late makes the reward
look like an afterthought.

A missing preset is default content, so invariant 6 applies: it fails closed
with an adult-facing error, never a silent blank card.

## Player-side

### `apps/player-web/src/world/prizes.ts` — pure

Holds `Prizes { goal, prizes }`, the award arithmetic above, and
`derivePrizeView(prizes, starsEarned)` returning:

```ts
{ goal, filled, due, pending: readonly Prize[], history: readonly Prize[] }
```

`pending` is oldest first — the gift that has waited longest is the one owed.
`history` is newest first: what a child asks about is what they just opened.
This is the only place that decides any of it, the same way `deriveMapView` is
the only place that decides what is reachable, so no screen grows a second
opinion about whether a gift is owed.

### `apps/player-web/src/world/prizeStore.ts`

Async and owner-keyed, mirroring `ProgressStore` so a group's prizes move to
Firestore in stage 4 without a caller changing. Reads back defensively: this is
untrusted client state, and a corrupt entry costs one prize rather than the
screen.

Awarding needs an identity and a timestamp, so it is a write rather than a
derivation — the same division `claimReward` already makes. Ids come from a
`Minter` seam so tests can name them, and from a monotonic counter behind the
clock rather than `crypto.randomUUID`, which an old vendor Chromium served over
plain HTTP simply does not have.

### Images

An uploaded photo is downscaled in the browser to a maximum edge of ~512px and
re-encoded as JPEG, then stored under **its own key per image**
(`lectoemocion.prizeImage.<owner>.<imageId>`). A phone photo is several
megabytes and the whole `localStorage` origin quota is about five, so a single
un-resized upload would take the prize list down with it. Separate keys mean a
quota failure costs one picture and the prize survives with its words.

The bytes never leave the device. `scripts/check-privacy.mjs` governs what may
be logged; no image, filename, or data URL is ever logged.

### Screens

- **Map, top-left:** the star counter becomes a fill meter — `17 / 30`, filling.
  Display only, which is what returns the reach-band rule to having no
  exceptions.
- **After the letriestrellas:** the gift screen, slotted into the existing
  exclusive-screen sequence. Stars are only ever paid at the end of a chapter,
  so reaching the goal always happens inside a ceremony that is already running.
  Ready → one large touch target, the gift opens, the reveal. Unconfigured → the
  wrapped gift plus a small adult-facing *Preparar el regalo* behind the gate.
- **Map, low in the reach band:** any waiting gift, so a child who left the
  ceremony can get back to it.
- **Adult area:** set the goal, configure waiting gifts, and the history of
  prizes already given.

The reveal is an illustration and a phrase, with no device audio: the adult is
at the ceremony and reads it aloud. That is a deliberate limit — a child alone
with a custom prize sees the photo and the words without hearing them — and it
is what keeps this change clear of the unresolved
[audio](audio.md) work.

### The animation

CSS and SVG in the React shell, not Phaser, like the other ceremonies: the lid
lifts, a glow grows behind it, the contents scale up out of the box. It honours
`prefers-reduced-motion` by cutting to the revealed state.

## Testing

RED → GREEN → REFACTOR throughout, at the smallest boundary that proves the
behaviour.

- Domain: the gate's year rule at a fixed current year, both validators, the
  three-state union's exhaustiveness.
- World: award arithmetic — goal reached exactly, overshot, queued twice, goal
  lowered below current fill, goal raised above it — and the defensive parse.
- Components: each screen, including the unconfigured gift and a failed image
  write.
- End-to-end across phone, classroom-HD and classroom-4K: fill the meter, meet
  the gate, configure a preset and a custom prize, open the gift.

Verification is `pnpm check` plus `pnpm test:e2e`.

## What this change also does

- Closes PR #2, whose ADR never landed and whose number 0008 this work takes.
- Extracts the inline SVG icons out of `App.tsx` into `src/app/icons.tsx` — the
  one piece of PR #2 worth keeping, re-authored here.
- Records the durable rationale in a new ADR once shipped.

## Open questions

1. **The preset set.** Four is a guess. Whether "detrás de la puerta" and "en tu
   habitación" are the right third and fourth, and whether a school needs
   different places from a home, is a product call.
2. **Where a school's goal is set.** Per-device today, like everything else in
   the player. When groups arrive in stage 4, the goal is plainly a group
   setting; whether a family's goal is per-child is not obvious.

---

# Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task by task. Steps use
> checkbox syntax for tracking.

**Goal:** letriestrellas fill a meter toward an adult-set goal; reaching it
awards a wrapped gift that an adult configures behind a birth-year gate and a
child then opens.

**Architecture:** domain holds the shapes, the validators and the gate rule;
`packages/template-catalog` holds the preset copy; `apps/player-web/src/world/`
holds one pure module deriving everything and one store persisting it;
`src/app/` holds the screens. The meter is derived from
`starsEarned − Σ costStars`, never stored, so no ceremony can be lost to a
closed tab.

**Tech stack:** TypeScript 7 strict, React 19, Vitest + Testing Library,
Playwright, pnpm workspaces, Turbo.

## Global constraints

- **Branch:** all work happens in a worktree. From the repository root:
  `git worktree add .worktrees/prizes -b feat/prizes`, then
  `pnpm install` inside it. Never move `HEAD` in the root checkout.
- **Lifecycle:** before Task 1, move this file from `docs/plans/ready/` to
  `docs/plans/ongoing/` and add the `## Status` block the
  `managing-plans-lifecycle` skill specifies. Refresh it at the start and end
  of every session. Task 16 deletes the file.
- **No `any`, no `@ts-nocheck`, no bare `@ts-ignore`.** Narrow from `unknown`.
- **Every switch over a union ends with** `default: assertNever(value, "…")`.
- **Never construct a branded id by casting.** Use its constructor.
- **No `console.*` anywhere** — `scripts/check-privacy.mjs` fails the build.
  Never log prize text, image ids, or data URLs.
- **Child-facing copy is Spanish.** Adult-facing copy is Spanish too.
- **RED → GREEN → REFACTOR.** Every task writes its failing test first and runs
  it to watch it fail before any implementation exists.
- **Commit at the end of every task** with a conventional-commit subject.
- **Verification per task:** `pnpm typecheck` and the task's own test file.
  Before the final commit of the branch: `pnpm check` and `pnpm test:e2e`.
- Run tests with `pnpm vitest run <path>` from the worktree root.

---

## Task 1: Prize identifiers

**Files:**
- Modify: `packages/domain/src/ids.ts`
- Modify: `packages/domain/src/index.ts`

**Interfaces:**
- Produces: `PrizeId`, `PrizeImageId` types; `prizeId(value: string): PrizeId`,
  `prizeImageId(value: string): PrizeImageId`.

- [ ] **Step 1: Write the failing test** — append to
  `packages/domain/src/ids.test.ts` (create the file if it does not exist,
  importing `describe, expect, it` from `vitest`):

```ts
import { describe, expect, it } from "vitest";
import { prizeId, prizeImageId } from "./ids";

describe("prize identifiers", () => {
  it("keeps the value it was given", () => {
    expect(prizeId("p-1")).toBe("p-1");
    expect(prizeImageId("img-1")).toBe("img-1");
  });

  it("refuses an empty identifier", () => {
    expect(() => prizeId("")).toThrow("PrizeId must not be empty");
  });

  it("refuses surrounding whitespace", () => {
    expect(() => prizeImageId(" img-1")).toThrow(
      "PrizeImageId must not have surrounding whitespace"
    );
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run packages/domain/src/ids.test.ts`
Expected: FAIL — `prizeId` is not exported.

- [ ] **Step 3: Implement** — in `packages/domain/src/ids.ts`, beside the
  existing branded types and constructors:

```ts
export type PrizeId = Branded<string, "PrizeId">;
export type PrizeImageId = Branded<string, "PrizeImageId">;

export function prizeId(value: string): PrizeId {
  return requireNonEmpty("PrizeId", value) as PrizeId;
}

export function prizeImageId(value: string): PrizeImageId {
  return requireNonEmpty("PrizeImageId", value) as PrizeImageId;
}
```

Add `prizeId, prizeImageId` to the value export block in
`packages/domain/src/index.ts` and `PrizeId, PrizeImageId` to the type export
block, both in alphabetical order.

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm vitest run packages/domain/src/ids.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/ids.ts packages/domain/src/ids.test.ts \
  packages/domain/src/index.ts
git commit -m "feat(domain): add prize and prize image identifiers"
```

---

## Task 2: The prize shapes and their validators

**Files:**
- Create: `packages/domain/src/prize.ts`
- Create: `packages/domain/src/prize.test.ts`
- Modify: `packages/domain/src/index.ts`

**Interfaces:**
- Consumes: `PrizeId`, `PrizeImageId` from Task 1.
- Produces: `PrizePresetKey`, `PRIZE_PRESET_KEYS`, `isPrizePresetKey`,
  `PrizeContent`, `Prize`, `DEFAULT_PRIZE_GOAL`, `MIN_PRIZE_GOAL`,
  `MAX_PRIZE_GOAL`, `MAX_PRIZE_TEXT_LENGTH`,
  `checkPrizeGoal(value: number): PrizeGoalCheck`,
  `checkCustomPrize(text: string): CustomPrizeCheck`.

- [ ] **Step 1: Write the failing test** — `packages/domain/src/prize.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  checkCustomPrize,
  checkPrizeGoal,
  DEFAULT_PRIZE_GOAL,
  isPrizePresetKey,
  MAX_PRIZE_GOAL,
  MAX_PRIZE_TEXT_LENGTH,
  MIN_PRIZE_GOAL
} from "./prize";

describe("checkPrizeGoal", () => {
  it("accepts the default", () => {
    expect(checkPrizeGoal(DEFAULT_PRIZE_GOAL)).toEqual({
      ok: true,
      goal: DEFAULT_PRIZE_GOAL
    });
  });

  it("accepts both ends of the range", () => {
    expect(checkPrizeGoal(MIN_PRIZE_GOAL).ok).toBe(true);
    expect(checkPrizeGoal(MAX_PRIZE_GOAL).ok).toBe(true);
  });

  it("refuses a fraction, because a child counts whole stars", () => {
    expect(checkPrizeGoal(12.5)).toEqual({
      ok: false,
      problem: "not-a-whole-number"
    });
  });

  it("refuses a goal outside the typo guard", () => {
    expect(checkPrizeGoal(MIN_PRIZE_GOAL - 1)).toEqual({
      ok: false,
      problem: "out-of-range"
    });
    expect(checkPrizeGoal(MAX_PRIZE_GOAL + 1)).toEqual({
      ok: false,
      problem: "out-of-range"
    });
  });
});

describe("checkCustomPrize", () => {
  it("trims what an adult typed", () => {
    expect(checkCustomPrize("  un helado  ")).toEqual({
      ok: true,
      text: "un helado"
    });
  });

  it("refuses text that is only whitespace", () => {
    expect(checkCustomPrize("   ")).toEqual({ ok: false, problem: "empty-text" });
  });

  it("refuses text past the one-line limit", () => {
    expect(checkCustomPrize("a".repeat(MAX_PRIZE_TEXT_LENGTH + 1))).toEqual({
      ok: false,
      problem: "text-too-long"
    });
  });
});

describe("isPrizePresetKey", () => {
  it("recognises a shipped preset", () => {
    expect(isPrizePresetKey("patio")).toBe(true);
  });

  it("rejects anything else, including a non-string", () => {
    expect(isPrizePresetKey("garaje")).toBe(false);
    expect(isPrizePresetKey(7)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run packages/domain/src/prize.test.ts`
Expected: FAIL — cannot resolve `./prize`.

- [ ] **Step 3: Implement** — `packages/domain/src/prize.ts`:

```ts
import type { PrizeId, PrizeImageId } from "./ids";

/**
 * The places a prize can be hidden, as a closed union rather than a branded id.
 *
 * The player's illustration lookup switches over this and closes with
 * `assertNever`, so adding a preset here fails to compile until it has a
 * picture and a phrase. A branded string would accept a new key silently and
 * render a child nothing.
 */
export type PrizePresetKey = "patio" | "mesa" | "puerta" | "habitacion";

export const PRIZE_PRESET_KEYS: readonly PrizePresetKey[] = [
  "patio",
  "mesa",
  "puerta",
  "habitacion"
];

export function isPrizePresetKey(value: unknown): value is PrizePresetKey {
  return (
    typeof value === "string" &&
    (PRIZE_PRESET_KEYS as readonly string[]).includes(value)
  );
}

/**
 * What is inside the gift.
 *
 * Custom text is required and the image is the optional half: the adult reads
 * the words aloud at the ceremony, so a photo with no words leaves nothing to
 * say.
 */
export type PrizeContent =
  | { readonly kind: "preset"; readonly preset: PrizePresetKey }
  | {
      readonly kind: "custom";
      readonly text: string;
      readonly imageId: PrizeImageId | null;
    };

/**
 * One gift, in one of three states.
 *
 * A union rather than optional fields, so "opened but never configured" cannot
 * be written down. `costStars` is recorded at award time: an adult changing the
 * goal must never rewrite what an earlier prize cost.
 */
export type Prize =
  | {
      readonly id: PrizeId;
      readonly state: "unconfigured";
      readonly awardedAt: string;
      readonly costStars: number;
    }
  | {
      readonly id: PrizeId;
      readonly state: "ready";
      readonly awardedAt: string;
      readonly costStars: number;
      readonly content: PrizeContent;
    }
  | {
      readonly id: PrizeId;
      readonly state: "opened";
      readonly awardedAt: string;
      readonly costStars: number;
      readonly content: PrizeContent;
      readonly openedAt: string;
    };

/** Ten finished chapters. Far enough to be worth waiting for, close enough to reach. */
export const DEFAULT_PRIZE_GOAL = 30;

/**
 * The bounds are a typo guard, not a design limit: at three letriestrellas a
 * chapter, a four-figure goal is a slipped keystroke rather than a decision.
 */
export const MIN_PRIZE_GOAL = 5;
export const MAX_PRIZE_GOAL = 200;

/** Long enough for a real promise, short enough to stay one line an adult reads. */
export const MAX_PRIZE_TEXT_LENGTH = 80;

export type PrizeGoalProblem = "not-a-whole-number" | "out-of-range";

export type PrizeGoalCheck =
  | { readonly ok: true; readonly goal: number }
  | { readonly ok: false; readonly problem: PrizeGoalProblem };

/**
 * Checks a goal an adult typed, and says which part is wrong.
 *
 * A result rather than a throw: the caller is a form with an adult mid-sentence
 * in it, and it must say what to fix rather than fail.
 */
export function checkPrizeGoal(value: number): PrizeGoalCheck {
  if (!Number.isSafeInteger(value)) {
    return { ok: false, problem: "not-a-whole-number" };
  }
  if (value < MIN_PRIZE_GOAL || value > MAX_PRIZE_GOAL) {
    return { ok: false, problem: "out-of-range" };
  }
  return { ok: true, goal: value };
}

export type CustomPrizeProblem = "empty-text" | "text-too-long";

export type CustomPrizeCheck =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly problem: CustomPrizeProblem };

/** Same contract as `checkPrizeGoal`, for the words an adult will read aloud. */
export function checkCustomPrize(text: string): CustomPrizeCheck {
  const trimmed = text.trim();
  if (trimmed.length === 0) return { ok: false, problem: "empty-text" };
  if (trimmed.length > MAX_PRIZE_TEXT_LENGTH) {
    return { ok: false, problem: "text-too-long" };
  }
  return { ok: true, text: trimmed };
}
```

Export every name above from `packages/domain/src/index.ts`, values in the
value block and types in the type block.

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm vitest run packages/domain/src/prize.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/prize.ts packages/domain/src/prize.test.ts \
  packages/domain/src/index.ts
git commit -m "feat(domain): add the prize shapes and their validators"
```

---

## Task 3: The adult gate rule

**Files:**
- Create: `packages/domain/src/adultGate.ts`
- Create: `packages/domain/src/adultGate.test.ts`
- Modify: `packages/domain/src/index.ts`

**Interfaces:**
- Produces: `MIN_ADULT_AGE`, `MAX_ADULT_AGE`,
  `isPlausibleBirthYear(year: number, currentYear: number): boolean`.

- [ ] **Step 1: Write the failing test** —
  `packages/domain/src/adultGate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isPlausibleBirthYear, MAX_ADULT_AGE, MIN_ADULT_AGE } from "./adultGate";

const NOW = 2026;

describe("isPlausibleBirthYear", () => {
  it("accepts a year that would make an adult", () => {
    expect(isPlausibleBirthYear(1988, NOW)).toBe(true);
  });

  it("accepts both ends of the plausible range", () => {
    expect(isPlausibleBirthYear(NOW - MIN_ADULT_AGE, NOW)).toBe(true);
    expect(isPlausibleBirthYear(NOW - MAX_ADULT_AGE, NOW)).toBe(true);
  });

  it("refuses a year that would make a child", () => {
    expect(isPlausibleBirthYear(NOW - MIN_ADULT_AGE + 1, NOW)).toBe(false);
    expect(isPlausibleBirthYear(NOW, NOW)).toBe(false);
  });

  it("refuses a year nobody alive was born in", () => {
    expect(isPlausibleBirthYear(NOW - MAX_ADULT_AGE - 1, NOW)).toBe(false);
  });

  it("refuses what a small hand produces", () => {
    expect(isPlausibleBirthYear(0, NOW)).toBe(false);
    expect(isPlausibleBirthYear(7, NOW)).toBe(false);
    expect(isPlausibleBirthYear(1988.5, NOW)).toBe(false);
    expect(isPlausibleBirthYear(Number.NaN, NOW)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run packages/domain/src/adultGate.test.ts`
Expected: FAIL — cannot resolve `./adultGate`.

- [ ] **Step 3: Implement** — `packages/domain/src/adultGate.ts`:

```ts
/**
 * The gate in front of the adult area.
 *
 * This is not security and must never be described as such. It is a speed bump
 * sized to the actual threat — a curious three-year-old with a finger — and a
 * four-digit year on a numeric keypad is past what that child can do while
 * costing a literate adult two seconds. Anything stronger belongs with
 * accounts, where there is a real identity to check.
 *
 * The current year is a parameter so the domain holds no clock and the rule can
 * be tested at a fixed date.
 */
export const MIN_ADULT_AGE = 18;
export const MAX_ADULT_AGE = 100;

export function isPlausibleBirthYear(
  year: number,
  currentYear: number
): boolean {
  if (!Number.isSafeInteger(year)) return false;
  return (
    year <= currentYear - MIN_ADULT_AGE && year >= currentYear - MAX_ADULT_AGE
  );
}
```

Export all three from `packages/domain/src/index.ts`.

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm vitest run packages/domain/src/adultGate.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/adultGate.ts packages/domain/src/adultGate.test.ts \
  packages/domain/src/index.ts
git commit -m "feat(domain): add the adult gate's birth-year rule"
```

---

## Task 4: Preset copy in the catalog

**Files:**
- Create: `packages/template-catalog/src/prizes/index.ts`
- Create: `packages/template-catalog/src/prizes/prizes.test.ts`
- Modify: `packages/template-catalog/src/index.ts`

**Interfaces:**
- Consumes: `PrizePresetKey`, `PRIZE_PRESET_KEYS` from Task 2.
- Produces: `PRIZE_PRESET_PHRASES: Record<PrizePresetKey, string>`,
  `prizePresetPhrase(key: PrizePresetKey): string`.

Note: this package is engine-neutral. It holds the words only — no React, no
SVG, no renderer object. `scripts/check-engine-neutral.mjs` fails the build on
a React import here.

- [ ] **Step 1: Write the failing test** —
  `packages/template-catalog/src/prizes/prizes.test.ts`:

```ts
import { PRIZE_PRESET_KEYS, MAX_PRIZE_TEXT_LENGTH } from "@lectoemocion/domain";
import { describe, expect, it } from "vitest";
import { PRIZE_PRESET_PHRASES, prizePresetPhrase } from "./index";

describe("prize presets", () => {
  it("gives every shipped preset a phrase", () => {
    for (const key of PRIZE_PRESET_KEYS) {
      expect(prizePresetPhrase(key).length).toBeGreaterThan(0);
    }
  });

  it("keeps every phrase to the one line an adult reads aloud", () => {
    for (const phrase of Object.values(PRIZE_PRESET_PHRASES)) {
      expect(phrase.length).toBeLessThanOrEqual(MAX_PRIZE_TEXT_LENGTH);
    }
  });

  it("names the place, so the words tell a child where to go", () => {
    expect(prizePresetPhrase("patio")).toBe("Encuentra tu regalo en el patio");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run packages/template-catalog/src/prizes/prizes.test.ts`
Expected: FAIL — cannot resolve `./index`.

- [ ] **Step 3: Implement** — `packages/template-catalog/src/prizes/index.ts`:

```ts
import type { PrizePresetKey } from "@lectoemocion/domain";

/**
 * What each preset says, in the words an adult reads to a child.
 *
 * A `Record` over the closed key union rather than an array, so a preset added
 * to the union without copy is a compile error rather than a blank card.
 */
export const PRIZE_PRESET_PHRASES: Record<PrizePresetKey, string> = {
  patio: "Encuentra tu regalo en el patio",
  mesa: "Encuentra tu regalo debajo de la mesa",
  puerta: "Encuentra tu regalo detrás de la puerta",
  habitacion: "Encuentra tu regalo en tu habitación"
};

export function prizePresetPhrase(key: PrizePresetKey): string {
  return PRIZE_PRESET_PHRASES[key];
}
```

Re-export both from `packages/template-catalog/src/index.ts`.

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm vitest run packages/template-catalog/src/prizes/prizes.test.ts &&
pnpm typecheck && node scripts/check-engine-neutral.mjs`
Expected: PASS, and the guardrail reports no violation.

- [ ] **Step 5: Commit**

```bash
git add packages/template-catalog/src/prizes packages/template-catalog/src/index.ts
git commit -m "feat(catalog): add the prize preset phrases"
```

---

## Task 5: The pure prize world

**Files:**
- Create: `apps/player-web/src/world/prizes.ts`
- Create: `apps/player-web/src/world/prizes.test.ts`

**Interfaces:**
- Consumes: `Prize`, `PrizeContent`, `DEFAULT_PRIZE_GOAL`, `PrizeId` from
  Tasks 1–2.
- Produces: `Prizes { goal, prizes }`, `EMPTY_PRIZES`, `PrizeMint`,
  `starsClaimed`, `prizesDue`, `awardDue`, `configurePrize`, `openPrize`,
  `setGoal`, `PrizeView`, `derivePrizeView`.

- [ ] **Step 1: Write the failing test** —
  `apps/player-web/src/world/prizes.test.ts`:

```ts
import { prizeId, type PrizeContent } from "@lectoemocion/domain";
import { describe, expect, it } from "vitest";
import {
  awardDue,
  configurePrize,
  derivePrizeView,
  EMPTY_PRIZES,
  openPrize,
  prizesDue,
  setGoal,
  starsClaimed,
  type Prizes
} from "./prizes";

const PATIO: PrizeContent = { kind: "preset", preset: "patio" };

/** Names every prize and moment, so a test asserts on values it chose. */
function mints(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: prizeId(`p-${index + 1}`),
    at: `2026-08-0${index + 1}T10:00:00.000Z`
  }));
}

describe("prizesDue", () => {
  it("owes nothing below the goal", () => {
    expect(prizesDue(EMPTY_PRIZES, 29)).toBe(0);
  });

  it("owes one at exactly the goal", () => {
    expect(prizesDue(EMPTY_PRIZES, 30)).toBe(1);
  });

  it("owes two when two goals have gone by unawarded", () => {
    expect(prizesDue(EMPTY_PRIZES, 61)).toBe(2);
  });
});

describe("awardDue", () => {
  it("awards one unconfigured prize and consumes the goal", () => {
    const next = awardDue(EMPTY_PRIZES, 31, mints(1));
    expect(next.prizes).toHaveLength(1);
    expect(next.prizes[0]).toEqual({
      id: prizeId("p-1"),
      state: "unconfigured",
      awardedAt: "2026-08-01T10:00:00.000Z",
      costStars: 30
    });
    expect(starsClaimed(next)).toBe(30);
    expect(prizesDue(next, 31)).toBe(0);
  });

  it("queues a second prize rather than dropping the surplus", () => {
    const next = awardDue(EMPTY_PRIZES, 60, mints(2));
    expect(next.prizes).toHaveLength(2);
    expect(starsClaimed(next)).toBe(60);
  });

  it("keeps the meter filling while a prize waits", () => {
    const awarded = awardDue(EMPTY_PRIZES, 33, mints(1));
    expect(derivePrizeView(awarded, 33).filled).toBe(3);
  });
});

describe("setGoal", () => {
  it("owes a prize at once when the goal drops below what is filled", () => {
    const lowered = setGoal(EMPTY_PRIZES, 10);
    expect(prizesDue(lowered, 17)).toBe(1);
  });

  it("measures the same fill against a raised goal", () => {
    const raised = setGoal(EMPTY_PRIZES, 50);
    expect(derivePrizeView(raised, 17)).toMatchObject({ goal: 50, filled: 17 });
  });

  it("never rewrites what an earlier prize cost", () => {
    const awarded = awardDue(EMPTY_PRIZES, 30, mints(1));
    const cheaper = setGoal(awarded, 10);
    expect(cheaper.prizes[0]?.costStars).toBe(30);
    expect(starsClaimed(cheaper)).toBe(30);
  });
});

describe("configurePrize and openPrize", () => {
  const awarded: Prizes = awardDue(EMPTY_PRIZES, 30, mints(1));

  it("makes an unconfigured prize ready", () => {
    const ready = configurePrize(awarded, prizeId("p-1"), PATIO);
    expect(ready.prizes[0]).toMatchObject({ state: "ready", content: PATIO });
  });

  it("refuses to open a prize nobody has configured", () => {
    const untouched = openPrize(awarded, prizeId("p-1"), "2026-08-02T10:00:00.000Z");
    expect(untouched.prizes[0]?.state).toBe("unconfigured");
  });

  it("opens a ready prize once and keeps its content", () => {
    const ready = configurePrize(awarded, prizeId("p-1"), PATIO);
    const opened = openPrize(ready, prizeId("p-1"), "2026-08-02T10:00:00.000Z");
    expect(opened.prizes[0]).toMatchObject({
      state: "opened",
      content: PATIO,
      openedAt: "2026-08-02T10:00:00.000Z"
    });
  });

  it("changes nothing for an id the list no longer holds", () => {
    expect(configurePrize(awarded, prizeId("gone"), PATIO)).toBe(awarded);
  });
});

describe("derivePrizeView", () => {
  it("holds the meter at the goal rather than showing more than full", () => {
    expect(derivePrizeView(EMPTY_PRIZES, 44).filled).toBe(30);
  });

  it("lists what is waiting oldest first and what is done newest first", () => {
    const two = awardDue(EMPTY_PRIZES, 60, mints(2));
    const ready = configurePrize(two, prizeId("p-1"), PATIO);
    const opened = openPrize(ready, prizeId("p-1"), "2026-08-03T10:00:00.000Z");
    const view = derivePrizeView(opened, 60);
    expect(view.pending.map((prize) => prize.id)).toEqual([prizeId("p-2")]);
    expect(view.history.map((prize) => prize.id)).toEqual([prizeId("p-1")]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run apps/player-web/src/world/prizes.test.ts`
Expected: FAIL — cannot resolve `./prizes`.

- [ ] **Step 3: Implement** — `apps/player-web/src/world/prizes.ts`:

```ts
import {
  DEFAULT_PRIZE_GOAL,
  type Prize,
  type PrizeContent,
  type PrizeId
} from "@lectoemocion/domain";

/**
 * What the adults set and what the child has been given.
 *
 * Separate from `Progress` on purpose. Progress is what a child did; this is
 * what the adults around them decided a star is worth, and the two change for
 * entirely different reasons.
 */
export interface Prizes {
  readonly goal: number;
  readonly prizes: readonly Prize[];
}

export const EMPTY_PRIZES: Prizes = {
  goal: DEFAULT_PRIZE_GOAL,
  prizes: []
};

/** The identity and the moment a prize is about to be awarded. */
export interface PrizeMint {
  readonly id: PrizeId;
  /** ISO 8601, in UTC. */
  readonly at: string;
}

/** Every letriestrella already spent on a prize, at the price it cost then. */
export function starsClaimed(prizes: Prizes): number {
  return prizes.prizes.reduce((total, prize) => total + prize.costStars, 0);
}

/**
 * How many prizes the child has earned and not yet been given.
 *
 * Derived rather than remembered, the same way `pendingReward` is: closing the
 * tab between the last frame of a game and the ceremony must not cost a prize.
 * Because `costStars` is recorded per prize, lowering the goal owes one at
 * once and raising it simply moves the line the current fill is measured
 * against.
 */
export function prizesDue(prizes: Prizes, starsEarned: number): number {
  const unclaimed = starsEarned - starsClaimed(prizes);
  if (unclaimed < prizes.goal) return 0;
  return Math.floor(unclaimed / prizes.goal);
}

/**
 * Awards every prize owed, in one step.
 *
 * Takes one mint per prize so identities and timestamps come from the caller
 * and a test can name them. A mint short of what is owed awards what it can:
 * the rest stays owed and is awarded on the next read, which is the honest
 * outcome of running out of names rather than a silently skipped reward.
 */
export function awardDue(
  prizes: Prizes,
  starsEarned: number,
  mints: readonly PrizeMint[]
): Prizes {
  const due = Math.min(prizesDue(prizes, starsEarned), mints.length);
  if (due === 0) return prizes;

  const awarded: Prize[] = [];
  for (let index = 0; index < due; index += 1) {
    const mint = mints[index];
    if (mint === undefined) break;
    awarded.push({
      id: mint.id,
      state: "unconfigured",
      awardedAt: mint.at,
      costStars: prizes.goal
    });
  }
  return { ...prizes, prizes: [...prizes.prizes, ...awarded] };
}

/**
 * Says what is inside a gift.
 *
 * An id the list no longer holds changes nothing, and an already-opened prize
 * is left alone: what a child has already been shown is a fact about that
 * moment and must not change because an adult edited something afterwards.
 */
export function configurePrize(
  prizes: Prizes,
  id: PrizeId,
  content: PrizeContent
): Prizes {
  const target = prizes.prizes.find((prize) => prize.id === id);
  if (target === undefined || target.state === "opened") return prizes;

  return {
    ...prizes,
    prizes: prizes.prizes.map((prize) =>
      prize.id === id
        ? {
            id: prize.id,
            state: "ready",
            awardedAt: prize.awardedAt,
            costStars: prize.costStars,
            content
          }
        : prize
    )
  };
}

/**
 * Opens a gift that is ready.
 *
 * An unconfigured gift cannot be opened — there is nothing inside to show — and
 * an opened one stays opened, so a double tap cannot restamp the moment.
 */
export function openPrize(
  prizes: Prizes,
  id: PrizeId,
  at: string
): Prizes {
  const target = prizes.prizes.find((prize) => prize.id === id);
  if (target === undefined || target.state !== "ready") return prizes;

  return {
    ...prizes,
    prizes: prizes.prizes.map((prize) =>
      prize.id === id && prize.state === "ready"
        ? { ...prize, state: "opened", openedAt: at }
        : prize
    )
  };
}

/** Moves the line the meter is measured against. Awarded prizes keep their cost. */
export function setGoal(prizes: Prizes, goal: number): Prizes {
  return { ...prizes, goal };
}

export interface PrizeView {
  readonly goal: number;
  /** Never more than the goal: a meter fuller than full says nothing. */
  readonly filled: number;
  readonly due: number;
  /** Awarded and not yet opened, oldest first — the longest wait is owed first. */
  readonly pending: readonly Prize[];
  /** Opened, newest first: what a child asks about is what they just opened. */
  readonly history: readonly Prize[];
}

/**
 * Projects the prize list onto what a child has earned.
 *
 * Pure, and the only place that decides whether a gift is owed — the same
 * division `deriveMapView` draws, so no screen grows its own opinion.
 */
export function derivePrizeView(
  prizes: Prizes,
  starsEarned: number
): PrizeView {
  const unclaimed = Math.max(0, starsEarned - starsClaimed(prizes));
  return {
    goal: prizes.goal,
    filled: Math.min(unclaimed, prizes.goal),
    due: prizesDue(prizes, starsEarned),
    pending: prizes.prizes.filter((prize) => prize.state !== "opened"),
    history: prizes.prizes.filter((prize) => prize.state === "opened").reverse()
  };
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm vitest run apps/player-web/src/world/prizes.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/player-web/src/world/prizes.ts apps/player-web/src/world/prizes.test.ts
git commit -m "feat(player): derive the prize meter from stars earned"
```

---

## Task 6: The prize store

**Files:**
- Create: `apps/player-web/src/world/prizeStore.ts`
- Create: `apps/player-web/src/world/prizeStore.test.ts`

**Interfaces:**
- Consumes: everything from Task 5, plus `prizeId`, `prizeImageId`,
  `checkPrizeGoal`, `isPrizePresetKey` from Tasks 1–2.
- Produces: `PrizeStore` interface, `Minter`, `systemMinter()`,
  `systemImageId(): PrizeImageId`, `prizeStorageKey(owner)`, `LocalPrizeStore`.

- [ ] **Step 1: Write the failing test** —
  `apps/player-web/src/world/prizeStore.test.ts`:

```ts
import { prizeId, type PrizeContent, type PrizeId } from "@lectoemocion/domain";
import { beforeEach, describe, expect, it } from "vitest";
import { LOCAL_OWNER } from "./progressStore";
import { EMPTY_PRIZES } from "./prizes";
import { LocalPrizeStore, prizeStorageKey, type Minter } from "./prizeStore";

const PATIO: PrizeContent = { kind: "preset", preset: "patio" };

/** A storage that a test can read, seed and break. */
function memoryStorage(seed: Record<string, string> = {}) {
  const entries = new Map(Object.entries(seed));
  return {
    entries,
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    }
  };
}

/** Names every id and moment, so assertions are about values the test chose. */
function countingMinter(): Minter {
  let minted = 0;
  return {
    prizeId: () => prizeId(`p-${++minted}`),
    now: () => "2026-08-07T10:00:00.000Z"
  };
}

describe("LocalPrizeStore", () => {
  let storage: ReturnType<typeof memoryStorage>;
  let store: LocalPrizeStore;

  beforeEach(() => {
    storage = memoryStorage();
    store = new LocalPrizeStore(storage, LOCAL_OWNER, countingMinter());
  });

  it("starts at the default goal with nothing awarded", async () => {
    await expect(store.read()).resolves.toEqual(EMPTY_PRIZES);
  });

  it("awards what is owed and persists it under the owner's key", async () => {
    const next = await store.awardDue(30);
    expect(next.prizes).toHaveLength(1);
    expect(storage.entries.get(prizeStorageKey(LOCAL_OWNER))).toContain("p-1");
  });

  it("configures and opens a prize", async () => {
    await store.awardDue(30);
    await store.configure(prizeId("p-1"), PATIO);
    const opened = await store.open(prizeId("p-1"));
    expect(opened.prizes[0]).toMatchObject({
      state: "opened",
      openedAt: "2026-08-07T10:00:00.000Z"
    });
  });

  it("refuses a goal outside the typo guard and keeps the old one", async () => {
    await expect(store.setGoal(0)).resolves.toMatchObject({ goal: 30 });
    await expect(store.setGoal(10)).resolves.toMatchObject({ goal: 10 });
  });

  it("reads back a stored list", async () => {
    const seeded = new LocalPrizeStore(
      memoryStorage({
        [prizeStorageKey(LOCAL_OWNER)]: JSON.stringify({
          goal: 12,
          prizes: [
            {
              id: "p-9",
              state: "ready",
              awardedAt: "2026-08-01T10:00:00.000Z",
              costStars: 12,
              content: { kind: "preset", preset: "mesa" }
            }
          ]
        })
      }),
      LOCAL_OWNER,
      countingMinter()
    );
    const read = await seeded.read();
    expect(read.goal).toBe(12);
    expect(read.prizes).toHaveLength(1);
  });

  it("drops a corrupt prize rather than the whole list", async () => {
    const seeded = new LocalPrizeStore(
      memoryStorage({
        [prizeStorageKey(LOCAL_OWNER)]: JSON.stringify({
          goal: 30,
          prizes: [
            { id: "p-1", state: "unconfigured", awardedAt: "x", costStars: 30 },
            { id: "p-2", state: "ready", awardedAt: "x", costStars: 30 },
            { id: "p-3", state: "ready", awardedAt: "x", costStars: 30,
              content: { kind: "preset", preset: "garaje" } },
            { id: "p-4", state: "ready", awardedAt: "x", costStars: 30,
              content: { kind: "custom", text: "un helado", imageId: null } }
          ]
        })
      }),
      LOCAL_OWNER,
      countingMinter()
    );
    const read = await seeded.read();
    expect(read.prizes.map((prize) => prize.id)).toEqual([
      prizeId("p-1"),
      prizeId("p-4")
    ]);
  });

  it("falls back to a goal it can trust when the stored one is nonsense", async () => {
    const seeded = new LocalPrizeStore(
      memoryStorage({
        [prizeStorageKey(LOCAL_OWNER)]: JSON.stringify({ goal: -4, prizes: [] })
      }),
      LOCAL_OWNER,
      countingMinter()
    );
    await expect(seeded.read()).resolves.toMatchObject({ goal: 30 });
  });

  it("keeps playing when storage denies a write", async () => {
    const denied = new LocalPrizeStore(
      {
        getItem: () => null,
        setItem: () => {
          throw new Error("QuotaExceededError");
        }
      },
      LOCAL_OWNER,
      countingMinter()
    );
    const awarded = await denied.awardDue(30);
    expect(awarded.prizes).toHaveLength(1);
    await expect(denied.read()).resolves.toEqual(awarded);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run apps/player-web/src/world/prizeStore.test.ts`
Expected: FAIL — cannot resolve `./prizeStore`.

- [ ] **Step 3: Implement** — `apps/player-web/src/world/prizeStore.ts`:

```ts
import {
  checkPrizeGoal,
  DEFAULT_PRIZE_GOAL,
  isPrizePresetKey,
  prizeId,
  prizeImageId,
  type Prize,
  type PrizeContent,
  type PrizeId,
  type PrizeImageId
} from "@lectoemocion/domain";
import {
  awardDue,
  configurePrize,
  EMPTY_PRIZES,
  openPrize,
  prizesDue,
  setGoal,
  type PrizeMint,
  type Prizes
} from "./prizes";

/**
 * Where the prizes live.
 *
 * Async and owner-keyed for exactly the reasons `ProgressStore` is: stage 4
 * puts a group's prizes in Firestore behind this interface, and `owner` becomes
 * the group id, without a caller changing.
 */
export interface PrizeStore {
  read(): Promise<Prizes>;
  /**
   * Awards every prize the child has earned and not been given.
   *
   * `starsEarned` is a parameter rather than a second store read, because the
   * two totals live apart on purpose: stars are what a child did, prizes are
   * what adults promised, and only the caller holding both may award one.
   */
  awardDue(starsEarned: number): Promise<Prizes>;
  configure(id: PrizeId, content: PrizeContent): Promise<Prizes>;
  open(id: PrizeId): Promise<Prizes>;
  /** A goal outside the typo guard is refused and the old one stands. */
  setGoal(goal: number): Promise<Prizes>;
}

/** Where new identities and timestamps come from, so tests can name them. */
export interface Minter {
  prizeId(): PrizeId;
  /** ISO 8601, in UTC. */
  now(): string;
}

export function prizeStorageKey(owner: string): string {
  return `lectoemocion.prizes.${owner}`;
}

/**
 * Identities that hold on the hardware this actually runs on.
 *
 * Not `crypto.randomUUID`: the classroom panel may be an old vendor Chromium
 * served over plain HTTP, where it is simply absent. A monotonic counter behind
 * the clock is unique on one device, which is the whole scope of this store —
 * when a group's prizes move to Firestore, Firestore mints the ids.
 */
export function systemMinter(): Minter {
  let minted = 0;
  return {
    prizeId: () => prizeId(`${Date.now().toString(36)}-${++minted}`),
    now: () => new Date().toISOString()
  };
}

/** The same counter, for images, which are stored under keys of their own. */
export function systemImageId(): PrizeImageId {
  return prizeImageId(
    `${Date.now().toString(36)}-${Math.trunc(performance.now())}`
  );
}

type MinimalStorage = Pick<Storage, "getItem" | "setItem">;

/**
 * Reads the list back defensively, on the same terms as stored progress: this
 * is untrusted client state, and a corrupt entry costs one prize rather than
 * the screen. A dropped prize is one an adult can hand over anyway; a thrown
 * error is a child who cannot see any of them.
 */
function parsePrizes(raw: string | null): Prizes {
  if (raw === null) return EMPTY_PRIZES;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return EMPTY_PRIZES;
  }

  if (typeof value !== "object" || value === null) return EMPTY_PRIZES;
  const candidate = value as Record<string, unknown>;
  return {
    goal: parseGoal(candidate["goal"]),
    prizes: parsePrizeList(candidate["prizes"])
  };
}

/** A goal nobody can explain reads as the default rather than as a broken meter. */
function parseGoal(value: unknown): number {
  if (typeof value !== "number") return DEFAULT_PRIZE_GOAL;
  const checked = checkPrizeGoal(value);
  return checked.ok ? checked.goal : DEFAULT_PRIZE_GOAL;
}

function parseCost(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    return null;
  }
  return value;
}

/** Content that does not name a shipped preset, or has no words, is not content. */
function parseContent(value: unknown): PrizeContent | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;

  if (record["kind"] === "preset") {
    const preset = record["preset"];
    return isPrizePresetKey(preset) ? { kind: "preset", preset } : null;
  }

  if (record["kind"] === "custom") {
    const text = record["text"];
    const imageId = record["imageId"];
    if (typeof text !== "string" || text.trim().length === 0) return null;
    return {
      kind: "custom",
      text,
      imageId: typeof imageId === "string" ? prizeImageId(imageId) : null
    };
  }

  return null;
}

function parsePrizeList(value: unknown): readonly Prize[] {
  if (!Array.isArray(value)) return [];

  const prizes: Prize[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const id = record["id"];
    const awardedAt = record["awardedAt"];
    const costStars = parseCost(record["costStars"]);
    if (typeof id !== "string" || typeof awardedAt !== "string") continue;
    if (costStars === null) continue;

    const state = record["state"];
    if (state === "unconfigured") {
      prizes.push({ id: prizeId(id), state, awardedAt, costStars });
      continue;
    }

    const content = parseContent(record["content"]);
    if (content === null) continue;

    if (state === "ready") {
      prizes.push({ id: prizeId(id), state, awardedAt, costStars, content });
      continue;
    }

    const openedAt = record["openedAt"];
    if (state === "opened" && typeof openedAt === "string") {
      prizes.push({
        id: prizeId(id),
        state,
        awardedAt,
        costStars,
        content,
        openedAt
      });
    }
  }
  return prizes;
}

export class LocalPrizeStore implements PrizeStore {
  private fallback: Prizes = EMPTY_PRIZES;

  constructor(
    private readonly storage: MinimalStorage,
    private readonly owner: string,
    private readonly minter: Minter
  ) {}

  async read(): Promise<Prizes> {
    try {
      return parsePrizes(this.storage.getItem(prizeStorageKey(this.owner)));
    } catch {
      /* Private browsing and locked-down panel browsers can deny storage. */
      return this.fallback;
    }
  }

  async awardDue(starsEarned: number): Promise<Prizes> {
    const current = await this.read();
    const due = prizesDue(current, starsEarned);
    if (due === 0) return current;

    const mints: PrizeMint[] = Array.from({ length: due }, () => ({
      id: this.minter.prizeId(),
      at: this.minter.now()
    }));
    return this.write(awardDue(current, starsEarned, mints));
  }

  async configure(id: PrizeId, content: PrizeContent): Promise<Prizes> {
    return this.write(configurePrize(await this.read(), id, content));
  }

  async open(id: PrizeId): Promise<Prizes> {
    return this.write(openPrize(await this.read(), id, this.minter.now()));
  }

  /**
   * A goal the validator refuses leaves the old one standing.
   *
   * The form checks first and shows the adult what is wrong; this is the
   * boundary behind it, so a stale tab or a second adult cannot write a goal
   * no screen would have accepted.
   */
  async setGoal(goal: number): Promise<Prizes> {
    const current = await this.read();
    const checked = checkPrizeGoal(goal);
    if (!checked.ok) return current;
    return this.write(setGoal(current, checked.goal));
  }

  private write(next: Prizes): Prizes {
    this.fallback = next;
    try {
      this.storage.setItem(prizeStorageKey(this.owner), JSON.stringify(next));
    } catch {
      /* Same as above: an unwritable store must not break the session. */
    }
    return next;
  }
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm vitest run apps/player-web/src/world/prizeStore.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/player-web/src/world/prizeStore.ts \
  apps/player-web/src/world/prizeStore.test.ts
git commit -m "feat(player): persist prizes per owner"
```

---

## Task 7: The image store and its downscaling

**Files:**
- Create: `apps/player-web/src/world/prizeImageStore.ts`
- Create: `apps/player-web/src/world/prizeImageStore.test.ts`

**Interfaces:**
- Consumes: `PrizeImageId` from Task 1.
- Produces: `MAX_PRIZE_IMAGE_EDGE`, `PRIZE_IMAGE_QUALITY`,
  `prizeImageKey(owner, id)`, `fittedSize(width, height, maxEdge)`,
  `PrizeImageStore` interface, `LocalPrizeImageStore`, `downscaleToDataUrl`.

- [ ] **Step 1: Write the failing test** —
  `apps/player-web/src/world/prizeImageStore.test.ts`:

```ts
import { prizeImageId } from "@lectoemocion/domain";
import { describe, expect, it } from "vitest";
import { LOCAL_OWNER } from "./progressStore";
import {
  fittedSize,
  LocalPrizeImageStore,
  MAX_PRIZE_IMAGE_EDGE,
  prizeImageKey
} from "./prizeImageStore";

const ID = prizeImageId("img-1");
const DATA_URL = "data:image/jpeg;base64,AAAA";

function memoryStorage(seed: Record<string, string> = {}) {
  const entries = new Map(Object.entries(seed));
  return {
    entries,
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
    removeItem: (key: string) => {
      entries.delete(key);
    }
  };
}

describe("fittedSize", () => {
  it("leaves a picture already within the limit alone", () => {
    expect(fittedSize(400, 300, MAX_PRIZE_IMAGE_EDGE)).toEqual({
      width: 400,
      height: 300
    });
  });

  it("fits a landscape photo by its long edge", () => {
    expect(fittedSize(4000, 3000, 512)).toEqual({ width: 512, height: 384 });
  });

  it("fits a portrait photo by its long edge", () => {
    expect(fittedSize(3000, 4000, 512)).toEqual({ width: 384, height: 512 });
  });

  it("never rounds an edge away to nothing", () => {
    expect(fittedSize(2000, 1, 512).height).toBe(1);
  });
});

describe("LocalPrizeImageStore", () => {
  it("keeps each picture under a key of its own", async () => {
    const storage = memoryStorage();
    const store = new LocalPrizeImageStore(storage, LOCAL_OWNER);
    await expect(store.save(ID, DATA_URL)).resolves.toBe(true);
    expect(storage.entries.get(prizeImageKey(LOCAL_OWNER, ID))).toBe(DATA_URL);
    await expect(store.read(ID)).resolves.toBe(DATA_URL);
  });

  it("reports a refused write rather than throwing, so the words survive", async () => {
    const store = new LocalPrizeImageStore(
      {
        getItem: () => null,
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
        removeItem: () => undefined
      },
      LOCAL_OWNER
    );
    await expect(store.save(ID, DATA_URL)).resolves.toBe(false);
  });

  it("reads nothing for a picture that was never stored", async () => {
    const store = new LocalPrizeImageStore(memoryStorage(), LOCAL_OWNER);
    await expect(store.read(ID)).resolves.toBeNull();
  });

  it("removes a picture", async () => {
    const storage = memoryStorage();
    const store = new LocalPrizeImageStore(storage, LOCAL_OWNER);
    await store.save(ID, DATA_URL);
    await store.remove(ID);
    expect(storage.entries.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run apps/player-web/src/world/prizeImageStore.test.ts`
Expected: FAIL — cannot resolve `./prizeImageStore`.

- [ ] **Step 3: Implement** — `apps/player-web/src/world/prizeImageStore.ts`:

```ts
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
 * One key per picture.
 *
 * Separate from the prize list on purpose: a quota failure then costs one
 * picture, and the prize survives with the words the adult will read aloud.
 */
export function prizeImageKey(owner: string, id: PrizeImageId): string {
  return `lectoemocion.prizeImage.${owner}.${id}`;
}

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
 * only path available in an aged WebView; a failure to decode is surfaced to
 * the caller, which shows the adult that the picture did not work rather than
 * storing something a child would see as a broken card.
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
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm vitest run apps/player-web/src/world/prizeImageStore.test.ts &&
pnpm typecheck && node scripts/check-privacy.mjs`
Expected: PASS, and the privacy guardrail reports no violation.

- [ ] **Step 5: Commit**

```bash
git add apps/player-web/src/world/prizeImageStore.ts \
  apps/player-web/src/world/prizeImageStore.test.ts
git commit -m "feat(player): store a downscaled prize picture per key"
```

---

## Task 8: Extract the icons, unchanged

A pure move, no behaviour change. It exists so the next four tasks have
somewhere to put a gift and a meter without growing `App.tsx` further.

**Files:**
- Create: `apps/player-web/src/app/icons.tsx`
- Modify: `apps/player-web/src/app/App.tsx`

**Interfaces:**
- Produces: `ChestIcon`, `StarIcon`, `MenuIcon`, `CloseIcon`, `BackArrow` as
  named exports.

- [ ] **Step 1: Confirm the existing tests are green first**

Run: `pnpm vitest run apps/player-web/src/app/App.test.tsx`
Expected: PASS. This is the safety net for the move; a refactor with no failing
test to write is the one case where RED does not apply, and the existing suite
is what proves nothing changed.

- [ ] **Step 2: Move the components**

Cut `ChestIcon`, `StarIcon`, `MenuIcon`, `CloseIcon` and `BackArrow` out of
`App.tsx` verbatim — including their comments, which explain why they are drawn
rather than loaded — into `apps/player-web/src/app/icons.tsx`, adding `export`
to each. Add to the top of the new file:

```tsx
/**
 * The chrome drawn rather than loaded.
 *
 * Several of these are the first thing on screen after a game ends, and a
 * picture that arrives a beat late would make the ceremony stutter on the
 * classroom panel's cold cache.
 */
```

Import them in `App.tsx` from `./icons`.

- [ ] **Step 3: Run the suite and watch it stay green**

Run: `pnpm vitest run apps/player-web/src/app && pnpm typecheck`
Expected: PASS, unchanged.

- [ ] **Step 4: Commit**

```bash
git add apps/player-web/src/app/icons.tsx apps/player-web/src/app/App.tsx
git commit -m "refactor(player): move the drawn icons out of App"
```

---

## Task 9: The gift and meter artwork

**Files:**
- Modify: `apps/player-web/src/app/icons.tsx`
- Create: `apps/player-web/src/app/prizeIllustration.tsx`
- Create: `apps/player-web/src/app/prizeIllustration.test.tsx`

**Interfaces:**
- Consumes: `PrizePresetKey` from Task 2, `assertNever` from the domain.
- Produces: `GiftIcon` from `icons.tsx`;
  `PrizeIllustration({ preset }: { preset: PrizePresetKey })` from
  `prizeIllustration.tsx`.

- [ ] **Step 1: Write the failing test** —
  `apps/player-web/src/app/prizeIllustration.test.tsx`:

```tsx
import { PRIZE_PRESET_KEYS } from "@lectoemocion/domain";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PrizeIllustration } from "./prizeIllustration";

describe("PrizeIllustration", () => {
  it("draws a picture for every shipped preset", () => {
    for (const preset of PRIZE_PRESET_KEYS) {
      const { unmount } = render(<PrizeIllustration preset={preset} />);
      expect(screen.getByTestId(`prize-illustration-${preset}`)).toBeVisible();
      unmount();
    }
  });

  it("hides the picture from a screen reader, because the phrase says it", () => {
    render(<PrizeIllustration preset="patio" />);
    expect(screen.getByTestId("prize-illustration-patio")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run apps/player-web/src/app/prizeIllustration.test.tsx`
Expected: FAIL — cannot resolve `./prizeIllustration`.

- [ ] **Step 3: Implement** — `apps/player-web/src/app/prizeIllustration.tsx`:

```tsx
import { assertNever, type PrizePresetKey } from "@lectoemocion/domain";
import type { ReactElement } from "react";

/**
 * Where the prize is, drawn.
 *
 * A switch closed with `assertNever` rather than a lookup table, so a preset
 * added to the union fails to compile until it has a picture. The phrase
 * beside it is what a screen reader announces, so every drawing here is
 * decoration.
 */
export function PrizeIllustration({
  preset
}: {
  preset: PrizePresetKey;
}): ReactElement {
  switch (preset) {
    case "patio":
      return (
        <svg
          data-testid="prize-illustration-patio"
          viewBox="0 0 120 100"
          width="100%"
          height="100%"
          aria-hidden="true"
        >
          <rect x="0" y="70" width="120" height="30" fill="#cfe3a8" />
          <circle cx="30" cy="45" r="22" fill="#5d9b4b" />
          <rect x="27" y="60" width="6" height="16" fill="#8a5a2b" />
          <path d="M70 76V44l22-10v32Z" fill="#d98c3f" />
          <circle cx="98" cy="22" r="10" fill="#f4c95d" />
        </svg>
      );
    case "mesa":
      return (
        <svg
          data-testid="prize-illustration-mesa"
          viewBox="0 0 120 100"
          width="100%"
          height="100%"
          aria-hidden="true"
        >
          <rect x="10" y="34" width="100" height="10" rx="4" fill="#b5651d" />
          <rect x="18" y="44" width="8" height="42" fill="#8a4712" />
          <rect x="94" y="44" width="8" height="42" fill="#8a4712" />
          <rect x="48" y="58" width="26" height="26" rx="4" fill="#e05a72" />
          <rect x="58" y="58" width="6" height="26" fill="#f4c95d" />
        </svg>
      );
    case "puerta":
      return (
        <svg
          data-testid="prize-illustration-puerta"
          viewBox="0 0 120 100"
          width="100%"
          height="100%"
          aria-hidden="true"
        >
          <rect x="24" y="12" width="52" height="80" rx="4" fill="#b5651d" />
          <circle cx="68" cy="54" r="4" fill="#f4c95d" />
          <path d="M76 12h20v80H76Z" fill="#8a4712" />
          <rect x="92" y="66" width="22" height="24" rx="4" fill="#e05a72" />
          <rect x="100" y="66" width="6" height="24" fill="#f4c95d" />
        </svg>
      );
    case "habitacion":
      return (
        <svg
          data-testid="prize-illustration-habitacion"
          viewBox="0 0 120 100"
          width="100%"
          height="100%"
          aria-hidden="true"
        >
          <rect x="8" y="52" width="72" height="32" rx="6" fill="#8fb8e0" />
          <rect x="8" y="44" width="26" height="14" rx="5" fill="#fdfdfd" />
          <rect x="0" y="84" width="120" height="8" fill="#cfe3a8" />
          <rect x="88" y="58" width="26" height="26" rx="4" fill="#e05a72" />
          <rect x="98" y="58" width="6" height="26" fill="#f4c95d" />
        </svg>
      );
    default:
      return assertNever(preset, "prize preset illustration");
  }
}
```

Add `GiftIcon` to `apps/player-web/src/app/icons.tsx`:

```tsx
/**
 * The wrapped gift, distinct from the chests on purpose.
 *
 * `ChestIcon` already means the three chests a child chooses an animal from. A
 * second thing shaped like a chest would make the two rewards read as one.
 */
export function GiftIcon() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
      <rect x="10" y="38" width="80" height="52" rx="6" fill="#e05a72" />
      <rect x="6" y="26" width="88" height="18" rx="6" fill="#f2778c" />
      <rect x="42" y="26" width="16" height="64" fill="#f4c95d" />
      <path
        d="M50 26c-10-14-28-8-22 2 4 6 14 5 22-2Zm0 0c10-14 28-8 22 2-4 6-14 5-22-2Z"
        fill="#f4c95d"
      />
    </svg>
  );
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm vitest run apps/player-web/src/app/prizeIllustration.test.tsx &&
pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/player-web/src/app/prizeIllustration.tsx \
  apps/player-web/src/app/prizeIllustration.test.tsx \
  apps/player-web/src/app/icons.tsx
git commit -m "feat(player): draw the gift and the preset places"
```

---

## Task 10: The meter on the map

**Files:**
- Modify: `apps/player-web/src/app/App.tsx` (replace `StarCounter`)
- Modify: `apps/player-web/src/styles.css`
- Modify: `apps/player-web/src/app/App.test.tsx`

**Interfaces:**
- Consumes: `PrizeView` from Task 5.
- Produces: `PrizeMeter({ filled, goal }: { filled: number; goal: number })`,
  rendered by `App` in place of `StarCounter`.

- [ ] **Step 1: Write the failing test** — add to
  `apps/player-web/src/app/App.test.tsx`:

```tsx
describe("the prize meter", () => {
  it("shows what is filled against the goal", async () => {
    render(<App />);
    const meter = await screen.findByRole("meter", {
      name: "Letriestrellas hacia el próximo regalo"
    });
    expect(meter).toHaveAttribute("aria-valuenow", "0");
    expect(meter).toHaveAttribute("aria-valuemax", "30");
    expect(meter).toHaveTextContent("0 / 30");
  });

  it("is display only, so nothing a child touches sits out of reach", async () => {
    render(<App />);
    const meter = await screen.findByRole("meter", {
      name: "Letriestrellas hacia el próximo regalo"
    });
    expect(within(meter).queryByRole("button")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run apps/player-web/src/app/App.test.tsx -t "prize meter"`
Expected: FAIL — no element with role `meter`.

- [ ] **Step 3: Implement** — replace `StarCounter` in `App.tsx`:

```tsx
/**
 * How close the child is to the next regalo, in the map's top-left corner.
 *
 * Display only, and that is what keeps the reach-band rule intact: nothing a
 * child needs to touch sits at the top of an 86-inch panel. The star is still
 * the picture, because the stars are still what fills it.
 */
function PrizeMeter({ filled, goal }: { filled: number; goal: number }) {
  return (
    <section
      className="prize-meter"
      role="meter"
      aria-label="Letriestrellas hacia el próximo regalo"
      aria-valuenow={filled}
      aria-valuemin={0}
      aria-valuemax={goal}
    >
      <StarIcon />
      <span className="prize-meter__count">
        {filled} / {goal}
      </span>
      {/*
        Decoration: the count above is what says how far along the child is,
        and a screen reader reading the bar as well would say it twice.
      */}
      <span className="prize-meter__track" aria-hidden="true">
        <span
          className="prize-meter__fill"
          style={{ width: `${(filled / goal) * 100}%` }}
        />
      </span>
    </section>
  );
}
```

In `App`, hold the prizes and render it:

```tsx
const [prizes, setPrizes] = useState<Prizes>(EMPTY_PRIZES);

const prizeView = useMemo(
  () => derivePrizeView(prizes, view.stars),
  [prizes, view.stars]
);
```

and in the map's JSX replace `<StarCounter stars={view.stars} />` with
`<PrizeMeter filled={prizeView.filled} goal={prizeView.goal} />`.

Read the store alongside progress in the existing mount effect:

```tsx
void prizeStore.read().then((stored) => {
  if (!cancelled) setPrizes(stored);
});
```

with the module-level store beside the progress one:

```tsx
const prizeStore = new LocalPrizeStore(storage, LOCAL_OWNER, systemMinter());
```

where `storage` is lifted out of the existing `LocalProgressStore`
construction so both stores share it:

```tsx
const storage =
  typeof localStorage === "undefined"
    ? { getItem: () => null, setItem: () => undefined }
    : localStorage;

const store = new LocalProgressStore(storage, LOCAL_OWNER);
```

Add to `apps/player-web/src/styles.css`, beside the existing
`.star-counter` rules, which are replaced:

```css
.prize-meter {
  position: absolute;
  top: 1.5rem;
  left: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
  border-radius: 999px;
  background: rgb(255 255 255 / 0.85);
  font-size: 1.75rem;
  font-weight: 700;
}

.prize-meter > svg {
  width: 2.5rem;
  height: 2.5rem;
}

.prize-meter__track {
  display: block;
  width: 8rem;
  height: 0.75rem;
  border-radius: 999px;
  background: #e3e3e3;
  overflow: hidden;
}

.prize-meter__fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: #f4c95d;
  transition: width 400ms ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .prize-meter__fill {
    transition: none;
  }
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm vitest run apps/player-web/src/app/App.test.tsx && pnpm typecheck`
Expected: PASS, including every existing test — update any that asserted on
the old star counter's text so they read the meter instead.

- [ ] **Step 5: Commit**

```bash
git add apps/player-web/src/app/App.tsx apps/player-web/src/app/App.test.tsx \
  apps/player-web/src/styles.css
git commit -m "feat(player): fill a meter toward the next regalo"
```

---

## Task 11: The adult area behind the gate

**Files:**
- Create: `apps/player-web/src/app/adult/index.tsx`
- Create: `apps/player-web/src/app/adult/AdultGate.tsx`
- Create: `apps/player-web/src/app/adult/PrizeSettings.tsx`
- Create: `apps/player-web/src/app/adult/PrizeForm.tsx`
- Create: `apps/player-web/src/app/adult/adult.test.tsx`
- Modify: `apps/player-web/src/styles.css`

**Interfaces:**
- Consumes: `isPlausibleBirthYear`, `checkPrizeGoal`, `checkCustomPrize`,
  `PRIZE_PRESET_KEYS`, `prizePresetPhrase`, `PrizeView` from Tasks 2–5.
- Produces from `adult/index.tsx` — the **only** module anything outside
  `src/app/adult/` may import:

```tsx
export function AdultArea(props: {
  view: PrizeView;
  currentYear: number;
  onSetGoal: (goal: number) => void;
  onConfigure: (id: PrizeId, content: PrizeContent) => void;
  onPickImage: (file: File) => Promise<PrizeImageId | null>;
  onClose: () => void;
}): ReactElement;
```

- [ ] **Step 1: Write the failing test** —
  `apps/player-web/src/app/adult/adult.test.tsx`:

```tsx
import { prizeId, type PrizeContent, type PrizeId } from "@lectoemocion/domain";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { derivePrizeView, EMPTY_PRIZES, awardDue } from "../../world/prizes";
import { AdultArea } from "./index";

const NOW = 2026;

function open(overrides: Partial<Parameters<typeof AdultArea>[0]> = {}) {
  const props = {
    view: derivePrizeView(EMPTY_PRIZES, 0),
    currentYear: NOW,
    onSetGoal: vi.fn(),
    onConfigure: vi.fn(),
    onPickImage: vi.fn(async () => null),
    onClose: vi.fn(),
    ...overrides
  };
  render(<AdultArea {...props} />);
  return props;
}

/** Answers the gate the way an adult does. */
function passGate(year = 1988) {
  fireEvent.change(screen.getByLabelText("¿En qué año naciste?"), {
    target: { value: String(year) }
  });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
}

describe("the adult gate", () => {
  it("shows nothing of the adult area before it is answered", () => {
    open();
    expect(screen.queryByLabelText("Letriestrellas para el próximo regalo"))
      .toBeNull();
  });

  it("opens the area for a year that would make an adult", () => {
    open();
    passGate(1988);
    expect(
      screen.getByLabelText("Letriestrellas para el próximo regalo")
    ).toBeVisible();
  });

  it("refuses a year a child would type and says so", () => {
    open();
    passGate(7);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Ese año no puede ser. Inténtalo otra vez."
    );
    expect(screen.queryByLabelText("Letriestrellas para el próximo regalo"))
      .toBeNull();
  });

  it("refuses a year that would make a child", () => {
    open();
    passGate(NOW - 5);
    expect(screen.getByRole("alert")).toBeVisible();
  });
});

describe("the goal", () => {
  it("saves a goal an adult typed", () => {
    const props = open();
    passGate();
    fireEvent.change(
      screen.getByLabelText("Letriestrellas para el próximo regalo"),
      { target: { value: "12" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(props.onSetGoal).toHaveBeenCalledWith(12);
  });

  it("refuses a goal outside the range and does not save it", () => {
    const props = open();
    passGate();
    fireEvent.change(
      screen.getByLabelText("Letriestrellas para el próximo regalo"),
      { target: { value: "0" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(props.onSetGoal).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("entre 5 y 200");
  });
});

describe("configuring a waiting gift", () => {
  const waiting = awardDue(EMPTY_PRIZES, 30, [
    { id: prizeId("p-1"), at: "2026-08-01T10:00:00.000Z" }
  ]);

  it("lists a gift that is waiting to be filled", () => {
    open({ view: derivePrizeView(waiting, 30) });
    passGate();
    expect(screen.getByText("Un regalo esperando")).toBeVisible();
  });

  it("saves a preset the adult chose", () => {
    const props = open({ view: derivePrizeView(waiting, 30) });
    passGate();
    fireEvent.click(
      screen.getByRole("radio", { name: "Encuentra tu regalo en el patio" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Guardar el regalo" }));
    expect(props.onConfigure).toHaveBeenCalledWith(prizeId("p-1"), {
      kind: "preset",
      preset: "patio"
    } satisfies PrizeContent);
  });

  it("saves custom words with no picture", () => {
    const props = open({ view: derivePrizeView(waiting, 30) });
    passGate();
    fireEvent.click(screen.getByRole("radio", { name: "Escribirlo yo" }));
    fireEvent.change(screen.getByLabelText("¿Qué hay dentro?"), {
      target: { value: "  un helado  " }
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar el regalo" }));
    expect(props.onConfigure).toHaveBeenCalledWith(prizeId("p-1"), {
      kind: "custom",
      text: "un helado",
      imageId: null
    } satisfies PrizeContent);
  });

  it("refuses custom words that are empty", () => {
    const props = open({ view: derivePrizeView(waiting, 30) });
    passGate();
    fireEvent.click(screen.getByRole("radio", { name: "Escribirlo yo" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar el regalo" }));
    expect(props.onConfigure).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Escribe qué hay dentro");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run apps/player-web/src/app/adult/adult.test.tsx`
Expected: FAIL — cannot resolve `./index`.

- [ ] **Step 3: Implement**

`apps/player-web/src/app/adult/AdultGate.tsx`:

```tsx
import { isPlausibleBirthYear } from "@lectoemocion/domain";
import { useId, useState, type ReactNode } from "react";

/**
 * The one door into the adult area.
 *
 * A birth year rather than a PIN: there is nothing to set up, nothing to
 * forget, and nothing to write on the back of the panel. It is not security and
 * is not described as such — it is sized to a curious three-year-old, and
 * anything stronger belongs with accounts.
 *
 * Passing it opens the area for this visit only. Leaving closes it again, so a
 * device left on the map is a device a child cannot get past.
 */
export function AdultGate({
  currentYear,
  children
}: {
  currentYear: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState("");
  const [refused, setRefused] = useState(false);
  const fieldId = useId();

  if (open) return <>{children}</>;

  return (
    <form
      className="adult-gate"
      onSubmit={(event) => {
        event.preventDefault();
        if (isPlausibleBirthYear(Number.parseInt(year, 10), currentYear)) {
          setOpen(true);
          return;
        }
        setRefused(true);
        setYear("");
      }}
    >
      <label className="adult-gate__label" htmlFor={fieldId}>
        ¿En qué año naciste?
      </label>
      <input
        id={fieldId}
        className="adult-gate__field"
        type="number"
        inputMode="numeric"
        autoComplete="off"
        value={year}
        onChange={(event) => setYear(event.target.value)}
      />
      {refused ? (
        <p className="adult-gate__refusal" role="alert">
          Ese año no puede ser. Inténtalo otra vez.
        </p>
      ) : null}
      <button type="submit" className="adult-gate__submit">
        Entrar
      </button>
    </form>
  );
}
```

`apps/player-web/src/app/adult/PrizeForm.tsx` — the goal field and the
per-gift form. Build it with:

- a number input labelled `Letriestrellas para el próximo regalo`, a
  `Guardar` button, and `checkPrizeGoal` deciding whether `onSetGoal` is
  called; on `out-of-range` render
  `<p role="alert">Elige un número entre 5 y 200</p>`, on
  `not-a-whole-number` render
  `<p role="alert">Elige un número entero</p>`, closed with
  `assertNever(checked.problem, "prize goal problem")`;
- a radio group over `PRIZE_PRESET_KEYS`, each labelled with
  `prizePresetPhrase(key)`, plus one further radio labelled `Escribirlo yo`;
- when `Escribirlo yo` is chosen, a text input labelled `¿Qué hay dentro?`
  and a file input labelled `Añadir una foto` whose change handler calls
  `onPickImage(file)` and holds the returned `PrizeImageId | null`;
- a `Guardar el regalo` button that runs `checkCustomPrize` for the custom
  case — on `empty-text` render
  `<p role="alert">Escribe qué hay dentro</p>`, on `text-too-long` render
  `<p role="alert">Son demasiadas palabras</p>`, closed with
  `assertNever(checked.problem, "custom prize problem")` — and calls
  `onConfigure(prize.id, content)`.

`apps/player-web/src/app/adult/PrizeSettings.tsx` — the area's body: the goal
form, then `view.pending.map(...)` rendering a `PrizeForm` per waiting gift
under the heading `Un regalo esperando` (plural `{n} regalos esperando`), then
`view.history` as a read-only list of what has already been given.

`apps/player-web/src/app/adult/index.tsx`:

```tsx
import type { PrizeContent, PrizeId, PrizeImageId } from "@lectoemocion/domain";
import type { ReactElement } from "react";
import type { PrizeView } from "../../world/prizes";
import { AdultGate } from "./AdultGate";
import { PrizeSettings } from "./PrizeSettings";

/**
 * The adult area, and the only module outside this directory anything may
 * import.
 *
 * The gate wraps the whole area rather than each control inside it, so every
 * adult-facing thing added here inherits it instead of growing its own.
 * `scripts/check-adult-gate.mjs` is what keeps that true.
 */
export function AdultArea({
  view,
  currentYear,
  onSetGoal,
  onConfigure,
  onPickImage,
  onClose
}: {
  view: PrizeView;
  currentYear: number;
  onSetGoal: (goal: number) => void;
  onConfigure: (id: PrizeId, content: PrizeContent) => void;
  onPickImage: (file: File) => Promise<PrizeImageId | null>;
  onClose: () => void;
}): ReactElement {
  return (
    <main className="adult" role="dialog" aria-modal="true" aria-label="Ajustes">
      <button
        type="button"
        className="menu__close"
        aria-label="Cerrar los ajustes"
        onClick={onClose}
      >
        <CloseIcon />
      </button>
      <AdultGate currentYear={currentYear}>
        <PrizeSettings
          view={view}
          onSetGoal={onSetGoal}
          onConfigure={onConfigure}
          onPickImage={onPickImage}
        />
      </AdultGate>
    </main>
  );
}
```

importing `CloseIcon` from `../icons`. Add `.adult`, `.adult-gate`,
`.adult-gate__field`, `.adult-gate__refusal` and `.adult-gate__submit` rules to
`styles.css`, matching the existing `.menu` rules in weight and spacing.

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm vitest run apps/player-web/src/app/adult && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/player-web/src/app/adult apps/player-web/src/styles.css
git commit -m "feat(player): put the prize settings behind an adult gate"
```

---

## Task 12: The gift ceremony

**Files:**
- Create: `apps/player-web/src/app/Gift.tsx`
- Create: `apps/player-web/src/app/Gift.test.tsx`
- Modify: `apps/player-web/src/styles.css`

**Interfaces:**
- Consumes: `Prize`, `prizePresetPhrase`, `PrizeIllustration`, `GiftIcon`.
- Produces:

```tsx
export function Gift(props: {
  prize: Prize;
  imageUrl: string | null;
  onOpen: (id: PrizeId) => void;
  onPrepare: () => void;
  onContinue: () => void;
}): ReactElement;
```

- [ ] **Step 1: Write the failing test** —
  `apps/player-web/src/app/Gift.test.tsx`:

```tsx
import { prizeId, type Prize } from "@lectoemocion/domain";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Gift } from "./Gift";

const ID = prizeId("p-1");
const BASE = { id: ID, awardedAt: "2026-08-01T10:00:00.000Z", costStars: 30 };

const UNCONFIGURED: Prize = { ...BASE, state: "unconfigured" };
const READY_PRESET: Prize = {
  ...BASE,
  state: "ready",
  content: { kind: "preset", preset: "patio" }
};
const OPENED_CUSTOM: Prize = {
  ...BASE,
  state: "opened",
  content: { kind: "custom", text: "un helado", imageId: null },
  openedAt: "2026-08-02T10:00:00.000Z"
};

function show(prize: Prize, imageUrl: string | null = null) {
  const props = {
    prize,
    imageUrl,
    onOpen: vi.fn(),
    onPrepare: vi.fn(),
    onContinue: vi.fn()
  };
  render(<Gift {...props} />);
  return props;
}

describe("a gift nobody has filled yet", () => {
  it("cannot be opened", () => {
    show(UNCONFIGURED);
    expect(screen.queryByRole("button", { name: "¡Ábrelo!" })).toBeNull();
  });

  it("offers the adult a way to fill it", () => {
    const props = show(UNCONFIGURED);
    fireEvent.click(screen.getByRole("button", { name: "Preparar el regalo" }));
    expect(props.onPrepare).toHaveBeenCalled();
  });

  it("lets the child carry on rather than trapping them in front of it", () => {
    const props = show(UNCONFIGURED);
    fireEvent.click(screen.getByRole("button", { name: "Seguir" }));
    expect(props.onContinue).toHaveBeenCalled();
  });
});

describe("a gift that is ready", () => {
  it("opens on one press", () => {
    const props = show(READY_PRESET);
    fireEvent.click(screen.getByRole("button", { name: "¡Ábrelo!" }));
    expect(props.onOpen).toHaveBeenCalledWith(ID);
  });

  it("shows nothing of what is inside before it is opened", () => {
    show(READY_PRESET);
    expect(screen.queryByText("Encuentra tu regalo en el patio")).toBeNull();
  });
});

describe("a gift that is open", () => {
  it("shows the preset's picture and its phrase", () => {
    render(
      <Gift
        prize={{ ...BASE, state: "opened", content: { kind: "preset", preset: "patio" },
          openedAt: "2026-08-02T10:00:00.000Z" }}
        imageUrl={null}
        onOpen={vi.fn()}
        onPrepare={vi.fn()}
        onContinue={vi.fn()}
      />
    );
    expect(screen.getByText("Encuentra tu regalo en el patio")).toBeVisible();
    expect(screen.getByTestId("prize-illustration-patio")).toBeVisible();
  });

  it("shows the adult's words, and their picture when there is one", () => {
    show(OPENED_CUSTOM, "data:image/jpeg;base64,AAAA");
    expect(screen.getByText("un helado")).toBeVisible();
    expect(screen.getByAltText("")).toHaveAttribute(
      "src",
      "data:image/jpeg;base64,AAAA"
    );
  });

  it("shows the words alone when the picture could not be stored", () => {
    show(OPENED_CUSTOM, null);
    expect(screen.getByText("un helado")).toBeVisible();
    expect(screen.queryByRole("img")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run apps/player-web/src/app/Gift.test.tsx`
Expected: FAIL — cannot resolve `./Gift`.

- [ ] **Step 3: Implement** — `apps/player-web/src/app/Gift.tsx`, switching on
  `prize.state` and closing with
  `assertNever(prize, "gift state")`, and on `content.kind` closing with
  `assertNever(content, "prize content")`. The three screens:

  - `unconfigured` — `<GiftIcon />` wrapped, the line
    `Un regalo te está esperando`, a small `Preparar el regalo` button calling
    `onPrepare`, and a `Seguir` button calling `onContinue`.
  - `ready` — `<GiftIcon />` and one large `¡Ábrelo!` button calling
    `onOpen(prize.id)`. Nothing of the content is rendered.
  - `opened` — the reveal: `<PrizeIllustration preset={content.preset} />` and
    `prizePresetPhrase(content.preset)` for a preset; the adult's `text` and,
    when `imageUrl` is not null, `<img src={imageUrl} alt="" />` for a custom
    one. Then a `Seguir` button calling `onContinue`.

  The custom picture is `alt=""` for the same reason the collection's animals
  are: the words beside it are the accessible text, and a screen reader
  announcing both would say it twice.

  Add to `styles.css`:

```css
.gift__box {
  width: min(40vh, 18rem);
  animation: gift-wait 2.4s ease-in-out infinite;
}

.gift__reveal {
  animation: gift-open 600ms ease-out both;
}

@keyframes gift-wait {
  0%, 100% { transform: translateY(0) rotate(-2deg); }
  50% { transform: translateY(-0.5rem) rotate(2deg); }
}

@keyframes gift-open {
  from { transform: scale(0.4); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

/*
  A child who needs less motion still gets the whole ceremony: the gift is
  simply already open rather than opening.
*/
@media (prefers-reduced-motion: reduce) {
  .gift__box,
  .gift__reveal {
    animation: none;
  }
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm vitest run apps/player-web/src/app/Gift.test.tsx && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/player-web/src/app/Gift.tsx apps/player-web/src/app/Gift.test.tsx \
  apps/player-web/src/styles.css
git commit -m "feat(player): open a regalo and show what is inside"
```

---

## Task 13: Wire the shell

**Files:**
- Modify: `apps/player-web/src/app/App.tsx`
- Modify: `apps/player-web/src/app/App.test.tsx`
- Modify: `apps/player-web/src/styles.css`

**Interfaces:**
- Consumes: Tasks 5–12.
- Produces: the screen order, the award effect, and the map's waiting gift.

- [ ] **Step 1: Write the failing test** — add to `App.test.tsx`:

```tsx
describe("reaching the goal", () => {
  /** Seeds a session one chapter short of the goal. */
  function nearlyThere(): void {
    localStorage.setItem(
      "lectoemocion.prizes.local",
      JSON.stringify({ goal: 6, prizes: [] })
    );
  }

  beforeEach(() => {
    localStorage.clear();
  });

  it("puts a gift on screen after the stars, not instead of them", async () => {
    nearlyThere();
    render(<App />);
    await playFirstChapter();
    await collectStars();
    await openFirstChest();
    expect(await screen.findByText("Un regalo te está esperando")).toBeVisible();
  });

  it("leaves the gift on the map when the child carries on", async () => {
    nearlyThere();
    render(<App />);
    await playFirstChapter();
    await collectStars();
    await openFirstChest();
    fireEvent.click(screen.getByRole("button", { name: "Seguir" }));
    expect(
      await screen.findByRole("button", { name: "Tu regalo" })
    ).toBeVisible();
  });

  it("starts the meter refilling the moment the gift is awarded", async () => {
    nearlyThere();
    render(<App />);
    await playFirstChapter();
    await collectStars();
    await openFirstChest();
    fireEvent.click(screen.getByRole("button", { name: "Seguir" }));
    const meter = await screen.findByRole("meter", {
      name: "Letriestrellas hacia el próximo regalo"
    });
    expect(meter).toHaveAttribute("aria-valuenow", "0");
  });
});
```

Reuse the file's existing `playFirstChapter`, `collectStars` and
`openFirstChest` helpers; if a helper for opening a chest does not exist, add
one that clicks the first `chest` button and then `Seguir`.

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run apps/player-web/src/app/App.test.tsx -t "reaching the goal"`
Expected: FAIL — no gift appears.

- [ ] **Step 3: Implement** — in `App.tsx`:

Replace `menuOpen` with a single screen fact, so "both screens on" cannot be
written down:

```tsx
/*
 * The adult area and the gift are screens of their own rather than layers, so
 * which one is on is one fact. A pair of booleans could say "both", and both is
 * not a state this shell has.
 */
const [detour, setDetour] = useState<"none" | "adult" | "gift">("none");
```

Award what is owed whenever the meter reaches the goal:

```tsx
/*
 * Awarding is a write — a prize needs an identity and a moment — so it cannot
 * be derived the way the meter is. It runs off `due`, which is derived, so a
 * tab closed between the last frame of a game and this effect still finds the
 * prize owed on the next read.
 */
useEffect(() => {
  if (prizeView.due === 0) return;
  void prizeStore.awardDue(view.stars).then(setPrizes);
}, [prizeView.due, view.stars]);
```

Show the gift after the letriestrellas and after any chest ceremony, by placing
its branch below the existing `pendingReward` branch and above the map:

```tsx
const waiting = prizeView.pending[0] ?? null;

if (detour === "gift" && waiting) {
  return (
    <Gift
      prize={waiting}
      imageUrl={giftImage}
      onOpen={openGift}
      onPrepare={() => setDetour("adult")}
      onContinue={() => setDetour("none")}
    />
  );
}
```

with the ceremony entered automatically once, when a gift is first awarded:

```tsx
/*
 * The gift takes the screen the first time it exists, because a wrapped box
 * appearing quietly in the corner of a busy map is a thing a child does not
 * find. Once dismissed it waits on the map instead — `shown` is what keeps the
 * ceremony from re-entering every render.
 */
const shown = useRef<PrizeId | null>(null);
useEffect(() => {
  if (!waiting || shown.current === waiting.id) return;
  shown.current = waiting.id;
  setDetour("gift");
}, [waiting]);
```

`openGift` writes the opening and keeps the child on the same screen, which now
renders the reveal because the prize's state changed:

```tsx
const openGift = useCallback((id: PrizeId) => {
  void prizeStore.open(id).then(setPrizes);
}, []);
```

`giftImage` is the custom picture, read from the image store when the waiting
gift has one:

```tsx
const [giftImage, setGiftImage] = useState<string | null>(null);
useEffect(() => {
  const content = waiting?.state === "unconfigured" ? null : waiting?.content;
  if (content?.kind !== "custom" || content.imageId === null) {
    setGiftImage(null);
    return;
  }
  let cancelled = false;
  void imageStore.read(content.imageId).then((url) => {
    if (!cancelled) setGiftImage(url);
  });
  return () => {
    cancelled = true;
  };
}, [waiting]);
```

The map gets the waiting gift, low in the reach band, beside the existing menu
button:

```tsx
{waiting ? (
  <button
    type="button"
    className="map__gift"
    aria-label="Tu regalo"
    onClick={() => setDetour("gift")}
  >
    <GiftIcon />
  </button>
) : null}
```

and the menu button now opens the adult area:

```tsx
if (detour === "adult") {
  return (
    <AdultArea
      view={prizeView}
      currentYear={new Date().getFullYear()}
      onSetGoal={setPrizeGoal}
      onConfigure={configure}
      onPickImage={pickImage}
      onClose={() => setDetour("none")}
    />
  );
}
```

with the three callbacks:

```tsx
const setPrizeGoal = useCallback((goal: number) => {
  void prizeStore.setGoal(goal).then(setPrizes);
}, []);

const configure = useCallback((id: PrizeId, content: PrizeContent) => {
  void prizeStore.configure(id, content).then(setPrizes);
}, []);

/**
 * Takes what an adult picked, shrinks it, and keeps it under its own key.
 *
 * Returns `null` when the picture could not be decoded or storage refused it,
 * and the form then saves the prize with its words alone — the half an adult
 * actually reads to the child.
 */
const pickImage = useCallback(async (file: File) => {
  const id = systemImageId();
  try {
    const dataUrl = await downscaleToDataUrl(file);
    return (await imageStore.save(id, dataUrl)) ? id : null;
  } catch {
    return null;
  }
}, []);
```

Add the module-level image store beside the others:

```tsx
const imageStore = new LocalPrizeImageStore(
  typeof localStorage === "undefined"
    ? {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined
      }
    : localStorage,
  LOCAL_OWNER
);
```

Add `.map__gift` to `styles.css`, positioned `bottom: 2rem; left: 2rem;` with a
minimum 6rem touch target — the reach band, where a child can actually hit it.

Delete the now-unused `Menu` component if the adult area replaces it entirely;
keep it only if something still renders it.

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm vitest run apps/player-web/src/app && pnpm typecheck`
Expected: PASS, including every pre-existing test.

- [ ] **Step 5: Commit**

```bash
git add apps/player-web/src/app/App.tsx apps/player-web/src/app/App.test.tsx \
  apps/player-web/src/styles.css
git commit -m "feat(player): award, configure and open the regalo in the shell"
```

---

## Task 14: The adult-area guardrail

**Files:**
- Modify: `scripts/rules.mjs`
- Modify: `scripts/rules.test.ts`
- Create: `scripts/check-adult-gate.mjs`
- Modify: `package.json` (the `guardrails` script)
- Modify: `CLAUDE.md`/`AGENTS.md` (the enforcement table)

**Interfaces:**
- Produces: `ADULT_AREA`, `isDeepAdultAreaImport` in `rules.mjs`.

- [ ] **Step 1: Write the failing rule test** — add to `scripts/rules.test.ts`:

```ts
describe("isDeepAdultAreaImport", () => {
  it("flags a screen reaching past the gate", () => {
    expect(
      isDeepAdultAreaImport('import { PrizeForm } from "./adult/PrizeForm";')
    ).toBe(true);
    expect(
      isDeepAdultAreaImport(
        'import { AdultGate } from "../app/adult/AdultGate";'
      )
    ).toBe(true);
  });

  it("accepts the gate's own entry point", () => {
    expect(isDeepAdultAreaImport('import { AdultArea } from "./adult";')).toBe(
      false
    );
  });

  it("accepts imports that have nothing to do with the adult area", () => {
    expect(isDeepAdultAreaImport('import { Gift } from "./Gift";')).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run scripts/rules.test.ts -t "isDeepAdultAreaImport"`
Expected: FAIL — `isDeepAdultAreaImport` is not exported.

- [ ] **Step 3: Implement** — in `scripts/rules.mjs`:

```js
/** The adult area. Everything in it is reachable only through its gate. */
export const ADULT_AREA = "apps/player-web/src/app/adult/";

/**
 * An adult-only area is exactly the kind of invariant that decays: the next
 * adult-facing screen gets added beside the others and nobody notices it is
 * reachable without the gate. Only `adult/index.tsx` may be imported from
 * outside, and that module wraps the area in `AdultGate`.
 */
export const isDeepAdultAreaImport = (line) =>
  /from\s+["'][^"']*\/adult\/[^"']+["']/.test(line);
```

`scripts/check-adult-gate.mjs`:

```js
#!/usr/bin/env node
/**
 * The adult area is reachable only through its gate.
 *
 * Hiding UI is never authorization (invariant 4), and this gate is not
 * security — but a control an adult is meant to reach past a speed bump must
 * not be importable around it, or the speed bump is decoration.
 */
import { findViolations, report, sourceFiles } from "./guardrails.mjs";
import { ADULT_AREA, isDeepAdultAreaImport } from "./rules.mjs";

const guarded = (await sourceFiles()).filter(
  (path) => !path.startsWith(ADULT_AREA)
);

const ok = report(
  "adult area reachable only through its gate",
  await findViolations(guarded, isDeepAdultAreaImport),
  "Import AdultArea from apps/player-web/src/app/adult instead."
);

process.exit(ok ? 0 : 1);
```

Append `&& node scripts/check-adult-gate.mjs` to the `guardrails` script in
`package.json`, and add the row to the enforcement table in `AGENTS.md`:

```markdown
| 4 — adult area behind its gate | `scripts/check-adult-gate.mjs` |
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm vitest run scripts/rules.test.ts && pnpm guardrails`
Expected: PASS, and the new guardrail reports no violation.

- [ ] **Step 5: Prove the guardrail can actually fail**

Temporarily add `import { AdultGate } from "./adult/AdultGate";` to
`App.tsx`, run `node scripts/check-adult-gate.mjs`, confirm it exits non-zero
and names the file, then remove the line.

- [ ] **Step 6: Commit**

```bash
git add scripts/rules.mjs scripts/rules.test.ts scripts/check-adult-gate.mjs \
  package.json AGENTS.md
git commit -m "feat(scripts): guard the adult area's single entry point"
```

---

## Task 15: End to end, on the three viewports

**Files:**
- Modify: `apps/player-web/e2e/player.spec.ts`

- [ ] **Step 1: Write the failing tests**

Add a seeding helper beside the existing `withProgress`:

```ts
/**
 * Seeds the adults' side: the goal, and any prizes already awarded.
 *
 * Through the same key the app reads, for the same reason `withProgress` does:
 * a test that reaches past the store is testing something the product does not
 * do.
 */
async function withPrizes(
  page: Page,
  prizes: { goal: number; prizes: unknown[] }
) {
  await page.addInitScript((seed) => {
    localStorage.setItem("lectoemocion.prizes.local", JSON.stringify(seed));
  }, prizes);
}
```

Then, in the existing per-viewport describe block, add tests covering:

1. the meter reads `0 / 30` on a fresh session;
2. a session seeded at `goal: 3` with one chapter played shows the gift screen
   after the letriestrellas;
3. `Seguir` leaves the gift reachable on the map at `Tu regalo`, and the meter
   has restarted at `0 / 3`;
4. `Preparar el regalo` reaches the gate, a birth year of `2024` is refused
   with the alert, and `1988` opens the settings;
5. choosing `Encuentra tu regalo en el patio` and saving makes the gift
   openable, and `¡Ábrelo!` reveals the phrase;
6. a custom prize with a picture: `setInputFiles` with a small fixture JPEG,
   save, open, and the reveal shows both the words and an `img`;
7. the goal field refuses `0` and accepts `12`, and the meter then reads
   against `12`.

Each assertion uses the same role-and-name queries as the unit tests, so the
two suites describe the same product.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm test:e2e`
Expected: FAIL on the new tests only.

- [ ] **Step 3: Fix what the real browser finds**

Everything under test already exists after Task 13. Expect the failures here to
be about layout at 4K and about the file input, not about logic. Fit the gift
screen and the adult forms inside every viewport rather than loosening the
assertions.

- [ ] **Step 4: Run the whole gate**

Run: `pnpm check && pnpm test:e2e`
Expected: PASS — guardrails, typecheck, every unit test, the build, and every
end-to-end test on phone, classroom-HD and classroom-4K.

- [ ] **Step 5: Commit**

```bash
git add apps/player-web/e2e/player.spec.ts
git commit -m "test(player): cover the regalo end to end on every viewport"
```

---

## Task 16: Record the decision and retire the plan

**Files:**
- Create: `docs/decisions/0008-prizes-and-the-star-meter.md`
- Delete: `docs/plans/ongoing/prizes.md`
- Modify: `apps/player-web/AGENTS.md`

- [ ] **Step 1: Write the ADR**

`docs/decisions/0008-prizes-and-the-star-meter.md`, using the house sections —
Context, Decision, Rejected alternatives, What this binds, Revisit when.
Carry across only the durable rationale:

- letriestrellas fill toward a goal and are never spent as currency;
- the meter is derived from `starsEarned − Σ costStars`, so no ceremony
  survives a closed tab as a lost reward, and `costStars` per prize is what
  makes a goal change safe;
- a prize is a three-state union so "opened but unconfigured" is
  unrepresentable;
- the preset key is a closed literal union so a new preset without a picture
  or a phrase fails to compile;
- the gate is a birth year, is explicitly not security, and guards the area
  rather than each button;
- **rejected:** the coupon shop of PR #2 — a balance that goes down, a shelf of
  standing offers, a purchase history — and why watching something fill is the
  mechanism that teaches waiting at ages 3–5;
- **rejected:** resetting only on opening, which throws away stars earned while
  a gift waits;
- **rejected:** a branded `PrizePresetId`, which loses the exhaustiveness
  check.

- [ ] **Step 2: Document the world layer**

Add to `apps/player-web/AGENTS.md`, beside the existing note on the shell and
the scenes:

```markdown
The same division holds for the prizes. `prizes.ts` is pure — the ledger, the
award arithmetic, and `derivePrizeView` — and `prizeStore.ts` persists it.
Screens receive a `PrizeView` and callbacks, never `Prizes`, so no screen grows
its own opinion about whether a gift is owed. The adult area is reachable only
through `src/app/adult/index.tsx`, which is what
`scripts/check-adult-gate.mjs` enforces. Rationale is in
[ADR 0008](../../docs/decisions/0008-prizes-and-the-star-meter.md).
```

- [ ] **Step 3: Delete the plan**

```bash
git rm docs/plans/ongoing/prizes.md
```

The code and the ADR are the record now. Completed plans are not archived.

- [ ] **Step 4: Run the gate one more time**

Run: `pnpm check && pnpm test:e2e`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/decisions/0008-prizes-and-the-star-meter.md \
  apps/player-web/AGENTS.md
git commit -m "docs(decisions): record the prize meter and its adult gate"
```

- [ ] **Step 6: Merge, and ask before anything outward-facing**

From the repository root, which is already on `main`:

```bash
git merge --ff-only feat/prizes
git worktree remove .worktrees/prizes
git branch -d feat/prizes
```

Closing PR #2 and pushing require explicit authorization at that moment. Do
neither without asking.
