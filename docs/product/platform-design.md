# LectoEmoción Platform Design

Date: 2026-08-04  
Status: Approved product design. Runtime and distribution are decided in
[ADR 0003](../decisions/0003-runtime-and-animation.md); see section 4.

## 1. Product vision

LectoEmoción is a personalised early-literacy world for Spanish children aged
3–5.

Children travel through a framing story told in animated chapters. A map is the
hub of that world. Minigames unlock as the story advances and remain replayable
afterwards. The games teach names, initial letters, and sounds.

The world is fully playable with no setup. Every game ships with
product-authored default content. An adult may then upload a child's first
name, recognisable photo, a recording of the name, and a verified initial
letter/sound. That content **overrides** the defaults slot by slot, and certain
games become markedly more meaningful when the children on screen are the
children in the room.

Personalisation is an enhancement, never a prerequisite.

The platform does not use AI to generate stories, animations, game mechanics,
images, voices, or text. "Personalisation" means deterministic placement of
adult-supplied content into product-authored templates.

## 2. Markets

The product is sold both to institutions and directly to families.

| | Institution | Family |
|---|---|---|
| Buyer | School or education authority | Parent |
| Data controller | The school | The parent |
| Pre-launch legal work | Article 28 agreement, DPIA, DPO approval | Parental consent and clear notice |
| Group | A class | One or a few children |
| Primary play surface | Interactive classroom display | Tablet |
| Uploads performed by | Teacher, on a phone | Parent, on a phone |

**The institutional market is approached first**, because teacher access and
early feedback are readily available.

This is the heavier legal path: the school is the controller, and real child
media requires Article 28 agreements, a DPIA screening, and school approval
before the first upload.

It is unblocked by a property of the product itself. Every game is playable
with default content and no uploads, so a genuine classroom pilot — real
teachers, real children, real feedback — can run with **no personal data at
all** while the institutional paperwork proceeds in parallel. Personalisation
is enabled per deployment only once that deployment's artefacts are complete.

This staged pilot is the intended path, not a fallback. Enabling uploads before
the artefacts exist is the single most likely way for this project to cause
harm.

### 2.1 Tenancy model

Tenancy is **Account → Group → child records**, where a group is a class or a
family. The difference between markets lives in billing, legal artefacts, and
group size — not in the domain model.

Nothing in the domain, schema, or service layer may assume a group is a school
class.

## 3. Product boundaries

### Included

- A product-authored story world with animated chapters and a map hub.
- Progression: minigames unlock as the story advances, then stay replayable.
- Default content that makes every game playable without any upload.
- Optional personalisation: first name, photo, name recording, verified
  initial letter/sound.
- A native-feeling upload and management workflow on iOS and Android.
- Private groups containing multiple children.
- Non-interactive personalised resources that play inside the application.
- Authenticated playback on interactive classroom displays and on tablets.
- Touch, stylus, and mouse input.
- Responsive playback on classroom displays, desktop browsers, tablets, and
  phones.
- A design that permits offline caching later.

### Excluded from the first product

- AI-generated content.
- Facial recognition or biometric classification.
- Background removal or generative transformation of children's photos.
- Voice cloning or transcription.
- Exportable or shareable media files.
- Public or unlisted-link sharing.
- Child accounts.
- A user-composed or collaborative map.
- A free-form timeline or game editor.
- Adult-authored executable logic.
- Full 3D worlds.

## 4. Technology

Decided in [ADR 0003](../decisions/0003-runtime-and-animation.md):

- one web player runtime on every surface;
- the classroom display runs it in the panel's browser, with a connected
  computer over HDMI and USB touch as the supported fallback;
- phones and tablets run a native Expo/React Native shell, listed in the App
  Store and Play Store, with the player embedded and all device capabilities
  owned by the shell;
- Phaser remains the renderer, isolated behind the player adapter, rendering at
  a 1080p logical resolution;
- scene choreography is authored in code with GSAP; asset animation is
  authored as swappable files, moving to Rive when an animator joins.

The decision is contingent on the classroom-panel verification in roadmap stage
2, which measures the browser engine actually available on the target display.

