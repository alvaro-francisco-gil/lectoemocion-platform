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

## Documentation

- [Product and architecture design](docs/product/platform-design.md)
- [Implementation roadmap](docs/product/implementation-roadmap.md)
- [Ongoing: foundation and synthetic player](docs/plans/ongoing/foundation-and-synthetic-player.md)
- [Architecture decisions](docs/decisions/0001-platform-foundations.md)
- [Firebase backend decision](docs/decisions/0002-firebase-backend.md)
- [Runtime and animation decision](docs/decisions/0003-runtime-and-animation.md)
- [Enforced invariants decision](docs/decisions/0004-enforced-invariants.md)
- [Game and story template guidelines](docs/game-guidelines/template-system.md)
- [Privacy baseline](docs/privacy/spain-eu-baseline.md)
- [Godot prototype assessment](docs/migration/godot-prototype.md)
