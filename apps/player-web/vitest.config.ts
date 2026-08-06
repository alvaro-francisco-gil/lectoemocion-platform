import react from "@vitejs/plugin-react";
import { defineProject } from "vitest/config";

export default defineProject({
  plugins: [react()],
  test: {
    environment: "jsdom",
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
    setupFiles: ["./src/test/setupTests.ts"],
    /*
     * The shell's tests drive real asynchrony — a progress store read, an
     * effect, a re-render — inside jsdom, and they share the machine with
     * every other project. Alone they finish in well under a second; in a full
     * run the same work can take several. Vitest's five-second default turns
     * that contention into a failure, which is a lie about the code.
     */
    testTimeout: 30_000
  }
});
