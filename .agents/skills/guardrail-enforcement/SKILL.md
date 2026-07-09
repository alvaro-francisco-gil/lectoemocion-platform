---
name: guardrail-enforcement
description: Use when adding or changing any check that gates a Firebase write, media access, lifecycle transition, ownership decision, cross-document operation, or privileged Cloud Function.
---

# Guardrail Enforcement

UI checks improve experience. Services provide consistent client behaviour.
Only Rules and trusted Functions defend against hostile clients.

## Place every check

| Condition | Required trust layer |
|---|---|
| Creator owns one document; allowed fields are local | Firestore or Storage Rules |
| Exact document shape or immutable field | Rules plus runtime schema |
| Friendly eligibility/precondition error | Typed service, mirrored at trust layer |
| Cross-user write or role/permission grant | Callable Function |
| Predicate needs cross-document reads | Callable Function |
| Atomic write spans security boundaries | Callable Function transaction |
| Derived data or cleanup fan-out | Idempotent Function/queued saga |
| Button visibility or confirmation | UI only, never authorization |

When uncertain, identify what a hostile client can bypass. Put the authoritative
predicate above that boundary.

## Identity

- Derive the actor from verified Firebase Authentication context.
- Never trust `teacherId`, `ownerId`, or acting UID from request data.
- Load ownership and lifecycle state server-side.
- Children never have authentication identities.

## Callable pattern

For privileged operations:

1. Deny or narrowly restrict the equivalent direct client write in Rules.
2. Runtime-validate callable input.
3. Require authenticated teacher context.
4. Read authoritative ownership and state.
5. Use a transaction when the decision depends on the data being changed.
6. Make event handlers, retries, and cleanup idempotent.
7. Return typed, stable error codes; do not swallow them in the client service.
8. Log operation type and opaque IDs only—never names, media URLs, tokens,
   recordings, photos, or raw manifests.
9. Expose the callable through `packages/firebase`, not directly from UI.

Use Functions v2 in `europe-southwest1`.

## Immediate revocation

For deletion or access withdrawal, the first atomic operation writes an
authoritative non-readable lifecycle state or revocation tombstone. Every
manifest issuance, resource load, media authorization, and playback lease must
check it and fail closed. Cleanup may continue as an idempotent saga.

Do not claim immediate revocation while long-lived signed URLs or offline
packages remain usable. Storage Rules cannot revoke an already issued signed
URL. Use short-lived access, a revocation-checking gateway, immediate object
removal, or an explicitly documented offline expiry policy.

## RED-first verification

Test:

- unauthenticated and wrong-teacher denial;
- owner success;
- caller-supplied identity ignored or rejected;
- forbidden fields and lifecycle transitions denied directly;
- duplicate and concurrent requests;
- partial failure and retry;
- create/update racing with deletion;
- Rules, service, Function, and Storage boundaries through emulators;
- immediate denial while asynchronous cleanup is paused;
- absence of personal data in logs and errors.

## Stop conditions

- Never call browser service validation “server-side.”
- Never rely on a hidden or disabled control.
- Never use Admin SDK without reconstructing authorization.
- Never add a Function only for convenience when Rules express the predicate.
- Never deploy Rules or Functions without explicit authorization.
