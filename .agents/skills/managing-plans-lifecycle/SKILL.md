---
name: managing-plans-lifecycle
description: Use when creating, approving, starting, resuming, completing, or surveying product designs and implementation plans in this repository, including output from brainstorming and writing-plans.
---

# Managing Plans Lifecycle

Keep one durable coordinate for work in flight:

```text
docs/plans/ideas/    proposed, unresolved, or optional
docs/plans/ready/    approved and fully planned, not started
docs/plans/ongoing/  implementation in progress
docs/decisions/      durable rationale after shipping
```

Use bare kebab-case filenames without date prefixes. A plan keeps the same
filename as it moves. Do not create `approved`, `active`, `completed`, `done`,
`archive`, `queued`, `blocked`, or `docs/superpowers` directories.

## Create or capture an idea

Write `docs/plans/ideas/<topic>.md` with:

- goal;
- context;
- proposed design;
- open questions.

If brainstorming writes a dated file under `docs/superpowers/specs/`, move and
rename it immediately. Do not maintain a separate design and implementation
plan for the same scope: the plan evolves in place.

## Promote to ready

Move `ideas/<topic>.md` to `ready/<topic>.md` only when:

- the user approved the design;
- open questions are resolved or explicitly out of scope;
- file structure and checkbox tasks are present;
- verification and acceptance criteria are explicit.

Output from writing-plans is merged into this same file.

## Start or resume work

Before implementation, move `ready/<topic>.md` to `ongoing/<topic>.md` and add:

```markdown
## Status

- **Updated:** YYYY-MM-DD
- **Stage:** current task
- **Branch:** branch or worktree
- **Done:** verified completed work
- **Next:** immediate action
- **Blockers:** none or explicit blockers
- **Handoff:** non-obvious continuation context
```

Read and refresh this section at the start and end of every work session.
Folder location, not checkbox scanning, determines lifecycle state.

## Retire shipped work

After implementation is merged and verified in its intended environment:

1. Extract only non-obvious, durable rationale to
   `docs/decisions/<topic>.md`.
2. Use: Context, Decision, Rejected alternative, What this binds, Revisit when.
3. Delete `docs/plans/ongoing/<topic>.md`.

Do not archive completed plans. Code and git history record what was built;
decision documents preserve why.

## Survey work

Inspect in order:

1. `docs/plans/ongoing/`
2. `docs/plans/ready/`
3. `docs/plans/ideas/`
4. `docs/decisions/`

## Stop conditions

- Never mark work ongoing before implementation starts.
- Never mark a plan complete because code was written; require verification.
- Never retain stale task checklists as durable documentation.
- Never invent a parallel lifecycle taxonomy.
