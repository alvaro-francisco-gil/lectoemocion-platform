import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

type Destroyable = { destroy: () => void };

const createGame = vi.fn(
  (_parent: HTMLElement, _resource: unknown, _onComplete: () => void):
    Destroyable => ({ destroy: () => undefined })
);
vi.mock("../game/createGame", () => ({
  createGame: (parent: HTMLElement, resource: unknown, onComplete: () => void) =>
    createGame(parent, resource, onComplete)
}));

/** Completes the resource the shell most recently opened. */
function completeActiveResource(): void {
  const call = createGame.mock.calls.at(-1);
  expect(call).toBeDefined();
  call?.[2]();
}

/** Finishing a resource does not leave it: the child goes back to the map. */
function returnToMap(): void {
  fireEvent.click(screen.getByRole("button", { name: "Volver al mapa" }));
}

describe("the world shell", () => {
  beforeEach(() => {
    localStorage.clear();
    createGame.mockClear();
  });

  it("starts on the map with only the entry node open", () => {
    render(<App />);
    expect(createGame).not.toHaveBeenCalled();

    const open = screen
      .getAllByRole("button")
      .filter((button) => !button.hasAttribute("disabled"));
    expect(
      open.map((button) => button.querySelector(".world-node__title")?.textContent)
    ).toEqual(["El encuentro"]);
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
      expect(screen.getByRole("navigation", { name: "Mundo" })).toBeInTheDocument()
    );
  });

  it("unlocks the next node once the first is completed", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "El encuentro" }));
    completeActiveResource();
    returnToMap();

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
    returnToMap();

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
    returnToMap();
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

  it("shows the world as one ordered path", () => {
    render(<App />);
    const titles = screen
      .getAllByRole("button")
      .map((button) => button.querySelector(".world-node__title")?.textContent);
    expect(titles).toEqual([
      "El encuentro",
      "Las iniciales",
      "El bosque de parejas",
      "¿Cuál es?",
      "El puente de sílabas",
      "Nuestro álbum"
    ]);
  });

  it("hides the world list while a resource is playing", () => {
    render(<App />);
    expect(screen.getByRole("navigation", { name: "Mundo" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "El encuentro" }));

    /* Only "Volver al mapa" remains: no shortcuts past the progression, and
       nothing competing with the game at a child's eye level. */
    expect(screen.queryByRole("navigation", { name: "Mundo" })).toBeNull();
    expect(
      screen
        .getAllByRole("button")
        .map((each) => each.getAttribute("aria-label"))
    ).toEqual(["Volver al mapa"]);

    returnToMap();
    expect(screen.getByRole("navigation", { name: "Mundo" })).toBeInTheDocument();
  });

  it("shows the duende on the map as decoration only", () => {
    const { container } = render(<App />);

    /* Present, but nameless: it guides the eye, not the screen reader, and it
       must never compete with a node for a tap. */
    expect(container.querySelector(".map__duende")).toBeInTheDocument();
    expect(screen.queryAllByRole("img")).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: "El encuentro" }));
    expect(container.querySelector(".map__duende")).toBeNull();
  });

  it("marks each node's state without relying on colour", () => {
    render(<App />);
    const states = screen
      .getAllByRole("button")
      .map((button) => button.querySelector(".world-node__state")?.textContent);
    expect(states).toEqual([
      "Historia",
      "Bloqueado",
      "Bloqueado",
      "Bloqueado",
      "Bloqueado",
      "Bloqueado"
    ]);
  });
});
