import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
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

/** Opens a chest and acknowledges the animal inside, landing back on the map. */
async function openChest(which = 1): Promise<string> {
  const chest = await screen.findByRole("button", {
    name: `Abrir el cofre ${which}`
  });
  fireEvent.click(chest);

  const won = (await screen.findByRole("status")).textContent ?? "";
  fireEvent.click(screen.getByRole("button", { name: "Seguir" }));
  return won.replace(/[¡!]/g, "");
}

/** The animals on the map, in world order — `null` for a slot still to fill. */
function collection(container: HTMLElement): (string | null)[] {
  return [...container.querySelectorAll(".collection__slot")].map((slot) =>
    slot.getAttribute("data-filled") === "true"
      ? (slot.querySelector(".collection__name")?.textContent ?? "")
      : null
  );
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
    await openChest();

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
    await openChest();

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
    await openChest();
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

  it("keeps the collection out of the world's list of destinations", () => {
    const { container } = render(<App />);

    /* Slots are a record, not a route: nothing in the row is pressable. */
    expect(container.querySelectorAll(".collection button")).toHaveLength(0);
    expect(collection(container)).toEqual([null, null, null, null, null, null]);
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

describe("the chest a chapter is worth", () => {
  beforeEach(() => {
    localStorage.clear();
    createGame.mockClear();
  });

  /**
   * Plays the entry chapter to its end.
   *
   * Nothing presses "back": finishing a chapter for the first time is what
   * brings out the chests, and a ceremony a child has to go and find is a
   * ceremony most of them will miss.
   */
  function finishTheFirstChapter(): void {
    fireEvent.click(screen.getByRole("button", { name: "El encuentro" }));
    completeActiveResource();
  }

  it("offers three chests the first time a chapter is finished", async () => {
    render(<App />);
    finishTheFirstChapter();

    expect(
      (await screen.findAllByRole("button", { name: /Abrir el cofre/ })).length
    ).toBe(3);
    /* The map is not behind the chests: the ceremony is the whole screen. */
    expect(screen.queryByRole("navigation", { name: "Mundo" })).toBeNull();
  });

  it("puts the animal from the chest into that chapter's slot", async () => {
    const { container } = render(<App />);
    finishTheFirstChapter();

    const won = await openChest(2);

    await waitFor(() =>
      expect(collection(container)).toEqual([won, null, null, null, null, null])
    );
  });

  /* Three chests, three animals: which one the child gets is their choice. */
  it("gives a different animal for a different chest", async () => {
    render(<App />);
    finishTheFirstChapter();
    const first = await openChest(1);

    /* A fresh start, the same chapter, a different chest. */
    cleanup();
    localStorage.clear();
    createGame.mockClear();
    render(<App />);
    finishTheFirstChapter();

    expect(await openChest(3)).not.toBe(first);
  });

  it("does not offer chests again for a chapter already rewarded", async () => {
    render(<App />);
    finishTheFirstChapter();
    await openChest();

    /* Replaying is allowed; being paid twice for it is not. */
    fireEvent.click(
      await screen.findByRole("button", { name: "El encuentro" })
    );
    completeActiveResource();
    returnToMap();

    await waitFor(() =>
      expect(screen.getByRole("navigation", { name: "Mundo" })).toBeInTheDocument()
    );
    expect(screen.queryByRole("button", { name: /Abrir el cofre/ })).toBeNull();
  });

  /*
   * The ceremony is derived from what is stored, not from what happened in
   * this session, so a tab closed between the last frame and the chests still
   * owes the child their animal.
   */
  it("still owes the chests after the page is reloaded", async () => {
    render(<App />);
    finishTheFirstChapter();
    await screen.findByRole("button", { name: "Abrir el cofre 1" });

    cleanup();
    render(<App />);

    expect(
      await screen.findByRole("button", { name: "Abrir el cofre 1" })
    ).toBeInTheDocument();
  });

  it("keeps the collection after a reload", async () => {
    render(<App />);
    finishTheFirstChapter();
    const won = await openChest();

    cleanup();
    const remounted = render(<App />);

    await waitFor(() =>
      expect(collection(remounted.container)).toEqual([
        won,
        null,
        null,
        null,
        null,
        null
      ])
    );
  });
});
