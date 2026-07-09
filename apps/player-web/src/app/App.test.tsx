import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

vi.mock("../game/createGame", () => ({
  createGame: vi.fn(() => ({ destroy: vi.fn() }))
}));

describe("App", () => {
  it("switches between the story and game resources", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: "Historia de nombres" }))
      .toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Juego de iniciales" }));
    expect(screen.getByRole("button", { name: "Juego de iniciales" }))
      .toHaveAttribute("aria-pressed", "true");
  });
});