The following constraints hold regardless:

1. **A template is implemented exactly once.** Any option requiring templates
   to exist in two runtimes is rejected. The catalogue grows without bound;
   duplicated templates would double every future unit of content and drift
   apart.
2. **Resource manifests stay engine-neutral**, so the renderer remains
   replaceable at the cost of one adapter. See section 6.3.
3. **Delivery matches control of the hardware.** The classroom display gets
   technology that requires no installation permission, because it is not our
   device. A phone or tablet may get technology that requires installation,
   because the user owns it and installs willingly.
4. Splitting responsibility across surfaces is permitted; splitting
   implementation is not.

Still unresolved: the SMART panel model and firmware version, which determine
the browser engine available on the board, and which market is approached
first.

## 5. Primary workflows

### 5.1 Play without setup

1. An adult creates an account and signs in.
2. The world opens on the map.
3. The first story chapter plays.
4. Unlocked minigames are playable immediately using default content.

No upload is required to reach this point.

### 5.2 Personalise

1. The adult signs into the mobile application.
2. The adult creates a group.
3. For each child, the adult enters a first name, takes or chooses a photo,
   records the name, and confirms the initial letter/sound.
4. The application uploads media to private EU-hosted storage.
5. Compatible games substitute that content for their defaults automatically.

Uploading always happens on the phone. It is never performed at the classroom
display.

### 5.3 Play in class or at home

1. The adult opens LectoEmoción on the classroom display or tablet.
2. The adult authenticates, or pairs the device using a short-lived code shown
   as a QR from the phone.
3. The map appears, showing progress for that account.
4. Children play story chapters, minigames, and non-interactive resources.
5. The classroom display needs no library browser, no creation flow, and no
   group management. The map is its navigation.

**The display is self-sufficient.** The adult moves between the map and a game
by tapping the board. Playback must never require an active connection to the
phone.

QR pairing covers authentication. Uploading is always performed on the phone
and never at the display. Phone-driven control may be added later as an
enhancement, but the display must remain fully operable without it.

Consequence for layout: navigation controls the adult uses are reached by an
adult, not a child, so they may sit outside the child reach band — but they
must not be placed where a child will hit them by accident during play.

## 6. World, resources, and templates

### 6.1 The world

- The map is a fixed, product-authored world, extended by product updates.
- It is not user-composed, collaborative, or editable.
- Progression is intended to be easy. Unlocking paces discovery; it is not a
  difficulty gate.
- **Adults cannot skip ahead.** Everyone travels the world in order. There is
  no product-facing unlock override.

A build-level bypass is nevertheless required for development, automated
testing, demos, screenshots, and support reproduction. It must never be
reachable from production builds by an ordinary user.

An adult must be able to see what is currently unlocked before a session
begins, so a lesson can be planned around what the class can actually reach.

### 6.2 Domain records

- `Account`: the authenticated adult owner and billing subject.
- `Group`: a private class or family belonging to an account.
- `ChildRecord`: first name, verified initial letter/sound, photo asset
  reference, audio asset reference, and lifecycle state.
- `MediaAsset`: private object-storage reference, media type, checksum,
  dimensions or duration, processing state, and retention metadata.
- `TemplateDefinition`: immutable version of a story chapter, minigame, or
  non-interactive resource.
- `PlayableResource`: template version plus optional personalisation bindings
  and validated parameters.
- `Progress`: unlock and completion state.

Progress belongs to the account. Per-child profiles within a single account are
a possible future addition and must not be designed out, but are not required.

Deleting a child record must remove that child from every resource that
references them, falling back to default content rather than failing.
Resources reference media; they never duplicate it.

### 6.3 Resource kinds

- **cinematic** — a linear, non-interactive story chapter.
- **minigame** — interactive and rule-based.
- **non-interactive personalised resource** — a fixed animated timeline with
  the account's uploaded pictures placed into it. It is rendered by the player
  at playback time, not encoded as a video file. It is **not exportable,
  downloadable, or shareable**; it plays inside the application only.
- **map / hub** — reads progress and routes into the other kinds.

