# ADR 0008: Incentives and the star economy

Date: 2026-08-07  
Status: Accepted

## Context

Letriestrellas were paid for every finish and spent on nothing. A number that
only climbs is a scoreboard, and a scoreboard is not a motivation for a child of
three — the reward has to be something the adults around them can actually give.

Adults asked for that: a list of rewards they define themselves — half an hour
of football, choosing Friday's film — priced in stars, bought by the child, with
a record of what was bought.

## Decision

### Coupons are adult-authored, and nothing ships with them

There is no default coupon list and no catalogue entry for one. A reward has to
be something *these* adults can honour, so a product-authored default would be a
promise nobody made. An empty list is the correct starting state, and the map
offers no way into the shop until a coupon exists — a shelf with nothing on it
is a door a child opens onto nothing.

This is not a violation of "every template ships playable with default content".
Incentives are not content and not a template; they are a per-group policy about
what a star is worth, and the world plays exactly as before without them.

### Earned and spent are two facts; the balance is derived

`Progress.stars` still only ever rises, and `Incentives.purchases` records what
went out. `starBalance` subtracts one from the other.

Storing a mutable balance instead would make the history unreconcilable and
would mean a child's effort could be taken away by a write. Deriving it means
the ledger always adds up, and the shop and the map cannot disagree about what
is affordable — both read the same `ShopView`.

The map's counter shows the balance rather than the lifetime total. It has to be
the number a child compares against a price, or the shop refuses a coupon the
map said they could afford.

### Buying is redeeming

One entry, one moment. There is no basket, no pending state, and no "mark as
used" step: a coupon a child holds but has not spent is a thing an adult has to
remember, and the history is the reminder.

### A purchase snapshots the coupon it bought

`Purchase` copies `label` and `cost` rather than looking them up through
`couponId`. Adults re-price and delete coupons; what a child spent their stars
on last Tuesday is a fact about last Tuesday. The id is kept so an entry can
still be traced to a coupon that still exists.

This is what makes delete safe: taking a coupon off the shelf leaves every
purchase of it readable, and re-pricing one never rewrites the history.

### Coupons stay on the shelf after they are bought

A coupon is a standing offer, not stock. Another twelve letriestrellas buys
another half hour of football.

### A price is validated in one place

`checkCouponDraft` in `packages/domain` decides what a label and a cost may be,
and returns a problem rather than throwing — the caller is a form, and an adult
mid-sentence needs to be told what to fix.

The cost field is deliberately `type="text"` with a numeric keypad rather than
`type="number"`. A number input runs its own constraint validation first and
blocks submit with an untranslated browser bubble, which puts a second rulebook
in front of the one that decides. The test that caught this is the reason it is
written down.

### The adult area is not gated yet

The menu is open. Everything reachable from it is recoverable by the adult who
wrote it, and deleting asks a second, differently-worded time. A PIN belongs
with real accounts, not with a coupon list on one device.

### The shop's entrance is in the child's reach band

The map's other two corners are a readout and adult chrome, high on the screen.
The way into the shop is the one control on that screen a child is meant to
press, so it is low and on the left — a child of three cannot touch the top of
an 86-inch panel. An end-to-end test asserts it, in all three viewport
projects.

## Rejected alternatives

**Spending from the lifetime total directly.** One number instead of two, and it
makes the counter go down after a purchase — the thing the map's total was
explicitly designed not to do — while leaving no way to reconcile a history
against it.

**Looking history entries up by `couponId`.** Normalised, and wrong: it makes an
adult's edit rewrite a child's past, and a delete erase it.

**Purchased-then-redeemed, with an adult marking it used.** More faithful to how
a coupon works on paper, and it adds a second state an adult has to maintain for
a reward whose whole point is that it happens away from the app.

**Removing a coupon once bought.** Treats a promise as stock. It also makes the
shelf empty itself, which is the state the shop deliberately hides.

## Consequences

- `Coupon`, `Purchase`, and `checkCouponDraft` live in `packages/domain`; the
  ledger and the shop view live in `apps/player-web/src/world/`, beside the
  progression they price against.
- `LocalIncentiveStore` is async and owner-keyed like `LocalProgressStore`, so
  moving a group's coupons to Firestore changes no caller. `owner` becomes the
  group id.
- Ids are minted from a counter behind the clock, not `crypto.randomUUID` — the
  classroom panel may be an old vendor Chromium over plain HTTP, where it is
  absent. Firestore mints its own when this moves.
- A stored coupon list is untrusted client state, read on the same terms as
  stored progress: a malformed entry is dropped rather than thrown.

## Revisit when

- Accounts exist. The coupon list becomes per-group, the menu gets a real adult
  boundary, and Rules take over from "the form is the only writer".
- Adults want to see *which child* bought what, which needs per-child profiles
  rather than the single implicit local owner.
