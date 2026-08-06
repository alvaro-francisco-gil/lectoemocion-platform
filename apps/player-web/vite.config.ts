import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * The port is configurable so a git worktree can run its own dev server and
 * end-to-end suite without colliding with the one already serving the primary
 * checkout — or, worse, silently testing against it.
 */
const port = Number(process.env["PLAYER_PORT"] ?? 4173);

/**
 * Loopback by default, because that is the safe binding and it is what the
 * end-to-end suite expects.
 *
 * A physical phone running the native shell cannot reach loopback, so
 * developing `apps/mobile` against this server needs `PLAYER_HOST=0.0.0.0`.
 * That is opt-in: exposing a dev server to the local network is a deliberate
 * act, not a default.
 */
const host = process.env["PLAYER_HOST"] ?? "127.0.0.1";

export default defineConfig({
  plugins: [react()],
  server: { host, port, strictPort: true }
});
