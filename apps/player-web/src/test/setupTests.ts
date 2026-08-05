import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * Testing Library only auto-cleans when the test globals are injected, and this
 * project does not inject them. Without this, a second render in the same file
 * finds the previous test's DOM still mounted.
 */
afterEach(cleanup);
