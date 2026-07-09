# Implementation roadmap

The platform will be delivered through independently testable plans. Later
plans may refine technology details, but they must preserve the approved domain
and privacy boundaries.

## 1. Foundation and synthetic player

Create the TypeScript monorepo, versioned resource schema, template contract,
deterministic roster selection, and a Phaser web player. Demonstrate one
animated story and one interactive initials game using synthetic records only.

Exit condition: a browser can switch between both resources and play them with
touch or mouse at phone and classroom-display sizes.

## 2. Private backend and authentication

Add teacher accounts, creator-only authorization, classes, child records,
resource persistence, audit events, and tenant-isolation tests. Configure
PostgreSQL and EU-region object storage abstractions.

Exit condition: one teacher cannot read or modify another teacher's data, and
all access paths are covered by authorization tests.

## 3. Mobile roster creation

Add the Expo/React Native teacher application with class creation, photo
capture, audio recording, initial-letter/sound confirmation, resilient uploads,
and roster review.

Exit condition: iOS and Android development builds can create a class using
synthetic or consenting-adult test data.

## 4. Private media pipeline

Add signed uploads, media validation, metadata handling, thumbnails, short-lived
playback URLs, retention jobs, and complete deletion workflows.

Exit condition: deleting a child record immediately revokes access and
eventually removes all associated objects and derived files.

## 5. Authenticated classroom library

Connect the web player to teacher authentication, resource manifests, and the
creator's library. Add full-screen playback, session expiry handling, and
optional short-code pairing.

Exit condition: a teacher can sign into a classroom display and change
resources without using the phone.

## 6. Device certification and offline resilience

Test representative SMART, Promethean, and ViewSonic displays. Establish the
support matrix, performance budgets, weak-network recovery, and optional
resource-package caching.

Exit condition: supported devices meet startup, input, audio, layout, and
recovery requirements.

## 7. Pilot readiness

Complete operational security controls, Article 28 materials, subprocessor
register, retention schedule, DPIA screening, transparency notices, incident
response, support-access controls, and production deployment.

Exit condition: the controller and its Data Protection Officer approve a pilot.
Real child data is prohibited before this milestone.

