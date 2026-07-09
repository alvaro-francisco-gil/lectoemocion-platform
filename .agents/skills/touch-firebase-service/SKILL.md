---
name: touch-firebase-service
description: Use when adding, changing, moving, or removing a Firebase query, mutation, listener, converter, or typed service export in packages/firebase or when moving a client write to Cloud Functions.
---

# Touch a Firebase Service

The service layer owns client Firebase access. Preserve one typed, testable path
from domain model to converter to ref factory to service.

## Before changing code

1. Read `AGENTS.md`, the active plan, and
   `packages/firebase/src/services/_services-map.md`.
2. Search every caller and export:

   ```bash
   rg -n "serviceFunction|ServiceName" apps packages functions
   ```

3. Change the authoritative model/runtime schema in `packages/domain/` first.
   Do not define boundary shapes inline.

## Place the change

- Converter: `packages/firebase/src/converters/`
- Raw client ref factory: `packages/firebase/src/refs/client.ts`
- Raw admin ref factory: `packages/firebase/src/refs/admin.ts`
- Client operation: `packages/firebase/src/services/<domain>Service.ts`
- Privileged or cross-user operation: `functions/src/`, exposed through a typed
  client service wrapper

Raw `collection()`, `doc()`, or admin path strings belong only in ref factories.
UI, hooks, Phaser scenes, templates, and domain packages never import Firebase.

## Choose the trust layer

- Creator-owned single-document query/write: client service plus Security Rules.
- Cross-user write, role grant, multi-document security boundary, or predicate
  Rules cannot express: callable Function.
- Event-triggered derived data: idempotent Function.

Derive identity from the authenticated context. Never accept the acting
teacher's UID as a trusted input.

## Service rules

- Explicit input and return types on every export.
- Runtime-validate Firestore reads through the converter.
- Fail closed on malformed records, missing auth, and denied access.
- Validate business preconditions before network I/O for consistent UX; Rules
  or Functions remain the trust boundary.
- A subscription returns its unsubscribe function.
- Never log names, child records, media URLs, tokens, or raw manifests.
- No catch-and-return-empty fallback for Firebase failures.

## Complete the change

In the same change:

1. Add RED-first service tests under `packages/firebase/test/services/`.
2. Add or update emulator-backed Firestore/Storage Rules tests.
3. Update Rules when access, allowed fields, or shape changes.
4. Review `firestore.indexes.json` for every new filter/order combination.
5. Update `_services-map.md` when exports, ownership, or cross-service edges
   change.
6. Run the direct-Firebase-import boundary check once that script exists.
7. Run targeted tests, emulator tests, typecheck, and affected builds.

## Stop conditions

- Do not bypass a service because a UI change looks small.
- Do not loosen a schema to tolerate unaudited data.
- Do not add a Function when Rules safely express the operation.
- Do not ship Rules or index changes without recording the required deployment.
- Do not change an export before identifying all callers.
