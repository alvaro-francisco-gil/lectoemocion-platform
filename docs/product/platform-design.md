# LectoEmoción Platform Design

Date: 2026-07-09  
Status: Approved product design

## 1. Product vision

LectoEmoción helps Spanish teachers create personalised early-literacy
experiences for children aged 3–5.

A teacher records a class roster. Each child record contains:

- first name;
- recognisable photo;
- an audio recording of how the name sounds;
- the initial written letter and intended sound, verified by the teacher.

The system places this content into predefined animated stories and educational
games. A template determines which children participate, how they are selected,
where their content appears, and what happens during playback. Some templates
may use the entire class; others may select a subset or rotate children.

The platform does not use AI to generate stories, animations, game mechanics,
images, voices, or text. "Generation" means deterministic assembly of teacher
content into product-authored templates.

## 2. Product boundaries

### Included

- Native-feeling creation workflow on iOS and Android.
- Private class rosters with multiple children.
- Upload of unchanged photos and audio recordings.
- Teacher verification of each child's initial letter/sound.
- A catalogue of predefined animated stories and interactive games.
- Preview before classroom use.
- Authenticated playback on interactive classroom displays.
- Touch, stylus, and mouse input.
- Responsive playback on classroom displays, desktop browsers, tablets, and
  phones.
- A design that permits offline caching later.

### Excluded from the first product

- AI-generated content.
- Facial recognition or biometric classification.
- Background removal or generative transformation of children's photos.
- Voice cloning or transcription.
- Public or unlisted-link sharing.
- Parent and child accounts.
- A free-form timeline or game editor for teachers.
- Teacher-authored executable logic.
- Full 3D worlds.
- A native application installed directly on every classroom display.

## 3. Primary workflows

### 3.1 Create a class

1. The teacher signs into the mobile application.
2. The teacher creates a class.
3. For each child, the teacher enters a first name, takes or chooses a photo,
   records the name, and confirms the initial letter/sound.
4. The application uploads media to private EU-hosted storage.
5. The teacher reviews the roster.

### 3.2 Create a playable resource

1. The teacher selects a story or game from the compatible template catalogue.
2. The template declares whether it needs the whole class, a fixed-size subset,
   a letter-based subset, or a rotating selection.
3. The backend validates the roster against the template requirements.
4. The backend creates a versioned resource manifest containing references to
   roster records and template parameters.
5. The teacher previews and saves the resource.

### 3.3 Play in class

1. The teacher opens LectoEmoción directly on the classroom display.
2. The teacher authenticates or uses a short-lived pairing flow.
3. The classroom library shows resources belonging to that teacher.
4. The teacher launches and changes resources on the display without depending
   on the mobile device.
5. The web player loads the manifest and short-lived media URLs, then runs the
   story or game full-screen.

A private deep link may open a specific resource, and phone-to-board pairing may
be added as a convenience. Neither is the primary playback workflow.

## 4. Architecture

LectoEmoción will use a TypeScript monorepo with these initial boundaries:

```text
apps/
  teacher-mobile/       Expo and React Native creation application
  player-web/           React application shell and Phaser player

functions/              Firebase Functions v2 for privileged operations

packages/
  domain/               Domain types and policies
  resource-schema/      Versioned manifest schemas and validators
  template-sdk/         Stable API used by story/game templates
  template-catalog/     Product-authored templates
  firebase/             Typed converters, service boundaries, and clients
  shared-config/        Shared TypeScript and tooling configuration
```

The teacher application and player are separate modules even if mobile playback
is initially embedded in the teacher application. This preserves the option to
ship a separate child-facing player later without exposing teacher controls.

### 4.1 Mobile creation

Expo and React Native provide one iOS/Android codebase for authentication,
camera, microphone, roster management, upload progress, and previews. The
mobile application must not contain the authoritative game implementation.

### 4.2 Universal player

Phaser is the initial rendering and interaction engine. It runs:

- in classroom-display browsers;
- in desktop browsers;
- in a mobile web view or browser when mobile playback is required.

