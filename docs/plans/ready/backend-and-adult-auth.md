# Backend and adult authentication

The first of four slices that together give the product accounts, child records
kept on the phone and the web, uploaded photos and recordings, and a QR that
signs a browser in from a phone. This document specifies slice A and nothing
else.

## The four slices

- **A — backend foundation and adult auth.** `packages/firebase`, Firebase
  Auth, `Account` and `Group`, Rules, emulator tests. Auth on the web and in
  the Expo shell. No children, no media. This document.
- **B — child records, account-backed.** Supersedes the local-profiles plan.
  Name, avatar, verified initial. No media, so no privacy artefacts, so usable
  in the institutional pilot. Progress moves to the account.
- **C — media capture and upload.** Camera, microphone, and gallery on the
  phone; file picker on the web. Photo and pronunciation recording override the
  avatar and the default audio slot by slot.
- **D — QR web sign-in.** The browser shows a code, the signed-in phone
  approves it, the browser gets a session. Already specified as a workflow in
  `docs/product/platform-design.md` §5.3.

A blocks everything. B and D can then run in parallel. C needs B.

## Goal

An adult can create an account and sign in, on the phone and in the browser,
with Google, Apple, or an email and a password. A child can play before, during
and after all of that, including on a device that has never had a network
connection.

## Decisions this records

### Play is never blocked on identity

Every device signs in anonymously on first launch, and the anonymous uid is
upgraded in place when an adult supplies a credential. Firebase links the
credential to the existing uid, so the account id the device has been carrying
does not change and nothing is migrated.

Anonymous sign-in is a network call, and `docs/decisions/0009-one-hosted-player.md`
makes offline launch a release criterion. So a device that cannot reach the
network **plays anyway**, against the local progress key that already exists,
and mints its uid on the first successful reconnect. The failure mode this
avoids is a class that cannot play because the school's Wi-Fi is down, which is
the failure most likely to end a pilot.

### An anonymous uid does not create an account document

The uid exists in Firebase Authentication. The `Account` document is written on
first adult sign-in and not before.

The alternative — a document per device — buys nothing and costs a Firestore
document, a Rules surface, and a retention obligation for every tablet anyone
ever opened, most of which never meet an adult. The uid's one real job is to
survive the credential link so that progress needs no copy step, and it does
that job without a document.

### There is one account type

An account is not labelled family or institutional. The legal distinction
between a parent uploading their own child's photo and a teacher uploading
twenty-five other people's children is real, but it is carried by contracts and
notices rather than by a field.

What the product does carry is a **personalisation capability** on the account,
off by default, not writable by any client, and read by Rules rather than only
by user interface. That is the whole of what
`docs/privacy/spain-eu-baseline.md` requires of the product: personalisation is
enabled for a deployment only once that deployment's artefacts are complete.

### Sign-in providers

Google, Apple, and email with a password. Apple is not optional on iOS once any
other social provider is offered.

The consequence is that this slice takes the Expo shell off Expo Go and onto an
EAS development build: `expo-auth-session` and `expo-apple-authentication` are
not in Expo Go's bundled set. `docs/plans/ongoing/native-shell.md` records "no
EAS account, no store credentials, no Xcode" as a property of step 1, and that
property ends here. It is recorded as a cost, accepted deliberately.

## The session

A discriminated union in `packages/domain`, so no screen can handle two of the
three states and compile.

```ts
export type Session =
  | { readonly kind: "local" }
  | { readonly kind: "device"; readonly accountId: AccountId }
  | { readonly kind: "adult"; readonly accountId: AccountId; readonly email: string };
```

`local` is the offline first launch. `device` is an anonymous uid. `adult` is a
linked credential. Every render site ends its switch with `assertNever`, so
adding a fourth state breaks compilation everywhere it must be handled.

## The records

