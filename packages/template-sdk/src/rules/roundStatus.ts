/**
 * How far a round has got.
 *
 * There is no losing state. A minigame here is a place to practise, not a test
 * to pass: a card dropped in the wrong slot does not stick, and the child tries
 * again with everything exactly as they left it. Nothing is spent, so nothing
 * can run out.
 *
 * The union has two members rather than three with one unreachable, so "the
 * round was lost" is not a sentence this codebase can write. See
 * `docs/decisions/0011-no-lives-and-drag-only-ordering.md`.
 *
 * Round state, not progress state: templates never read or write progress
 * (invariant 2).
 */
export type RoundStatus = "playing" | "won";