The player supports animated stories and interactive games through the same
runtime. It normalises touch, stylus, and mouse input. Playback must not require
an active connection to the teacher's phone.

### 4.3 Godot migration boundary

Phaser is an implementation choice, not part of the domain model. Resource
manifests describe semantic scenes, roster selections, media roles, timing, and
interactions. They must not expose Phaser classes, coordinates tied to one
canvas size, or executable JavaScript.

Godot should be reconsidered only if measured requirements exceed Phaser in
areas such as cinematic authoring, rendering performance, advanced shaders, or
game-production workflow. A future Godot player should be able to interpret the
same resource schema or an explicitly versioned successor.

## 5. Resource and template model

### 5.1 Domain records

- `Teacher`: authenticated creator and initial owner.
- `Class`: private roster belonging to a teacher.
- `ChildRecord`: first name, verified initial letter/sound, photo asset
  reference, audio asset reference, and lifecycle state.
- `MediaAsset`: private object-storage reference, media type, checksum,
  dimensions or duration, processing state, and retention metadata.
- `TemplateDefinition`: immutable version of a story or game.
- `PlayableResource`: template version plus roster references and validated
  parameters.

Deleting a child record must invalidate or update resources that reference it.
Resources should reference media rather than duplicate it.

### 5.2 Template contract

Each template declares:

- stable identifier and immutable version;
- learning objective and target age;
- whether it is an animated story or interactive game;
- roster-selection strategy and minimum/maximum participants;
- supported letters/sounds;
- required media and text roles;
- scene and interaction definitions;
- responsive layout rules and safe areas;
- completion and error behaviour;
- accessibility requirements;
- asset budgets and supported player capabilities.

Templates are authored and reviewed by the product team. Teachers supply
content but cannot modify mechanics, timelines, or executable behaviour.

### 5.3 Validation

Resource manifests use JSON Schema and are validated when created and when
loaded. The player rejects unknown schema versions, unrecognised template
versions, missing assets, and invalid participant counts with a recoverable
teacher-facing error.

## 6. Backend and media flow

The initial backend uses Firebase and provides:

- Firebase Authentication for adult teacher accounts only;
- Cloud Firestore for classes, child records, template metadata, and playable
  resource manifests;
- Cloud Storage for private photos and pronunciation recordings;
- Cloud Functions v2 for privileged operations and lifecycle jobs;
- class and child-record CRUD operations;
- direct-to-storage uploads using short-lived signed requests;
- media validation and metadata removal where technically appropriate;
- template compatibility and resource assembly;
- creator-only authorisation;
- short-lived playback manifests and media URLs;
- audit events, deletion, and retention jobs.

Firestore, Storage, and Functions must be provisioned explicitly in
`europe-southwest1` (Madrid) unless a later ADR changes the region. Static
player assets may use Firebase Hosting, but no child media may be published as
public hosting content. Uploaded files are never committed to the source
repository.

Firebase Authentication is US-hosted. It contains adult teacher account data
only; children never receive Firebase Authentication accounts. This
international transfer must be documented in the transfer assessment and
accepted by each controller before a pilot.

Client code accesses Firebase only through typed services. Security Rules are
mandatory but are not the sole business-rule layer: services validate
preconditions, Rules enforce client permissions, and Functions own privileged
or cross-document operations. Emulator-backed tests verify Firestore and
Storage access boundaries.

Offline playback is not an initial hard requirement. Resource manifests and
assets must nevertheless be packageable and cacheable so a later service-worker
or managed-download feature does not require redesigning templates.

## 7. Privacy and safeguarding baseline

Children's photos, names, voices, class membership, and derived resources are
personal data. The product cannot transfer sole responsibility to individual
teachers.

For institutional use, the school or relevant education authority will
typically act as controller, the company as processor, and the teacher under
the controller's authority. Exact roles and lawful basis must be confirmed for
each deployment with the controller and its Data Protection Officer.

The initial product enforces:

