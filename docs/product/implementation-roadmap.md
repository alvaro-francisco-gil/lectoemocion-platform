# Implementation roadmap

The platform will be delivered through independently testable plans. Later
plans may refine technology details, but they must preserve the approved domain
and privacy boundaries in
[platform-design.md](platform-design.md).

Runtime, distribution, and animation authoring are decided in
[ADR 0003](../decisions/0003-runtime-and-animation.md), contingent on the
classroom-panel verification in stage 2.

## 1. Foundation and synthetic player

Detailed plan:
[foundation-and-synthetic-player.md](../plans/ongoing/foundation-and-synthetic-player.md)

Status: implemented and verified.

Create the TypeScript monorepo, versioned resource schema, template contract,
deterministic roster selection, and a Phaser web player. Demonstrate one
animated story and one interactive initials game using synthetic records only.

Exit condition: a browser can switch between both resources and play them with
touch or mouse at phone and classroom-display sizes.

This stage predates the story-world model. It validated the manifest and
template boundaries, which remain valid. It does not implement progression, the
map, or default content.

## 2. Classroom-panel verification

[ADR 0003](../decisions/0003-runtime-and-animation.md) places a web player on
the classroom display. That is the decision's one material risk, and it is
cheap to test.

Build a capability probe page and open it on a real interactive panel. It must
report user agent and browser engine version, WebGL support and version,
available memory, `devicePixelRatio` and reported resolution, simultaneous
touch points, and whether audio unlocks after a first tap. Record the panel
model and firmware version alongside the results.

The first target is a TTL-branded panel, whose model and firmware are not yet
available. Run the same probe through the connected-computer path as well, so
both routes are characterised.

Exit condition: either the panel browser is confirmed adequate, or the
connected-computer fallback is confirmed as the supported path, and ADR 0003 is
annotated with the measurement.

This stage does not block stage 3.

## 3. World, progression, and default content

Model personalisation slots so a slot and its default content are a single
type. "Slot without a default" must fail compilation, not review.


Add the map hub, progression state, resource kinds, and product-authored
default content so the world is playable end to end with no uploads.

Exit condition: an adult can open the world, play a story chapter, unlock a
minigame, replay it, and reach a non-interactive resource — using default
content only, with progress persisting across sessions.

## 4. Private backend and authentication

Add adult accounts, owner-only authorisation, groups, child records, progress
persistence, resource persistence, audit events, and tenant-isolation tests.
Configure Firebase Authentication, Cloud Firestore in Madrid, typed service
boundaries, Security Rules, and emulator-backed access tests.

Tenancy follows Account → Group → child records; no layer may assume a group is
a school class.

Exit condition: one account cannot read or modify another account's data, and
all access paths are covered by authorization tests.

## 5. Mobile personalisation

Add the teacher and parent mobile application: group creation, photo capture,
audio recording, initial-letter/sound confirmation, resilient uploads, and
review.

Exit condition: iOS and Android development builds can populate a group using
synthetic or consenting-adult test data.

## 6. Private media pipeline and personalised playback

Add signed uploads, media validation, metadata handling, thumbnails,
short-lived playback URLs, retention jobs, and complete deletion workflows.
Bind uploaded media into template personalisation slots, with default-content
fallback when personalised media is missing or deleted.

Store private media in Cloud Storage in Madrid and perform privileged lifecycle
operations through second-generation Cloud Functions in Madrid.

Exit condition: personalised content replaces defaults in a compatible game,
and deleting a child record immediately revokes access, falls back to default
content, and eventually removes all associated objects and derived files.

## 7. Authenticated playback surfaces

Connect the player to authentication, progress, and the account's
personalisation. Add QR pairing from the phone, full-screen playback, and
session expiry handling.

Exit condition: an adult can sign into a classroom display or tablet, see the
same world and progress, and play from the map.

## 8. Device certification and resilience

Test representative SMART, Promethean, and ViewSonic displays plus target
tablets. Establish the support matrix, performance budgets, reach-zone layout
verification, weak-network recovery, and optional resource caching.

Exit condition: supported devices meet startup, input, audio, layout, reach,
and recovery requirements.

## 9. Institutional pilot readiness

The institutional market is approached first. It carries the heavier
obligations, so the pilot is staged.

**9a. Default-content pilot.** Real teachers and real classrooms play the world
using product-authored default content only. No uploads, no child media, no
personal data beyond the adult account. This requires no Article 28 agreement
and can begin as soon as stage 3 and stage 7 are complete.

**9b. Personalisation readiness.** Article 28 data-processing agreements,
record of processing, subprocessor register, retention schedule, transfer
assessment, technical and organisational measures, incident plan, data-subject
request procedure, DPIA screening, Spanish transparency notices for teachers
and parents, and school approval.

Personalisation is enabled per deployment only once that deployment's artefacts
are complete. Real child media is prohibited before then.

## 10. Family market

Direct-to-family sale: parental consent and notice, Spanish transparency
materials, deletion and data-subject request handling, WooCommerce integration,
support and incident response. The parent is the controller; no Article 28
chain applies.

Sequenced after the institutional pilot. The domain model already supports it
via Account → Group, so no rework is expected.
