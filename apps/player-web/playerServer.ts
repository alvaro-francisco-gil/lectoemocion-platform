import { createHash } from "node:crypto";
import { statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * Which checkout a dev server belongs to, and which port it may use.
 *
 * `AGENTS.md` used to answer this with a note telling you to set `PLAYER_PORT`
 * inside a worktree. The note was correct and it still did not work: Playwright
 * reuses whatever is already listening, so forgetting it makes a worktree's
 * suite pass against the *primary* checkout's code. A suite that reports a
 * green run for code it never loaded is worse than one that fails.
 *
 * So the port is derived rather than remembered, and the server is asked which
 * checkout it is serving before the suite trusts it.
 */

/** The primary checkout's port. Worktrees never take it. */
export const PRIMARY_PORT = 4173;

/** Worktree ports: 4174–4273, one per checkout path. */
export const WORKTREE_PORTS = 100;

/** Where a dev server names the checkout it is serving. */
export const CHECKOUT_PATH = "/__checkout";

export interface Checkout {
  /** Absolute path of the checkout root. */
  readonly root: string;
  /** True for the primary checkout, false inside a `git worktree`. */
  readonly primary: boolean;
}

export interface PlayerServer extends Checkout {
  readonly port: number;
  readonly baseURL: string;
  /**
   * The checkout's identity as served over HTTP.
   *
   * A hash rather than the path itself: equality is all the check needs, and a
   * dev server bound to `0.0.0.0` for the native shell would otherwise hand a
   * home directory's absolute path to the local network.
   */
  readonly checkoutId: string;
}

/**
 * Walks up to the checkout this file belongs to.
 *
 * `.git` is a directory in the primary checkout and a file in a worktree, which
 * is the distinction the port derivation needs. Failing to find one at all is
 * an explicit error: guessing a port for an unknown checkout is how two suites
 * end up on one server again.
 */
export function findCheckout(from: string): Checkout {
  let directory = resolve(from);
  for (;;) {
    const marker = statSyncOrNull(join(directory, ".git"));
    if (marker) return { root: directory, primary: marker.isDirectory() };

    const parent = dirname(directory);
    if (parent === directory) {
      throw new Error(`Not inside a git checkout: ${from}`);
    }
    directory = parent;
  }
}

function statSyncOrNull(path: string): ReturnType<typeof statSync> | null {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}

export function checkoutId(root: string): string {
  return createHash("sha256").update(root).digest("hex").slice(0, 16);
}

/**
 * The port this checkout serves on.
 *
 * The primary checkout keeps 4173, so nothing about the ordinary workflow
 * moves. A worktree derives its own from its path — stable across runs, and
 * different from the primary's without anyone having to remember that.
 * `PLAYER_PORT` still wins, for the case the derivation did not foresee.
 */
export function playerPort(checkout: Checkout, override: string | undefined): number {
  if (override !== undefined && override !== "") {
    const port = Number(override);
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
      throw new Error(`PLAYER_PORT is not a port number: ${override}`);
    }
    return port;
  }

  if (checkout.primary) return PRIMARY_PORT;

  const digest = createHash("sha256").update(checkout.root).digest();
  return PRIMARY_PORT + 1 + (digest.readUInt32BE(0) % WORKTREE_PORTS);
}

/** Everything the dev server and the end-to-end suite must agree on. */
export function resolvePlayerServer(
  from: string,
  override: string | undefined
): PlayerServer {
  const checkout = findCheckout(from);
  const port = playerPort(checkout, override);
  return {
    ...checkout,
    port,
    baseURL: `http://127.0.0.1:${port}`,
    checkoutId: checkoutId(checkout.root)
  };
}

/** What was found listening on the port, if anything. */
export type ServedCheckout =
  | { kind: "free" }
  | { kind: "checkout"; checkoutId: string }
  | { kind: "foreign" };

export function describeMismatch(
  server: PlayerServer,
  served: ServedCheckout
): string | null {
  if (served.kind === "free") return null;
  if (served.kind === "checkout" && served.checkoutId === server.checkoutId) {
    return null;
  }

  const whose =
    served.kind === "foreign"
      ? "something that does not say which checkout it serves — another " +
        "program, or a player dev server started before this check existed"
      : "a dev server from a different checkout";

  return (
    `${server.baseURL} is already being served by ${whose}. ` +
    "Running the suite against it would report on that code rather than on " +
    `this checkout (${server.root}). Stop or restart it, or set PLAYER_PORT ` +
    "to a free port."
  );
}

/** Asks the port who it belongs to. A free port is the ordinary case. */
export async function readServedCheckout(
  baseURL: string
): Promise<ServedCheckout> {
  let response: Response;
  try {
    response = await fetch(new URL(CHECKOUT_PATH, baseURL));
  } catch (cause) {
    if (isConnectionRefused(cause)) return { kind: "free" };
    throw cause;
  }

  if (!response.ok) return { kind: "foreign" };
  return { kind: "checkout", checkoutId: (await response.text()).trim() };
}

function isConnectionRefused(cause: unknown): boolean {
  if (!(cause instanceof Error)) return false;
  const reason: unknown = cause.cause;
  if (!(reason instanceof Error) || !("code" in reason)) return false;
  const code: unknown = reason.code;
  return code === "ECONNREFUSED" || code === "ECONNRESET";
}
