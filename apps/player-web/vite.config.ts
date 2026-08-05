import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * The port is configurable so a git worktree can run its own dev server and
 * end-to-end suite without colliding with the one already serving the primary
 * checkout — or, worse, silently testing against it.
 */
const port = Number(process.env["PLAYER_PORT"] ?? 4173);

export default defineConfig({
  plugins: [react()],
  server: { host: "127.0.0.1", port, strictPort: true }
});
