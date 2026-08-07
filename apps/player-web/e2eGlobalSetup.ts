import {
  describeMismatch,
  readServedCheckout,
  resolvePlayerServer
} from "./playerServer";

/**
 * Refuses to run against a dev server belonging to another checkout.
 *
 * Playwright reuses whatever already answers on the port, and a suite that
 * quietly reports on code it never loaded is worse than one that fails. This
 * runs before the web server starts: a free port is the ordinary case and
 * Playwright goes on to start our own.
 */
export default async function assertOwnServer(): Promise<void> {
  const server = resolvePlayerServer(
    import.meta.dirname,
    process.env["PLAYER_PORT"]
  );
  const complaint = describeMismatch(
    server,
    await readServedCheckout(server.baseURL)
  );
  if (complaint) throw new Error(complaint);
}
