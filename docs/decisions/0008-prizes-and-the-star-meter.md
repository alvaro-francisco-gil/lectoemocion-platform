# ADR 0008: Prizes and the star meter

Date: 2026-08-08  
Status: Accepted

Distilled from the prizes plan, which shipped and was verified on 2026-08-07.

## Context

`Progress.stars` already existed — three letriestrellas per finished chapter,
paid on replays too — with nothing that spent them. [PR #2][pr2] proposed a
coupon shop: adults write priced offers, a child buys them, a balance goes
down. That PR is closed. Its ADR, `0008-incentives-and-the-star-economy.md`,
never reached `main`; this document takes the number in its place and, below,
the record of why the concept changed.

[pr2]: https://github.com/alvaro-francisco-gil/lectoemocion-platform/pull/2

## Decision

Letriestrellas fill a meter toward a goal an adult sets. Reaching it awards a
wrapped gift (`Prize` in code, "regalo" on screen — a
second thing named "chest" would collide with the three chests a child already
chooses an animal from). An adult, behind a birth-year gate, says what is
inside; the child opens it and a reveal shows an illustration and a phrase, or
their own words and optionally a photo. Nothing is ever spent as currency.

### The meter is derived, never stored

```text
filled = starsEarned − Σ prize.costStars
a prize is owed while filled ≥ goal
```

The same trick `deriveMapView` already used for `pendingReward`: state
computable from what happened is computed, so closing the tab between the last
frame of a game and the ceremony cannot quietly cost a reward. `costStars` is
recorded on the prize at award time, which is what makes a later goal change
safe — lowering the goal owes a prize at once without rewriting what an
earlier prize cost, and raising it just moves the line the same fill is
measured against.

### A prize is a three-state union

`"unconfigured" | "ready" | "opened"`, one object rather than optional fields,
so "opened but never configured" cannot be written down. `content` only exists
on the two states that have it; there is no state where it is present-but-null.

### The preset key is a closed literal union, not a branded id

`PrizePresetKey` is `"patio" | "mesa" | "puerta" | "habitacion"`. The player's
illustration lookup switches over it and closes with `assertNever`, and the
catalog's phrase table is a `Record<PrizePresetKey, string>` — so a preset
added to the union without a picture or a phrase fails to compile. A branded
string id would accept the new key silently at every call site and render a
child nothing at the one that matters.

### The gate is a birth year, and is not security

`isPlausibleBirthYear` guards entry to the adult area as a whole, once per
visit — not each individual control inside it. It is sized to the actual
threat, a curious three-year-old with a finger, not to a determined adult:
a four-digit year on a numeric keypad is past what that child can do, and
costs a literate adult two seconds. Every present and future adult control
inherits the one gate instead of growing its own, and there is one place to
change if the mechanism ever needs to be stronger.

## Rejected alternatives

**The coupon shop of PR #2.** A balance that goes down, a shelf of standing
offers, a purchase history: a three-year-old has to hold a price list, a
running balance, and a choice at once. Watching a meter fill needs none of
that — it is the mechanism that actually teaches waiting at this age, because
the child's only job is to notice progress, not to reason about value.

**Resetting the meter only on opening.** Consuming `costStars` at open time
instead of award time throws away every letriestrella earned while a gift sits
unopened — exactly the tab-close failure `deriveMapView` already exists to
avoid for the map's own reward. Consuming it at award time keeps the meter
refilling immediately, so no star a child earns is ever provisionally at risk.

**A branded `PrizePresetId`.** Reads as more disciplined than a literal union,
but a branded string is still just a string at the type checker: a new preset
id compiles everywhere, including the illustration switch, and renders
nothing. The literal union is what turns a missing picture into a build
failure instead of a blank card in a child's hands.

## What this binds

**A ceremony holds its subject as an id chosen once, never a value re-derived
from a list that can filter it out mid-render.** The reveal screen originally
read its prize from `pending`, which `derivePrizeView` defines as *unopened*
prizes — so opening a gift removed it from the very list the screen was
reading, and every unit test still passed because each one asserted the pure
derivation in isolation, not the wiring. Any screen whose subject must survive
a state change triggered by that screen's own action follows this rule.

**A touch target is proven reachable in the real layout it ships in, not only
in a component test's DOM.** The map's waiting gift rendered correctly and
passed every component test while sharing a hit region with the collection
strip below it on wider viewports, which absorbed the tap first — a class of
overlap jsdom cannot detect. `pnpm test:e2e` in a real browser, at the
viewports the player ships to, is required for any change touching the map or
a ceremony for exactly this reason.

## Revisit when

- A group's prizes need to live in Firestore. `PrizeStore` is already
  owner-keyed and async, mirroring `ProgressStore`, so this is an
  implementation swap behind the interface rather than a redesign.
- A fifth preset place is wanted. Adding it to `PrizePresetKey` is the one
  change; the compiler names every switch and record that then needs a case.
- The gate needs to resist more than a curious child — a family sharing one
  device wanting a second layer, say. That is a different problem, belongs
  with real accounts and identity, and should not turn this gate into
  something it explicitly is not.