- creator-only access;
- private storage and short-lived media delivery;
- encryption in transit and at rest;
- EU-region hosting by default;
- documented subprocessors;
- explicit documentation that Firebase Authentication processes adult teacher
  account data in the United States;
- no public or unlisted-link access;
- no advertising or behavioural profiling;
- no use of customer media to train models;
- no biometric recognition, voice cloning, or generative transformation;
- configurable retention and complete deletion workflows;
- access logging and incident-response procedures;
- data-processing agreements compliant with GDPR Article 28;
- school-facing and parent-facing transparency materials;
- a documented DPIA screening before pilots.

The school determines and documents the lawful basis. Product design must not
assume that a teacher checkbox can manufacture valid consent or absolve the
company of processor obligations.

## 8. Classroom-display compatibility

Interactive classroom displays are heterogeneous. Modern devices may have
built-in Android, optional Windows or ChromeOS modules, or an externally
connected computer. The default distribution mechanism is therefore a
standards-based authenticated web application, not a Windows-only or
Android-only board application.

The player will define and test a browser/device support matrix. Early testing
must include representative SMART, Promethean, and ViewSonic displays where
available, covering:

- startup and asset-loading time;
- WebGL/canvas support;
- single- and multi-touch behaviour;
- stylus and mouse fallback;
- 16:9 4K scaling and safe areas;
- audio unlock after user interaction;
- full-screen behaviour;
- weak-network recovery.

## 9. Error handling

- Interrupted uploads resume or restart without producing child records that
  appear complete.
- Invalid media receives a clear corrective message and is not made playable.
- Missing or deleted roster members prevent unsafe partial playback unless the
  template explicitly permits replacement.
- Unsupported templates and schema versions fail closed.
- Expired sessions return to authentication without exposing cached roster
  information.
- Playback preloads required assets and presents a teacher-facing retry screen
  before children see a broken scene.
- Client logs must not contain names, media URLs, recordings, photos, or
  authentication tokens.

## 10. Testing strategy

- Unit tests for domain policies, participant selection, initial-letter
  normalisation, and template compatibility.
- Schema contract tests shared by API and player.
- Component tests for roster creation and media-upload states.
- Phaser tests for game rules independent of rendering where possible.
- Visual regression tests at phone, tablet, HD, and 4K board aspect ratios.
- Browser end-to-end tests for creation, preview, authentication, and playback.
- Manual device certification for representative classroom displays and mobile
  devices.
- Security tests for cross-teacher access, signed-URL expiry, deletion, and log
  redaction.

## 11. Repository strategy

This work belongs in a new `lectoemocion-platform` repository. The existing
`lectoemocion` Godot repository remains unchanged as a prototype and reference.
Useful mechanics and visual ideas may be reimplemented after review; its code,
authentication architecture, binary-heavy history, and filename-driven content
model are not migrated.

The separate `lectoemocion-web` WordPress/WooCommerce repository remains the
marketing and commerce site. Integration with the platform is deferred until
the authentication and commercial model are defined.

## 12. Explicitly deferred product decisions

These decisions do not block the architecture:

- whether mobile playback ships inside the teacher app or as a separate app;
- whether schools later receive shared libraries and multiple teacher roles;
- whether invited parents receive access;
- whether offline playback becomes mandatory;
- pricing, licensing, and WordPress commerce integration;
- photo background removal in a later privacy-reviewed release.

None of these may weaken creator-only access or the privacy baseline without a
new documented decision and assessment.

## 13. Success criteria for the first vertical slice

The first implementation milestone is successful when one teacher can:

1. authenticate on both iOS and Android development builds;
2. create a class with several synthetic child records;
3. upload a photo and name recording for each record;
4. verify each initial letter/sound;
5. instantiate one animated-story template and one interactive-game template;
6. preview both;
7. sign into a classroom browser and switch between them without the phone;
8. play them with touch and audio;
9. delete a child record and verify that its media and dependent resources are
   no longer accessible.

Only synthetic data may be used until the privacy documentation, contracts,
security controls, and pilot approval are in place.
