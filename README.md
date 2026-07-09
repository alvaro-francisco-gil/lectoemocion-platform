# LectoEmoción Platform

LectoEmoción is a private educational platform for Spanish early-literacy
activities for children aged 3–5.

Teachers use an iOS or Android application to create a class roster. Each child
record contains a first name, a photo, a recording of the name, and a
teacher-verified initial letter/sound. The platform combines those records with
predefined animated-story and game templates. Teachers play the resulting
resources primarily on interactive classroom displays through an authenticated
web player.

The foundation player is implemented with synthetic records only.

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
- [Game and story template guidelines](docs/game-guidelines/template-system.md)
- [Privacy baseline](docs/privacy/spain-eu-baseline.md)
- [Godot prototype assessment](docs/migration/godot-prototype.md)
