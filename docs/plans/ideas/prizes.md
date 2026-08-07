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
  | { kind: "preset"; presetId: PrizePresetId }
  | { kind: "custom"; text: string; imageId: PrizeImageId | null };
```

Custom text is required, 1–80 characters. The adult reads the words aloud, so a
photo with no words leaves nothing to say; the image is the optional half.

`checkCustomPrize(text)` and `checkPrizeGoal(value)` return results rather than
throwing, for the reason `checkCouponDraft` did: the caller is a form with an
adult mid-sentence in it, and it must say which part is wrong instead of
failing.

`PrizeId`, `PrizePresetId` and `PrizeImageId` are branded ids added to
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