```ts
interface Account {
  readonly id: AccountId;            // the Firebase uid
  readonly createdAt: string;        // ISO 8601, UTC
  readonly personalisation: PersonalisationState;
}

type PersonalisationState =
  | { readonly enabled: false }
  | { readonly enabled: true; readonly enabledAt: string };

interface Group {
  readonly id: GroupId;
  readonly accountId: AccountId;
  readonly name: string;
}
```

`createdAt` and `enabledAt` are ISO strings rather than a Firestore
`Timestamp`, because these records live in `packages/domain` and
`scripts/check-firebase-boundary.mjs` forbids a Firebase type there. The
converter in `packages/firebase` translates at the boundary, which is what a
converter is for.

`PersonalisationState` is a union rather than a boolean with an optional date
so that "enabled, but nobody recorded when" cannot be expressed. When the
question is later asked — under what authority was this switched on — the
record either answers it or is not in the enabled state.

`ChildRecord` and `MediaAsset` are slice B and C. `PlayerProfile`, which
already exists in `packages/domain`, is left alone here and reconciled with
`ChildRecord` in slice B.

## Where the code lives

```text
packages/firebase/          the only place the Firebase SDK is imported
  src/app.ts                initialisation; europe-southwest1
  src/auth/                 provider calls, link-in-place, session mapping
  src/converters/           Firestore converters, validating on read
  src/services/             accountService, groupService
  src/emulator/             the Rules test harness

packages/auth-core/         platform-free: the session state machine, sign-in
                            orchestration, error classification.
                            No React, no React Native, no DOM.

apps/player-web/src/auth/   React screens, thin
apps/mobile/src/auth/       React Native screens, thin
```

`packages/auth-core` is the load-bearing package, and it exists because
`docs/decisions/0003-runtime-and-animation.md` permits duplicating the adult
*view* layer and nothing else. Which provider was chosen, what happens when a
credential already belongs to another account, and how a failure becomes
something an adult can act on are all decisions, and a decision that exists
twice diverges. If a rule ends up in a screen, it is in the wrong file.

`scripts/check-firebase-boundary.mjs` gains `packages/firebase/` in its
allowlist. Nothing else may import the SDK, the new screens included.

`apps/mobile` acquires its first workspace dependencies here, so Metro resolves
pnpm's symlinked packages for the first time. `metro.config.js` already watches
the repository root and already has `disableHierarchicalLookup` off, which is
the configuration that makes this work; this slice is the first thing that
proves it.

## Flows, and where they break

**Cold start.** Ask Firebase for a session. A cached uid resolves to `device` or
`adult` with no network. No cached uid attempts anonymous sign-in; success is
`device`, failure is `local`, and the world opens either way. The player mounts
on the first tick and the session resolves underneath it.

**Sign-in.** From `device`, link the credential to the anonymous uid in place:
the same uid, now with an adult identity. From `local`, sign in normally; the
uid is new, and local progress is adopted regardless because adoption keys off
the device's progress key rather than off the uid.

**Linking against a credential already in use.** A parent who set up the tablet
at home signs in on a second device that has accumulated its own anonymous
progress. Firebase returns `credential-already-in-use`: two progress histories,
one adult. Choosing one silently destroys the other, which invariant 6 forbids.
So this slice signs in to the existing account, **keeps the orphaned progress
under its own key**, and surfaces it as a decision for the adult. The wording of
that decision and the merge behind it belong to slice B, where child records
make "whose progress is this?" a question with an answer. Slice A's only
obligation is that nothing is destroyed.

**Sign-out** returns to `local`, not to a fresh anonymous session.
Account-backed progress leaves with the account; local progress on that device
stays where it is.

**Failures** are classified in `packages/auth-core` into a closed union —
`network`, `cancelled`, `credential-in-use`, `invalid-credentials`, `blocked`,
`unknown` — with `assertNever` at the render site, so a new case cannot fall
through to a generic message. Each maps to Spanish adult-facing copy that says
what to do next.

Raw Firebase error objects never reach a screen and never reach a log: they can
carry the email address that caused them. This is a new invariant, so it gets
its rule in `scripts/rules.mjs` and its test in `scripts/rules.test.ts` in the
same change, per the repository contract.

