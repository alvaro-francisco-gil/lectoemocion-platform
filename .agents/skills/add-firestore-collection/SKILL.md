---
name: add-firestore-collection
description: Use when a feature introduces a new Firestore collection or subcollection, a new persisted entity, or a new private Storage path tied to Firestore ownership.
---

# Add a Firestore Collection

A collection is one vertical contract. Land its model, converters, refs,
service, authorization, lifecycle, discovery, and tests together.

## Choose the path

Nest data when one parent genuinely owns its lifecycle and cross-parent queries
are not required. Use top-level collections only when cross-parent queries are a
real product requirement.

For child data, default to:

```text
teachers/{teacherId}/classes/{classId}/childRecords/{childRecordId}
```

The path is authoritative ownership. Do not duplicate `teacherId` or `classId`
inside a child document without a documented query requirement.

## Required artifacts

Create or update all applicable artifacts in one change:

1. Runtime schema and derived TypeScript type in `packages/domain/`.
2. Client and Admin converters in `packages/firebase/src/converters/`.
3. Client and Admin ref factories in `packages/firebase/src/refs/`.
4. Typed operations in `packages/firebase/src/services/`.
5. Package exports and `packages/firebase/src/services/_services-map.md`.
6. `firestore.rules` with ownership and exact-shape predicates.
7. `storage.rules` when the entity owns media.
8. `firestore.indexes.json` for actual composite query shapes.
9. Domain, converter, service, Firestore Rules, and Storage Rules tests.
10. Idempotent Function plus tests for privileged or cascading lifecycle work.
11. Explicit deletion, retention, and dependent-resource behaviour.

Use `touch-firebase-service` for service details.

## Schema and rules

- Reject unknown fields and missing required fields.
- Validate critical types, bounded strings, enums, timestamps, and immutable
  fields in both runtime schema and Rules.
- Derive acting identity from authentication, never request data.
- Verify parent ownership for nested documents.
- Deny cross-teacher get, list, create, update, and delete.
- Allow only named mutable fields on update.
- Fail closed on malformed stored records.

Converters do not replace Rules: console, scripts, stale clients, and hostile
clients can bypass converters.

## Media and deletion

If deletion touches media or dependent playable resources, deny direct client
delete. Use an idempotent Function that:

1. authenticates and verifies ownership;
2. transitions the record to a non-readable deleting state;
3. invalidates dependent resources before returning success;
4. removes original and derived Storage objects;
5. removes the record or leaves only an approved non-PII tombstone;
6. safely resumes after partial failure.

Firestore does not cascade subcollections. Parent deletion must explicitly
invoke child teardown.

## RED-first test matrix

- Valid synthetic shape accepted; extra, missing, or mistyped fields rejected.
- Unauthenticated access denied.
- Owner operations allowed exactly as designed.
- Another teacher denied every operation, including guessed IDs and queries.
- Missing or foreign parent denied.
- Ownership, immutable fields, and lifecycle state cannot be spoofed.
- Storage access follows active Firestore ownership and is revoked immediately
  on deletion.
- Cleanup is idempotent and survives partial failure.
- No test, fixture, log, screenshot, or error contains real child data.

## Completion gate

Run targeted unit tests, Firestore and Storage emulator tests, typecheck,
affected builds, and raw-Firebase-import checks. If Rules, indexes, Functions,
or Storage configuration changed, record the required deployment; never deploy
without explicit authorization.
