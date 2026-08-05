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

  it.each(["Parejas", "¿Cuál es?", "Sílabas"])(
    "reaches the %s resource",
    (label) => {
      render(<App />);
      fireEvent.click(screen.getByRole("button", { name: label }));
      expect(screen.getByRole("button", { name: label })).toHaveAttribute(
        "aria-pressed",
        "true"
      );
    }
  );

  it("presses exactly one resource at a time", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Sílabas" }));
    const pressed = screen
      .getAllByRole("button")
      .filter((button) => button.getAttribute("aria-pressed") === "true");
    expect(pressed).toHaveLength(1);
  });
});
