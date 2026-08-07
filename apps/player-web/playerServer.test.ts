import { describe, expect, it } from "vitest";
import {
  PRIMARY_PORT,
  WORKTREE_PORTS,
  checkoutId,
  describeMismatch,
  findCheckout,
  playerPort,
  resolvePlayerServer,
  type PlayerServer
} from "./playerServer";

const primary = { root: "/repo", primary: true };
const worktree = { root: "/repo/.worktrees/one", primary: false };
const other = { root: "/repo/.worktrees/two", primary: false };

describe("playerPort", () => {
  it("leaves the primary checkout on the port everyone already uses", () => {
    expect(playerPort(primary, undefined)).toBe(PRIMARY_PORT);
  });

  /* The whole point: a worktree must not land on the primary's port. */
  it("gives a worktree a port of its own", () => {
    const port = playerPort(worktree, undefined);
    expect(port).not.toBe(PRIMARY_PORT);
    expect(port).toBeGreaterThan(PRIMARY_PORT);
    expect(port).toBeLessThanOrEqual(PRIMARY_PORT + WORKTREE_PORTS);
  });

  it("gives the same worktree the same port every run", () => {
    expect(playerPort(worktree, undefined)).toBe(playerPort(worktree, undefined));
  });

  it("gives two worktrees different ports", () => {
    expect(playerPort(worktree, undefined)).not.toBe(playerPort(other, undefined));
  });

  it("lets PLAYER_PORT win", () => {
    expect(playerPort(worktree, "4999")).toBe(4999);
    expect(playerPort(primary, "4999")).toBe(4999);
  });

  /* An unusable port would otherwise surface as an unexplained bind failure. */
  it("refuses a PLAYER_PORT that is not a port", () => {
    expect(() => playerPort(primary, "no")).toThrow("PLAYER_PORT is not a port");
    expect(() => playerPort(primary, "70000")).toThrow(
      "PLAYER_PORT is not a port"
    );
  });

  it("ignores an empty PLAYER_PORT rather than reading it as zero", () => {
    expect(playerPort(primary, "")).toBe(PRIMARY_PORT);
  });
});

describe("checkoutId", () => {
  it("is stable, and different for different checkouts", () => {
    expect(checkoutId("/repo")).toBe(checkoutId("/repo"));
    expect(checkoutId("/repo")).not.toBe(checkoutId("/repo/.worktrees/one"));
  });

  /* It travels over HTTP, and a dev server may be bound to the network. */
  it("does not carry the path it was made from", () => {
    expect(checkoutId("/home/someone/repo")).not.toContain("someone");
  });
});

describe("findCheckout", () => {
  /* This file's own checkout: a directory `.git` unless the suite runs in a
     worktree, which is exactly the case the derivation exists for. */
  it("finds the checkout this file belongs to", () => {
    const found = findCheckout(import.meta.dirname);
    expect(found.root.length).toBeGreaterThan(0);
    expect(typeof found.primary).toBe("boolean");
  });

  it("fails rather than guessing outside a checkout", () => {
    expect(() => findCheckout("/")).toThrow("Not inside a git checkout");
  });
});

describe("describeMismatch", () => {
  const server: PlayerServer = {
    root: "/repo/.worktrees/one",
    primary: false,
    port: 4200,
    baseURL: "http://127.0.0.1:4200",
    checkoutId: "abc123"
  };

  it("accepts a free port", () => {
    expect(describeMismatch(server, { kind: "free" })).toBeNull();
  });

  it("accepts this checkout's own server", () => {
    expect(
      describeMismatch(server, { kind: "checkout", checkoutId: "abc123" })
    ).toBeNull();
  });

  /* The defect this whole module exists to make impossible. */
  it("refuses another checkout's server, and says how to fix it", () => {
    const complaint = describeMismatch(server, {
      kind: "checkout",
      checkoutId: "different"
    });
    expect(complaint).toContain("different checkout");
    expect(complaint).toContain("PLAYER_PORT");
  });

  /* A dev server predating the marker is the same case, and needs the same
     fix — restart it — so the message names that rather than only "foreign". */
  it("refuses a server that does not say which checkout it serves", () => {
    const complaint = describeMismatch(server, { kind: "foreign" });
    expect(complaint).toContain("does not say which checkout");
    expect(complaint).toContain("restart");
  });
});

describe("resolvePlayerServer", () => {
  it("agrees with its own parts", () => {
    const server = resolvePlayerServer(import.meta.dirname, "4321");
    expect(server.port).toBe(4321);
    expect(server.baseURL).toBe("http://127.0.0.1:4321");
    expect(server.checkoutId).toBe(checkoutId(server.root));
  });
});