The map belongs to the player shell, not the template catalogue, because it
depends on progress state that templates must not access.

### 6.4 Template contract

Each template declares:

- stable identifier and immutable version;
- resource kind;
- learning objective and target age;
- product-authored default content for every personalisable slot;
- personalisation slots, their media and text roles, and their selection
  strategy;
- supported letters/sounds;
- scene and interaction definitions;
- responsive layout rules and safe areas;
- completion, unlock, and error behaviour;
- accessibility requirements;
- asset budgets and supported player capabilities.

Templates are authored and reviewed by the product team. Adults supply content
but cannot modify mechanics, timelines, or executable behaviour.

Because default content is mandatory, every personalisable slot carries
product-authored art, text, or audio. This is a standing content-production
cost and must be budgeted per template.

### 6.5 Validation

Resource manifests use JSON Schema and are validated when created and when
loaded. The player rejects unknown schema versions and unrecognised template
versions with a recoverable adult-facing error.

Missing *personalised* media falls back to default content. Missing *default*
media is a product defect and fails closed.

## 7. Backend and media flow

The initial backend uses Firebase and provides:

- Firebase Authentication for adult accounts only;
- Cloud Firestore for accounts, groups, child records, template metadata,
  progress, and playable resource manifests;
- Cloud Storage for private photos and pronunciation recordings;
- Cloud Functions v2 for privileged operations and lifecycle jobs;
- group and child-record CRUD operations;
- direct-to-storage uploads using short-lived signed requests;
- media validation and metadata removal where technically appropriate;
- template compatibility and resource assembly;
- owner-only authorisation;
- short-lived playback manifests and media URLs;
- audit events, deletion, and retention jobs.

Firestore, Storage, and Functions must be provisioned explicitly in
`europe-southwest1` (Madrid) unless a later ADR changes the region. Static
player assets may use Firebase Hosting, but no child media may be published as
public hosting content. Uploaded files are never committed to the source
repository.

Firebase Authentication is US-hosted. It contains adult account data only;
children never receive Firebase Authentication accounts. This international
transfer must be documented and accepted by each controller before a pilot.

Client code accesses Firebase only through typed services. Security Rules are
mandatory but are not the sole business-rule layer: services validate
preconditions, Rules enforce client permissions, and Functions own privileged
or cross-document operations. Emulator-backed tests verify Firestore and
Storage access boundaries.

Offline playback is not an initial hard requirement. Manifests and assets must
nevertheless be packageable and cacheable so a later caching feature does not
require redesigning templates.

## 8. Privacy and safeguarding baseline

Children's photos, names, voices, group membership, progress, and derived
resources are personal data.

The controller differs by market. For institutional use, the school or
education authority is typically the controller and LectoEmoción the processor,
with the teacher acting under the controller's authority. For direct family
sale, the parent is the controller and no Article 28 chain exists — a lighter
obligation, but not an empty one. Exact roles and lawful basis must be
confirmed per deployment. Detail in
[spain-eu-baseline.md](../privacy/spain-eu-baseline.md).

The product enforces, in both markets:

- owner-only access;
- private storage and short-lived media delivery;
- encryption in transit and at rest;
- EU-region hosting by default;
- documented subprocessors;
- explicit documentation that Firebase Authentication processes adult account
  data in the United States;
- no exportable media and no public or unlisted-link access;
- no advertising or behavioural profiling;
- no use of customer media to train models;
- no biometric recognition, voice cloning, or generative transformation;
- configurable retention and complete deletion workflows;
- access logging and incident-response procedures;
- transparency materials in Spanish.

Institutional sale additionally requires GDPR Article 28 agreements, a DPIA
screening, and controller approval before any pilot.

Product design must not assume that a checkbox can manufacture valid consent.

## 9. Classroom-display compatibility

Interactive classroom displays are heterogeneous. Modern devices may have
built-in Android, optional Windows or ChromeOS modules, or an externally
connected computer. Android on these panels is frequently a vendor build
without Google Mobile Services, shipping a vendor browser on a system WebView
that may be years out of date and not user-updatable. Installing an
application is a vendor-management and school-IT process, not a download.

