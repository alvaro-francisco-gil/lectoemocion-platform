# ADR 0002: Use Firebase for the initial backend

Date: 2026-07-09  
Status: Accepted for planning

## Context

LectoEmoción needs authentication, private structured data, private media,
privileged server operations, browser delivery, and local integration testing.
The product is pre-market-fit and should minimize bespoke infrastructure while
keeping privacy and authorization boundaries explicit.

## Decision

Use:

- Firebase Authentication for adult teacher accounts only;
- Cloud Firestore in `europe-southwest1` for application records;
- Cloud Storage in `europe-southwest1` for private photos and audio;
- Cloud Functions v2 in `europe-southwest1` for privileged operations;
- Firebase Hosting for static web-player assets;
- Firebase Local Emulator Suite for integration and Security Rules tests.

Children do not receive authentication accounts. Analytics, Crashlytics,
advertising identifiers, and unnecessary telemetry remain disabled initially.

Firebase SDK usage is isolated behind typed services. UI, hooks, Phaser scenes,
and templates do not import Firebase SDK modules directly.

## Privacy consequence

Firebase Authentication is US-hosted. Only adult teacher authentication data
may enter that service. The transfer assessment, subprocessor documentation,
and controller approval must cover it before a pilot. Child names, photos,
recordings, and playable resources stay in explicitly selected European
Firestore and Storage locations.

## Rejected alternative

A bespoke PostgreSQL API with S3-compatible storage provides greater provider
control but adds authentication, authorization, upload, deployment, backup,
and operational work before market fit. It remains a migration option if
procurement, residency, query, cost, or portability requirements outgrow
Firebase.

## What this binds

- Backend implementation plans and repository structure.
- Security Rules and emulator tests for every sensitive collection and path.
- Region declarations for Firestore, Storage, and Functions.
- Repository skills covering services, guardrails, collections, deployment,
  and privacy-sensitive changes.

## Revisit when

- A target controller rejects US processing of adult authentication data.
- Required queries or transactions do not fit Firestore safely.
- Cost projections materially exceed the bespoke-backend alternative.
- A procurement requirement mandates another cloud or database.

