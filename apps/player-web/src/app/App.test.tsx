import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

type Destroyable = { destroy: () => void };

const createGame = vi.fn(
  (_parent: HTMLElement, _resource: unknown, _onComplete: () => void):
    Destroyable => ({ destroy: () => undefined })
);
const createMapGame = vi.fn(
  (_parent: HTMLElement, _view: unknown, _onSelect: (id: string) => void):
    Destroyable => ({ destroy: () => undefined })
);

vi.mock("../game/createGame", () => ({
  createGame: (parent: HTMLElement, resource: unknown, onComplete: () => void) =>
    createGame(parent, resource, onComplete),
  createMapGame: (
    parent: HTMLElement,
    view: unknown,
    onSelect: (id: string) => void
  ) => createMapGame(parent, view, onSelect)
}));

/** Completes the resource the shell most recently opened. */
function completeActiveResource(): void {
  const call = createGame.mock.calls.at(-1);
  expect(call).toBeDefined();
  call?.[2]();
}

describe("the world shell", () => {
  beforeEach(() => {
    localStorage.clear();
    createGame.mockClear();
    createMapGame.mockClear();
  });

  it("starts on the map with only the entry node open", () => {
    render(<App />);
    expect(createMapGame).toHaveBeenCalled();

    const open = screen
      .getAllByRole("button")
      .filter((button) => !button.hasAttribute("disabled"));
    expect(open.map((button) => button.textContent)).toEqual(["El encuentro"]);
  });

  it("refuses to open a locked node", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Las iniciales" }));

    expect(createGame).not.toHaveBeenCalled();
  });

  it("opens a resource and returns to the map", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "El encuentro" }));
    expect(createGame).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Volver al mapa" }));
    await waitFor(() =>
      expect(screen.getByTestId("progress-summary")).toBeInTheDocument()
    );
  });

  it("unlocks the next node once the first is completed", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "El encuentro" }));
    completeActiveResource();

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Las iniciales" })
      ).not.toBeDisabled()
    );
  });

  it("keeps a completed node replayable", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "El encuentro" }));
    completeActiveResource();

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "El encuentro" })
      ).toHaveAttribute("data-state", "completed")
    );
    expect(
      screen.getByRole("button", { name: "El encuentro" })
    ).not.toBeDisabled();
  });

  it("restores progress from a previous session", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "El encuentro" }));
    completeActiveResource();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Las iniciales" })
      ).not.toBeDisabled()
    );

    const remounted = render(<App />);
    await waitFor(() =>
      expect(
        remounted.getAllByRole("button", { name: "Las iniciales" }).at(-1)
      ).not.toBeDisabled()
    );
  });

  it("tells the adult how much of the world is open", () => {
    render(<App />);
    expect(screen.getByTestId("progress-summary")).toHaveTextContent(
      "1 de 6 desbloqueados"
    );
  });
});
