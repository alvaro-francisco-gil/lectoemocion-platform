import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { CHECKOUT_PATH, resolvePlayerServer } from "./playerServer";

/**
 * The port is derived from the checkout rather than remembered, so a git
 * worktree runs its own dev server and end-to-end suite without colliding with
 * the one serving the primary checkout — or, worse, silently testing against
 * it. `PLAYER_PORT` still overrides. See `playerServer.ts`.
 */
const server = resolvePlayerServer(import.meta.dirname, process.env["PLAYER_PORT"]);

/**
 * Loopback by default, because that is the safe binding and it is what the
 * end-to-end suite expects.
 *
 * A physical phone running the native shell cannot reach loopback, so
 * developing `apps/mobile` against this server needs `PLAYER_HOST=0.0.0.0`.
 * That is opt-in: exposing a dev server to the local network is a deliberate
 * act, not a default. `pnpm mobile:lan` sets it.
 *
 * It must also be listed in `turbo.json`'s `dev` task under `passThroughEnv`,
 * along with `PLAYER_PORT`. Turbo runs tasks in strict env mode, so anything
 * not named there is stripped before this file runs — and both variables fail
 * *silently* when that happens. `PLAYER_HOST` falls back to loopback, which a
 * phone cannot reach; `PLAYER_PORT` falls back to the derived port, which is
 * how a worktree ends up serving the primary checkout's code.
 */
const host = process.env["PLAYER_HOST"] ?? "127.0.0.1";

/**
 * Lets the dev server say which checkout it is serving.
 *
 * `apply: "serve"` keeps it out of every build, so nothing here reaches a
 * classroom. What it answers is a hash, not a path — see `checkoutId`.
 */
function checkoutMarker(checkoutId: string): Plugin {
  return {
    name: "lectoemocion:checkout-marker",
    apply: "serve",
    configureServer(devServer) {
      devServer.middlewares.use(CHECKOUT_PATH, (_request, response) => {
        response.setHeader("Content-Type", "text/plain");
        response.end(checkoutId);
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), checkoutMarker(server.checkoutId)],
  server: { host, port: server.port, strictPort: true }
});
