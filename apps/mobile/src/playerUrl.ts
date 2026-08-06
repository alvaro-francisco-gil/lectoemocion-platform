/**
 * Where the embedded player is loaded from.
 *
 * This is the shell's only piece of logic today, and it exists because of
 * invariant 6. A WebView handed an unusable source renders a blank white page,
 * which is indistinguishable from a broken application to the adult holding the
 * phone. Resolving the URL up front turns that into a stated, recoverable
 * error.
 *
 * Deliberately hand-parsed rather than built on `URL`: React Native's `URL` has
 * historically been a partial implementation, and this module must behave
 * identically under Hermes and under Node in the test suite.
 */

export type PlayerUrlProblem =
  /** Unset or blank — the shell was built without being told where to look. */
  | "missing"
  /** No scheme, or a scheme with no authority. A WebView would guess. */
  | "malformed"
  /** `javascript:`, `data:`, and `file:` are injection and filesystem risks. */
  | "unsupported-scheme";

export type PlayerUrlResult =
  | { readonly kind: "resolved"; readonly url: string }
  | { readonly kind: "unusable"; readonly problem: PlayerUrlProblem };

const SCHEME = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;

/** The player is only ever served over HTTP. */
const SUPPORTED_SCHEMES = ["http", "https"];

export function resolvePlayerUrl(raw: string | undefined): PlayerUrlResult {
  const value = raw?.trim() ?? "";
  if (value === "") return { kind: "unusable", problem: "missing" };

  const scheme = SCHEME.exec(value)?.[1];
  if (scheme === undefined) return { kind: "unusable", problem: "malformed" };

  if (!SUPPORTED_SCHEMES.includes(scheme.toLowerCase())) {
    return { kind: "unusable", problem: "unsupported-scheme" };
  }

  /*
   * An authority is required, so `http:/host` is rejected rather than silently
   * reinterpreted as a path.
   */
  const authority = value.slice(scheme.length + 1);
  if (!authority.startsWith("//") || !/^\/\/[^/]/.test(authority)) {
    return { kind: "unusable", problem: "malformed" };
  }

  return { kind: "resolved", url: value };
}

/**
 * The origin the WebView is allowed to stay within.
 *
 * A WebView that follows any link is a general-purpose browser with no address
 * bar, shipped to children. Navigation is therefore confined to the origin the
 * player is served from, and this is the value that confinement compares
 * against.
 */
export function playerOrigin(url: string): string {
  const authority = url.indexOf("://") + 3;
  const pathStart = url.indexOf("/", authority);
  return pathStart === -1 ? url : url.slice(0, pathStart);
}
