/**
 * Exhaustiveness guard for discriminated unions.
 *
 * Call this in the default branch of a switch over a union. Adding a new
 * member to that union then fails compilation at every site that must handle
 * it, instead of falling through to whichever branch happened to be last.
 */
export function assertNever(value: never, context: string): never {
  throw new Error(`Unhandled ${context}: ${JSON.stringify(value)}`);
}