Spanish classrooms include smaller and OEM-branded panels alongside the major
vendors. These typically ship generic AOSP with a less actively maintained
browser, which raises rather than lowers the risk that the panel's own browser
is inadequate. It also removes any incentive to target a vendor application
platform.

The first target display is a TTL-branded panel; its model, firmware, and
browser engine are not yet known.

The player will define and test a browser/device support matrix. Early testing
must include the target display and representative SMART, Promethean, and
ViewSonic displays where available, covering:

- startup and asset-loading time;
- WebGL/canvas support and available engine version;
- single- and multi-touch behaviour;
- stylus and mouse fallback;
- 16:9 4K scaling and safe areas;
- reach: interactive elements must sit within the lower band of a large panel,
  where a child aged 3–5 can physically touch them;
- audio unlock after user interaction;
- full-screen behaviour;
- weak-network recovery.

Where a panel's own browser proves inadequate, a computer connected to the
panel over HDMI and USB touch is a supported path. Given the panel population
above, this may prove to be the primary route rather than the exception. It is
not a degraded experience: it delivers a current desktop browser and removes
every compatibility question at once.

## 10. Error handling

- Interrupted uploads resume or restart without producing child records that
  appear complete.
- Invalid media receives a clear corrective message and is not made playable.
- Missing personalised media falls back to default content; playback continues.
- Unsupported templates and schema versions fail closed.
- Expired sessions return to authentication without exposing cached group
  information.
- Playback preloads required assets and presents an adult-facing retry screen
  before children see a broken scene.
- Progress writes are idempotent and tolerate loss of connectivity mid-session.
- Client logs must not contain names, media URLs, recordings, photos, or
  authentication tokens.

## 11. Testing strategy

- Unit tests for domain policies, personalisation slot binding, default-content
  fallback, initial-letter normalisation, progression rules, and template
  compatibility.
- Schema contract tests shared by API and player.
- Component tests for group creation and media-upload states.
- Game-rule tests independent of rendering where possible.
- Visual regression tests at phone, tablet, HD, and 4K board aspect ratios.
- End-to-end tests for personalisation, authentication, progression, and
  playback.
- Manual device certification for representative classroom displays, tablets,
  and mobile devices.
- Security tests for cross-account access, signed-URL expiry, deletion, and log
  redaction.

## 12. Repository strategy

This work belongs in the `lectoemocion-platform` repository. The existing
`lectoemocion` Godot repository remains unchanged as a prototype and reference.
Useful mechanics and visual ideas may be reimplemented after review; its code,
authentication architecture, binary-heavy history, and filename-driven content
model are not migrated. See
[godot-prototype.md](../migration/godot-prototype.md).

The separate `lectoemocion-web` WordPress/WooCommerce repository is the
marketing and commerce site. It is the likely commerce path for the family
market, and integration is deferred until the authentication and commercial
model are defined.

## 13. Open product decisions

- Whether phone-driven control of the display is added as a later enhancement.
  The display remains self-sufficient regardless. See 5.3.
- Whether per-child profiles within one account are added.
- Whether offline playback becomes mandatory.
- Pricing, licensing, and WooCommerce integration.
- Photo background removal in a later privacy-reviewed release.

None of these may weaken owner-only access or the privacy baseline without a
new documented decision and assessment.

## 14. Success criteria for the first vertical slice

The first milestone is successful when one adult can:

1. authenticate on iOS and Android development builds;
2. open the world and play the first story chapter with default content and no
   uploads;
3. create a group with several synthetic child records;
4. upload a photo and name recording for each record;
5. verify each initial letter/sound;
6. see personalised content replace defaults in a compatible minigame;
7. unlock a second minigame through progression and replay the first;
8. play a non-interactive personalised resource;
9. sign into a classroom display, see the same progress, and play from the map;
10. delete a child record and confirm that its media is inaccessible and that
    affected resources fall back to default content.

Only synthetic data may be used until the privacy documentation, contracts,
security controls, and market-appropriate approvals are in place.
