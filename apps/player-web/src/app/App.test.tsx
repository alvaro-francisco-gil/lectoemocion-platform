import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within
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

/** Leaves a resource the child has not finished. */
function returnToMap(): void {
  fireEvent.click(screen.getByRole("button", { name: "Volver al mapa" }));
}

/**
 * Acknowledges the letriestrellas every finish pays, and reports how many.
 *
 * Every finish routes through this screen, so every test that plays a chapter
 * to its end goes through here on the way to whatever comes next.
 */
async function collectStars(): Promise<string> {
  const won = (await screen.findByRole("status")).textContent ?? "";
  expect(won).toMatch(/letriestrellas/);
  fireEvent.click(screen.getByRole("button", { name: "Seguir" }));
  return won;
}

/** The running total in the map's corner. */
function starTotal(): string {
  return (
    screen.getByRole("region", { name: "Letriestrellas" }).textContent ?? ""
  );
}

/**
 * The chapters on the path.
 *
 * Scoped to the world list rather than the whole map, so the corner controls —
 * which are about the app, not about where to go next — never read as places.
 */
function worldButtons(): HTMLElement[] {
  return within(screen.getByRole("navigation", { name: "Mundo" })).getAllByRole(
    "button"
  );
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

    const open = worldButtons().filter(
      (button) => !button.hasAttribute("disabled")
    );
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
    await collectStars();
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
    await collectStars();
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
    await collectStars();
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
    const titles = worldButtons().map(
      (button) => button.querySelector(".world-node__title")?.textContent
    );
    expect(titles).toEqual([
      "El encuentro",
      "El gallo Rayo",
      "Las iniciales",
      "El bosque de parejas",
      "¿Cuál es?",
      "Las primeras letras",
      "El puente de sílabas",
      "El taller de letras",
      "Nuestro álbum"
    ]);
  });

  it("opens and closes the menu from the map", () => {
    render(<App />);
    expect(screen.queryByRole("dialog", { name: "Menú" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Menú" }));
    expect(screen.getByRole("dialog", { name: "Menú" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cerrar el menú" }));
    expect(screen.queryByRole("dialog", { name: "Menú" })).toBeNull();
  });

  /* A panel with no way out is a trap on a device with no back button. */
  it("closes the menu on Escape", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Menú" }));

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Menú" })).toBeNull();
  });

  /* One screen at a time: the map is not left underneath to be tapped through. */
  it("puts the world away while the menu is open", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Menú" }));

    expect(screen.queryByRole("navigation", { name: "Mundo" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Cerrar el menú" }));
    expect(screen.getByRole("navigation", { name: "Mundo" })).toBeInTheDocument();
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

  it("keeps the duende off the map and off a running game", () => {
    const { container } = render(<App />);
    expect(container.querySelector(".duende")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "El encuentro" }));
    expect(container.querySelector(".duende")).toBeNull();
  });

  it("keeps the collection out of the world's list of destinations", () => {
    const { container } = render(<App />);

    /* Slots are a record, not a route: nothing in the row is pressable. */
    expect(container.querySelectorAll(".collection button")).toHaveLength(0);
    expect(collection(container)).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null
    ]);
  });

  it("marks each node's state without relying on colour", () => {
    render(<App />);
    const states = worldButtons().map(
      (button) => button.querySelector(".world-node__state")?.textContent
    );
    expect(states).toEqual([
      "Historia",
      "Bloqueado",
      "Bloqueado",
      "Bloqueado",
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
   * Plays the entry chapter to its end and takes its letriestrellas.
   *
   * Nothing presses "back": finishing a chapter is what brings out the
   * rewards, and a ceremony a child has to go and find is a ceremony most of
   * them will miss.
   */
  async function finishTheFirstChapter(): Promise<void> {
    fireEvent.click(screen.getByRole("button", { name: "El encuentro" }));
    completeActiveResource();
    await collectStars();
  }

  it("offers three chests the first time a chapter is finished", async () => {
    render(<App />);
    await finishTheFirstChapter();

    expect(
      (await screen.findAllByRole("button", { name: /Abrir el cofre/ })).length
    ).toBe(3);
    /* The map is not behind the chests: the ceremony is the whole screen. */
    expect(screen.queryByRole("navigation", { name: "Mundo" })).toBeNull();
  });

  /*
   * The duende belongs to this one moment. He is the framing story's guide, and
   * a guide who is always on screen stops being an event; arriving with the
   * open chest is what makes him worth looking at.
   */
  it("stands the duende with the chests and takes him away at the reveal", async () => {
    const { container } = render(<App />);
    await finishTheFirstChapter();

    /* Present, but nameless: he is who the chests came from, not a fourth
       thing to press, and a screen reader offering him would be offering a
       choice that does not exist. */
    await screen.findByRole("button", { name: "Abrir el cofre 1" });
    expect(container.querySelector(".duende")).toBeInTheDocument();
    expect(screen.queryAllByRole("img")).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: "Abrir el cofre 1" }));

    /* The animal arrives alone. Whatever a child won has the screen to
       itself. */
    expect(await screen.findByRole("status")).toBeInTheDocument();
    expect(container.querySelector(".duende")).toBeNull();
  });

  it("puts the animal from the chest into that chapter's slot", async () => {
    const { container } = render(<App />);
    await finishTheFirstChapter();

    const won = await openChest(2);

    await waitFor(() =>
      expect(collection(container)).toEqual([
        won,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null
      ])
    );
  });

  /* Three chests, three animals: which one the child gets is their choice. */
  it("gives a different animal for a different chest", async () => {
    render(<App />);
    await finishTheFirstChapter();
    const first = await openChest(1);

    /* A fresh start, the same chapter, a different chest. */
    cleanup();
    localStorage.clear();
    createGame.mockClear();
    render(<App />);
    await finishTheFirstChapter();

    expect(await openChest(3)).not.toBe(first);
  });

  it("does not offer chests again for a chapter already rewarded", async () => {
    render(<App />);
    await finishTheFirstChapter();
    await openChest();

    /* Replaying is allowed; being paid an animal twice for it is not. */
    fireEvent.click(
      await screen.findByRole("button", { name: "El encuentro" })
    );
    completeActiveResource();
    await collectStars();

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
    await finishTheFirstChapter();
    await screen.findByRole("button", { name: "Abrir el cofre 1" });

    cleanup();
    render(<App />);

    expect(
      await screen.findByRole("button", { name: "Abrir el cofre 1" })
    ).toBeInTheDocument();
  });

  it("keeps the collection after a reload", async () => {
    render(<App />);
    await finishTheFirstChapter();
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
        null,
        null,
        null,
        null
      ])
    );
  });
});

describe("the letriestrellas every finish is worth", () => {
  beforeEach(() => {
    localStorage.clear();
    createGame.mockClear();
  });

  function finish(node: string): void {
    fireEvent.click(screen.getByRole("button", { name: node }));
    completeActiveResource();
  }

  it("starts a new player at zero", () => {
    render(<App />);
    expect(starTotal()).toBe("0");
  });

  it("pays three stars the moment a chapter is finished", async () => {
    render(<App />);
    finish("El encuentro");

    /* Before the chests: the stars are for playing, the animal is for
       arriving somewhere new, and they are two beats rather than one. */
    expect(await collectStars()).toContain("+3");
    expect(screen.getByRole("button", { name: "Abrir el cofre 1" })).toBeInTheDocument();

    await openChest();
    await waitFor(() => expect(starTotal()).toBe("3"));
  });

  /* The animals are once each; the stars are every time. */
  it("pays again for a replay that owes no chest", async () => {
    render(<App />);
    finish("El encuentro");
    await collectStars();
    await openChest();

    finish("El encuentro");
    expect(await collectStars()).toContain("+3");

    /* Straight back to the map: no second chest for the same chapter. */
    await waitFor(() => expect(starTotal()).toBe("6"));
    expect(screen.queryByRole("button", { name: /Abrir el cofre/ })).toBeNull();
  });

  it("keeps the total after a reload", async () => {
    render(<App />);
    finish("El encuentro");
    await collectStars();
    await openChest();
    await waitFor(() => expect(starTotal()).toBe("3"));

    cleanup();
    render(<App />);

    await waitFor(() => expect(starTotal()).toBe("3"));
  });

  it("keeps the counter off a running game and out of the ceremonies", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "El encuentro" }));
    expect(screen.queryByRole("region", { name: "Letriestrellas" })).toBeNull();

    completeActiveResource();
    await screen.findByRole("status");
    expect(screen.queryByRole("region", { name: "Letriestrellas" })).toBeNull();
  });

  /* A readout, not a route: nothing in the corner opens anything. */
  it("keeps the counter unpressable", () => {
    render(<App />);
    expect(
      screen
        .getByRole("region", { name: "Letriestrellas" })
        .querySelectorAll("button")
    ).toHaveLength(0);
  });
});
