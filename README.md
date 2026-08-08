# LectoEmoción Platform

LectoEmoción is a private personalised early-literacy world for Spanish
children aged 3–5, sold to schools and directly to families.

Children travel through a framing story told in animated chapters. A map is the
hub of that world, and minigames unlock as the story advances. Every game is
playable immediately with product-authored default content.

An adult may then use an iOS or Android application to add child records — a
first name, a photo, a recording of the name, and a verified initial
letter/sound. That content overrides the defaults, so the children on screen
become the children in the room. Personalisation is an enhancement, never a
prerequisite.

Playback happens on interactive classroom displays and on tablets.

One web player runtime serves both: it runs in the panel's browser on classroom
displays, and embedded inside a native app on phones and tablets. The
foundation player is implemented with synthetic records only.

## Development

Prerequisites: Node.js 22 and pnpm 10.

```bash
pnpm install
pnpm dev
```

Verification:

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Only synthetic records are permitted until pilot-readiness controls are
approved.

## Sharing a build with a tester

The player is deployed to Firebase Hosting, as
[ADR 0009](docs/decisions/0009-one-hosted-player.md) decided.

```bash
pnpm deploy:player
```

It publishes to <https://lectoemocion-game.web.app>. `firebase.json` runs
`pnpm build` as a predeploy hook, because `dist/` is gitignored and turbo-cached
— without it a deploy could ship whatever was last built rather than what is on
disk. Assets are served immutable and `index.html` is not, so a tester picks up
a new build on reload instead of reporting bugs you already fixed. That caching
is the fallback ADR 0009 names for offline launch, not an optimisation.

`.firebaserc` pins the project to `lectoemocion-game`, whose Firestore is in
`europe-southwest1`. The project belongs to a different Google account than the
Firebase CLI's global default, so each checkout needs the account set once:

```bash
firebase login:use <account>
```

The CLI stores that per absolute directory, so **a new worktree under
`.worktrees/` needs it again** — otherwise `firebase deploy` runs as the global
default account and fails with a permission error. It cannot deploy to the
wrong project: `.firebaserc` pins the target, so the failure is loud.

Deploying publishes product-authored default content. The player keeps progress
and prize images in the browser, so nothing a tester enters leaves their device.
This stays true only until the [backend](docs/plans/ready/backend-and-adult-auth.md)
lands; a public URL is acceptable now because there is nothing personal behind
it.

## Documentation

- [Product and architecture design](docs/product/platform-design.md)
- [Implementation roadmap](docs/product/implementation-roadmap.md)
- [Architecture decisions](docs/decisions/0001-platform-foundations.md)
- [Firebase backend decision](docs/decisions/0002-firebase-backend.md)
- [Runtime and animation decision](docs/decisions/0003-runtime-and-animation.md)
- [Enforced invariants decision](docs/decisions/0004-enforced-invariants.md)
- [Content pipeline boundaries decision](docs/decisions/0005-content-pipeline-boundaries.md)
- ["Published" means reachable decision](docs/decisions/0006-published-means-reachable.md)
- [Progression and default content decision](docs/decisions/0007-progression-and-default-content.md)
- [Game and story template guidelines](docs/game-guidelines/template-system.md)
- [Privacy baseline](docs/privacy/spain-eu-baseline.md)
- [Godot prototype assessment](docs/migration/godot-prototype.md)