## Rules and the trust boundary

```text
/accounts/{accountId}                     accountId == request.auth.uid
/accounts/{accountId}/groups/{groupId}    inherits
```

Ownership is the document path, so no rule has to reason about a field to
decide access, and a cross-account read is impossible by construction rather
than by predicate.

Three rules beyond that:

- **Anonymous uids write nothing.** `request.auth.token.firebase.sign_in_provider`
  must not be `anonymous` on any write. An anonymous session is a play token,
  which is consistent with it having no account document.
- **`personalisation` is never client-writable**, on create or update, in any
  state. It is the privacy gate; a gate a client can open is not one.
- **`Account.id` and `Group.accountId` are immutable after create**, so a
  document cannot be reparented into another tenant.

Firestore and Functions are `europe-southwest1`. Firebase Authentication is
US-hosted and cannot be regioned; `docs/product/platform-design.md` §7 already
documents that and why adult-only data makes it acceptable. Nothing new is
decided here, but the transfer note it references must exist before a real
adult signs up, and today it does not.

## What this slice must not preclude

Slice D shows a QR in the browser and has the phone approve it. Two things
would be expensive to retrofit, so they are constrained now:

- The sign-in screen is a **list of methods**, not a form with extras. Adding
  *escanear con el móvil* must be an entry in a list, not a restructure.
- `auth-core` accepts a **custom token** path from the start, though nothing
  produces one yet. QR sign-in works by a Function minting a custom token for
  the browser once the phone approves; an `auth-core` that only knows provider
  credentials would have to be rewritten. The path exists and is typed, and has
  no producer until slice D.

No Cloud Function is written in this slice.

## Tests

Written before the code they describe.

Unit, in `packages/auth-core`, with fakes at the interface and no Firebase:

- the session machine across all three states, including `local → device` on
  reconnect;
- link-in-place yields the same account id;
- `credential-already-in-use` preserves both progress keys and destroys
  neither — the regression that matters most, because the failure is silent and
  costs a family their stars;
- every Firebase error code maps to a classified case, and an unrecognised code
  maps to `unknown` rather than throwing;
- sign-out returns to `local` rather than to a new anonymous session.

Emulator, in `packages/firebase`:

- cross-account read and write denied;
- an anonymous uid denied every write;
- `personalisation` unwritable by a client, on create and on update;
- `accountId` not reparentable;
- converters reject a malformed document rather than defaulting it.

Each denial is paired with a test proving the legitimate write still succeeds.
A rule tested only on its happy path can be accidentally inverted.

Component, in each app: the three session states render their own screens; a
network failure at launch shows the world rather than an error; a sign-in
failure shows Spanish copy and leaves the player reachable.

Guardrail: the new privacy rule for auth error payloads, with the
`scripts/rules.test.ts` case proving it flags a real violation and accepts
legitimate code.

Then `pnpm check`, and `pnpm test:e2e`, because the player's mount path changes.

## Documents this change rewrites

- `docs/plans/ready/child-profiles.md` — superseded, rewritten as slice B
  rather than left contradicting reality.
- `docs/product/platform-design.md` — §5.1 no longer opens with creating an
  account; §6.2's link to `docs/plans/ongoing/child-profiles.md` is already
  broken and is fixed here.
- `docs/plans/ongoing/native-shell.md` — the "no workspace dependency"
  property and the Expo Go assumption both end; open question 2 is affected.
- `AGENTS.md` — `packages/auth-core/` joins the planned architecture.
- A new ADR recording the identity model: anonymous-first, local fallback, no
  account document before an adult exists, one account type with a
  personalisation capability.

## Not in scope

Child records, media, upload, camera, microphone, consent capture, the QR
handshake, progress synchronisation to Firestore, group management beyond
create-and-name, billing, and any Cloud Function. Progress stays local in this
slice; moving it to the account is slice B, and doing it here would mean
designing the merge before child records exist to make it answerable.
