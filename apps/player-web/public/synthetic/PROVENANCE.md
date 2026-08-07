# Synthetic cast — provenance

Every file in this directory is **generated**, by
`scripts/generate-synthetic-cast.mjs`. Run it again to rebuild them:

```bash
node scripts/generate-synthetic-cast.mjs
```

## What these are

| Pattern | What it is |
|---|---|
| `avatar-*.svg` | A letter on a coloured disc. Not a face, not a photograph. |
| `silent-*.mp3` | Half a second of MPEG-1 Layer III silence, assembled byte by byte. |

## Why they exist

`name-book` — *El libro de los nombres* — is the one template that cannot be
built without a roster, so developing and testing it needs a class to stand in
for one. AGENTS.md prohibits real child data in fixtures, screenshots, and
source control, and these files are how that rule is kept while the feature
remains testable.

**No photograph, drawing, or recording of any real person appears here, and
none may be added.** The generator takes no input beyond the names it hard-codes
and reaches no network, so a rebuild cannot introduce one.

The names these belong to are invented; see
`packages/template-catalog/src/fixtures/syntheticClass.ts`.
