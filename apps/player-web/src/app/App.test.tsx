import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
  type RenderResult
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChildRecord } from "@lectoemocion/domain";
import { worldNodes } from "@lectoemocion/resource-schema";
import { syntheticClass, world } from "@lectoemocion/template-catalog";
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

/** Moves to a section by its label in the bottom bar. */
function openTab(name: string): void {
  fireEvent.click(
    within(screen.getByRole("navigation", { name: "Secciones" })).getByRole(
      "button",
      { name }
    )
  );
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

/** What the section on screen reads as, left to right. */
function pathTitles(): (string | null | undefined)[] {
  return worldButtons().map(
    (button) => button.querySelector(".world-node__title")?.textContent
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

/**
 * Renders the shell and waits for it to know who is playing.
 *
 * The world is not interactive until the profile read lands — a chapter
 * finished before then would have no profile to pay — so every test has to
 * wait for the same thing a child waits for.
 */
async function renderApp(
  props: { readonly roster?: readonly ChildRecord[] } = {}
): Promise<RenderResult> {
  const result = render(<App {...props} />);
  await screen.findAllByRole("button", { name: /^Quién juega/ });
  return result;
}

/** Opens the drawer from the avatar in the world's top-left corner. */
async function openProfiles(): Promise<void> {
  fireEvent.click(await screen.findByRole("button", { name: /^Quién juega/ }));
}

/** Taps a year into the adult gate's pad, digit by digit. */
function tapYear(year: string): void {
  for (const digit of year) {
    fireEvent.click(screen.getByRole("button", { name: digit }));
  }
}

/**
 * Gets past the adult gate.
 *
 * A year old enough to be an adult's, typed on the pad the way a parent would
 * rather than written into state, so these tests fail if the pad stops working.
 */
function passAdultGate(): void {
  expect(
    screen.getByRole("dialog", { name: "Sólo para adultos" })
  ).toBeInTheDocument();
  tapYear("1988");
}

/**
 * The animals, in world order — `null` for a slot still to fill.
 *
 * The collection is a screen now, so reading it means opening it: this goes in,
 * reads the row, and closes it again, leaving the caller where it found them.
 */
function collection(container: HTMLElement): (string | null)[] {
  fireEvent.click(screen.getByRole("button", { name: "Mis animales" }));
  const slots = [...container.querySelectorAll(".collection__slot")].map(
    (slot) =>
      slot.getAttribute("data-filled") === "true"
        ? (slot.querySelector(".collection__name")?.textContent ?? "")
        : null
  );
  fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
  return slots;
}

describe("the world shell", () => {
  beforeEach(() => {
    localStorage.clear();
    createGame.mockClear();
  });

  it("starts on the map with only the entry node open", async () => {
    await renderApp();
    expect(createGame).not.toHaveBeenCalled();

    const open = worldButtons().filter(
      (button) => !button.hasAttribute("disabled")
    );
    expect(
      open.map((button) => button.querySelector(".world-node__title")?.textContent)
    ).toEqual(["El encuentro"]);
  });

  it("refuses to open a locked node", async () => {
    await renderApp();

    fireEvent.click(screen.getByRole("button", { name: "Las iniciales" }));

    expect(createGame).not.toHaveBeenCalled();
  });

  it("opens a resource and returns to the map", async () => {
    await renderApp();
    fireEvent.click(screen.getByRole("button", { name: "El encuentro" }));
    expect(createGame).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Volver al mapa" }));
    await waitFor(() =>
      expect(screen.getByRole("navigation", { name: "Mundo" })).toBeInTheDocument()
    );
  });

  it("unlocks the next node once the first is completed", async () => {
    await renderApp();
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
    await renderApp();
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
    await renderApp();
    fireEvent.click(screen.getByRole("button", { name: "El encuentro" }));
    completeActiveResource();
    await collectStars();
    await openChest();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Las iniciales" })
      ).not.toBeDisabled()
    );

    const remounted = await renderApp();
    await waitFor(() =>
      expect(
        remounted.getAllByRole("button", { name: "Las iniciales" }).at(-1)
      ).not.toBeDisabled()
    );
  });

  it("opens and closes the menu from the child's own face", async () => {
    await renderApp();
    expect(screen.queryByRole("dialog", { name: "Quién juega" })).toBeNull();

    await openProfiles();
    expect(screen.getByRole("dialog", { name: "Quién juega" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cerrar el menú" }));
    expect(screen.queryByRole("dialog", { name: "Quién juega" })).toBeNull();
  });

  /* A panel with no way out is a trap on a device with no back button. */
  it("closes the menu on Escape", async () => {
    await renderApp();
    await openProfiles();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Quién juega" })).toBeNull();
  });

  /*
   * The reverse of what this file asserted before profiles existed.
   *
   * The menu used to take the whole screen so there was nothing underneath to
   * tap through. It is a drawer now, and the world stays visible on purpose —
   * a child needs to see the game is still there and they are coming back. The
   * mis-tap that justified the old behaviour is handled by the scrim instead,
   * which is what the next test proves.
   */
  it("leaves the world visible behind the drawer", async () => {
    await renderApp();
    await openProfiles();

    expect(screen.getByRole("navigation", { name: "Mundo" })).toBeInTheDocument();
  });

  /*
   * The scrim is the visual half of this and a stylesheet cannot be trusted to
   * be the whole of it: a missed `pointer-events` rule is a child dropped into
   * a game they never chose. The shell refuses the tap as well, which is the
   * half that can be proven here.
   */
  it("refuses to open a chapter while the drawer is up", async () => {
    const { container } = await renderApp();
    await openProfiles();

    expect(container.querySelector(".profile-menu__scrim")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "El encuentro" }));
    expect(createGame).not.toHaveBeenCalled();
  });

  it("closes when the scrim is tapped", async () => {
    const { container } = await renderApp();
    await openProfiles();

    fireEvent.click(container.querySelector(".profile-menu__scrim")!);

    expect(screen.queryByRole("dialog", { name: "Quién juega" })).toBeNull();
  });

  it("hides the world list while a resource is playing", async () => {
    await renderApp();
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

  it("keeps the duende off the map and off a running game", async () => {
    const { container } = await renderApp();
    expect(container.querySelector(".duende")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "El encuentro" }));
    expect(container.querySelector(".duende")).toBeNull();
  });

  it("keeps the collection out of the world's list of destinations", async () => {
    const { container } = await renderApp();

    /* One slot per chapter, counted from the world rather than listed here. */
    expect(collection(container)).toEqual(worldNodes(world).map(() => null));
  });

  /*
   * Each card is its own colour, and no two beside each other share one. The
   * picture is what a child navigates by and the colour is what makes it carry
   * across a room, so two neighbours in the same tint would cost a landmark.
   */
  it("gives neighbouring cards different colours", async () => {
    await renderApp();
    const tints = worldButtons().map((button) =>
      button.getAttribute("data-tint")
    );

    expect(tints.every((tint) => tint !== null)).toBe(true);
    for (const [index, tint] of tints.entries()) {
      if (index > 0) expect(tint).not.toBe(tints[index - 1]);
    }
  });

  /* Colour is decoration over a card that already says what it is. */
  it("never lets colour be the only thing that says a card is finished", async () => {
    await renderApp();
    const entry = screen.getByRole("button", { name: "El encuentro" });
    expect(entry.querySelector(".world-node__state")?.textContent).toBe(
      "Historia"
    );
  });

  it("marks each node's state without relying on colour", async () => {
    await renderApp();
    const states = worldButtons().map(
      (button) => button.querySelector(".world-node__state")?.textContent
    );
    /* The entry chapter, then every game waiting behind it. */
    expect(states).toEqual([
      "Historia",
      ...worldNodes(world)
        .filter((node) => node.surface === "juegos")
        .slice(1)
        .map(() => "Bloqueado")
    ]);
  });
});

/**
 * The one chapter an adult has to act on.
 *
 * *El libro de los nombres* is the class's own names, so with nobody recorded
 * there is nothing to open. It stands on the shelf saying what it needs rather
 * than hiding, because an adult who cannot see the feature will never add the
 * names it is asking for.
 */
describe("the book of names before there are any names", () => {
  beforeEach(() => {
    localStorage.clear();
    createGame.mockClear();
  });

  const book = () => screen.getByRole("button", { name: "El libro de los nombres" });

  it("says what it needs instead of saying it is blocked", async () => {
    await renderApp({ roster: [] });
    openTab("Recursos");

    expect(book().querySelector(".world-node__state")?.textContent).toBe(
      "Faltan los nombres"
    );
    expect(book().querySelector(".world-node__note")?.textContent).toBe(
      "Añade los nombres y las fotos de los niños para abrir este libro"
    );
  });

  it("cannot be opened", async () => {
    await renderApp({ roster: [] });
    openTab("Recursos");

    fireEvent.click(book());
    expect(createGame).not.toHaveBeenCalled();
  });

  it("leaves the story beside it open", async () => {
    await renderApp({ roster: [] });
    openTab("Recursos");

    fireEvent.click(screen.getByRole("button", { name: "El gallo Rayo" }));
    expect(createGame).toHaveBeenCalledTimes(1);
  });

  it("opens once there are names, and builds a book of them", async () => {
    await renderApp({ roster: syntheticClass });
    openTab("Recursos");

    expect(book().querySelector(".world-node__note")).toBeNull();
    fireEvent.click(book());

    const resource = createGame.mock.calls.at(-1)?.[1] as {
      template: { id: string };
      pages: readonly { grapheme: string }[];
    };
    expect(resource.template.id).toBe("name-book");
    expect(resource.pages[0]?.grapheme).toBe("A");
  });
});

/**
 * The three sections along the bottom.
 *
 * Juegos is the progression and Recursos is the shelf; Multijugador is a door
 * with nothing behind it yet, shown shut rather than left out, so the shape of
 * the app does not change the day it opens.
 */
describe("the three sections", () => {
  beforeEach(() => {
    localStorage.clear();
    createGame.mockClear();
  });

  it("opens on Juegos, with every game and nothing from the shelf", async () => {
    await renderApp();
    expect(pathTitles()).toEqual([
      "El encuentro",
      "Las iniciales",
      "El bosque de parejas",
      "¿Cuál es?",
      "Las primeras letras",
      "El puente de sílabas",
      "El taller de letras",
      "Empieza igual",
      "Nuestro álbum"
    ]);
  });

  it("shows the shelf under Recursos, and only the shelf", async () => {
    await renderApp();
    openTab("Recursos");
    expect(pathTitles()).toEqual(["El gallo Rayo", "El libro de los nombres"]);
  });

  /* A book a child has to unlock is a book most of them never open. */
  it("opens the story from the shelf on a brand new profile", async () => {
    await renderApp();
    openTab("Recursos");

    fireEvent.click(screen.getByRole("button", { name: "El gallo Rayo" }));

    expect(createGame).toHaveBeenCalledTimes(1);
  });

  /* Stars for reading it, and a chest the first time: what a chapter is worth
     does not depend on which section it was reached from. */
  it("pays the story its stars and its chest", async () => {
    await renderApp();
    openTab("Recursos");
    fireEvent.click(screen.getByRole("button", { name: "El gallo Rayo" }));
    completeActiveResource();

    expect(await collectStars()).toContain("+3");
    expect(
      await screen.findByRole("button", { name: "Abrir el cofre 1" })
    ).toBeInTheDocument();
  });

  /* Leaving lands back on the shelf: a child is put back where they were, not
     where the app opens. */
  it("returns to the section the resource was opened from", async () => {
    await renderApp();
    openTab("Recursos");
    fireEvent.click(screen.getByRole("button", { name: "El gallo Rayo" }));
    returnToMap();

    await waitFor(() =>
      expect(pathTitles()).toEqual(["El gallo Rayo", "El libro de los nombres"])
    );
  });

  it("marks the section a child is standing in", async () => {
    await renderApp();
    const bar = () => screen.getByRole("navigation", { name: "Secciones" });
    expect(within(bar()).getByRole("button", { name: "Juegos" })).toHaveAttribute(
      "aria-current",
      "page"
    );

    openTab("Recursos");
    expect(
      within(bar()).getByRole("button", { name: "Recursos" })
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(bar()).getByRole("button", { name: "Juegos" })
    ).not.toHaveAttribute("aria-current");
  });

  /* Shut, and said to be shut: dimming alone tells a screen reader nothing. */
  it("keeps Multijugador shut and inert", async () => {
    await renderApp();
    const bar = screen.getByRole("navigation", { name: "Secciones" });
    const blocked = within(bar).getByRole("button", { name: /Multijugador/ });

    expect(blocked).toBeDisabled();
    expect(blocked.textContent).toContain("Bloqueado");

    fireEvent.click(blocked);
    /* Still on the games: a shut section is refused, not merely dimmed. */
    expect(pathTitles()).toContain("El encuentro");
  });

  /* Chrome belongs to the world screens. A game gets the screen to itself. */
  it("takes the bar and the collection away while a resource plays", async () => {
    await renderApp();
    fireEvent.click(screen.getByRole("button", { name: "El encuentro" }));

    expect(screen.queryByRole("navigation", { name: "Secciones" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mis animales" })).toBeNull();
  });
});

describe("the collection screen", () => {
  beforeEach(() => {
    localStorage.clear();
    createGame.mockClear();
  });

  it("opens from the corner and closes again", async () => {
    await renderApp();
    expect(screen.queryByRole("dialog", { name: "Mis animales" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Mis animales" }));
    expect(
      screen.getByRole("dialog", { name: "Mis animales" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByRole("dialog", { name: "Mis animales" })).toBeNull();
  });

  /* A screen with no way out is a trap on a device with no back button. */
  it("closes on Escape", async () => {
    await renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Mis animales" }));

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Mis animales" })).toBeNull();
  });

  /* One screen at a time: the world is not left underneath to be tapped
     through. */
  it("puts the world away while it is open", async () => {
    await renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Mis animales" }));

    expect(screen.queryByRole("navigation", { name: "Mundo" })).toBeNull();
  });

  /* Slots are a record, not a route. */
  it("keeps every slot unpressable", async () => {
    const { container } = await renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Mis animales" }));

    expect(
      container.querySelectorAll(".collection__slots button")
    ).toHaveLength(0);
  });

  it("reaches the collection from the shelf as well as the games", async () => {
    await renderApp();
    openTab("Recursos");

    fireEvent.click(screen.getByRole("button", { name: "Mis animales" }));
    expect(
      screen.getByRole("dialog", { name: "Mis animales" })
    ).toBeInTheDocument();
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
    await renderApp();
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
    const { container } = await renderApp();
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
    const { container } = await renderApp();
    await finishTheFirstChapter();

    const won = await openChest(2);

    await waitFor(() =>
      expect(collection(container)).toEqual([
        won,
        ...worldNodes(world).slice(1).map(() => null)
      ])
    );
  });

  /* Three chests, three animals: which one the child gets is their choice. */
  it("gives a different animal for a different chest", async () => {
    await renderApp();
    await finishTheFirstChapter();
    const first = await openChest(1);

    /* A fresh start, the same chapter, a different chest. */
    cleanup();
    localStorage.clear();
    createGame.mockClear();
    await renderApp();
    await finishTheFirstChapter();

    expect(await openChest(3)).not.toBe(first);
  });

  it("does not offer chests again for a chapter already rewarded", async () => {
    await renderApp();
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
    await renderApp();
    await finishTheFirstChapter();
    await screen.findByRole("button", { name: "Abrir el cofre 1" });

    cleanup();
    await renderApp();

    expect(
      await screen.findByRole("button", { name: "Abrir el cofre 1" })
    ).toBeInTheDocument();
  });

  it("keeps the collection after a reload", async () => {
    await renderApp();
    await finishTheFirstChapter();
    const won = await openChest();

    cleanup();
    const remounted = await renderApp();

    await waitFor(() =>
      expect(collection(remounted.container)).toEqual([
        won,
        ...worldNodes(world).slice(1).map(() => null)
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

  it("starts a new player at zero", async () => {
    await renderApp();
    expect(starTotal()).toBe("0");
  });

  it("pays three stars the moment a chapter is finished", async () => {
    await renderApp();
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
    await renderApp();
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
    await renderApp();
    finish("El encuentro");
    await collectStars();
    await openChest();
    await waitFor(() => expect(starTotal()).toBe("3"));

    cleanup();
    await renderApp();

    await waitFor(() => expect(starTotal()).toBe("3"));
  });

  it("keeps the counter off a running game and out of the ceremonies", async () => {
    await renderApp();
    fireEvent.click(screen.getByRole("button", { name: "El encuentro" }));
    expect(screen.queryByRole("region", { name: "Letriestrellas" })).toBeNull();

    completeActiveResource();
    await screen.findByRole("status");
    expect(screen.queryByRole("region", { name: "Letriestrellas" })).toBeNull();
  });

  /* A readout, not a route: nothing in the corner opens anything. */
  it("keeps the counter unpressable", async () => {
    await renderApp();
    expect(
      screen
        .getByRole("region", { name: "Letriestrellas" })
        .querySelectorAll("button")
    ).toHaveLength(0);
  });
});

/*
 * Who is playing.
 *
 * The device has always had exactly one implicit player. These prove it can
 * have several without any of them losing what they have already won, and that
 * the machinery for changing them stays out of a child's reach.
 */
describe("profiles", () => {
  beforeEach(() => {
    localStorage.clear();
    createGame.mockClear();
  });

  it("names the child whose face is in the corner", async () => {
    await renderApp();

    expect(
      await screen.findByRole("button", { name: "Quién juega: Peque" })
    ).toBeInTheDocument();
  });

  /*
   * The reason the starter profile is given the id the progress store has
   * always used. A family that has played for a term must not open the app
   * after this change and find an empty world.
   */
  it("hands the stars already on the device to the starter profile", async () => {
    /* Stars only: a completed node would owe chests, and the ceremony for them
       would be on screen instead of the map this asserts about. */
    localStorage.setItem(
      "lectoemocion.progress.local",
      JSON.stringify({
        completedNodes: [],
        lastPlayedNode: null,
        rewards: [],
        stars: 27
      })
    );

    await renderApp();

    await waitFor(() => expect(starTotal()).toBe("27"));
  });

  it("gives a new child a world of their own without touching the first one", async () => {
    await renderApp();
    fireEvent.click(screen.getByRole("button", { name: "El encuentro" }));
    completeActiveResource();
    await collectStars();
    await openChest();
    await waitFor(() => expect(starTotal()).toBe("3"));

    await openProfiles();
    fireEvent.click(screen.getByRole("button", { name: "Añadir niño" }));
    passAdultGate();
    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Vera" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(starTotal()).toBe("0"));
    expect(
      screen.getByRole("button", { name: "Quién juega: Vera" })
    ).toBeInTheDocument();
  });

  it("gives each child back their own stars when they are chosen again", async () => {
    await renderApp();
    fireEvent.click(screen.getByRole("button", { name: "El encuentro" }));
    completeActiveResource();
    await collectStars();
    await openChest();
    await waitFor(() => expect(starTotal()).toBe("3"));

    await openProfiles();
    fireEvent.click(screen.getByRole("button", { name: "Añadir niño" }));
    passAdultGate();
    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Vera" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(starTotal()).toBe("0"));

    await openProfiles();
    fireEvent.click(screen.getByRole("button", { name: "Jugar como Peque" }));

    await waitFor(() => expect(starTotal()).toBe("3"));
  });

  /* Switching is the one thing a child may do here unaided. */
  it("lets a child change to another profile with no gate", async () => {
    await renderApp();
    await openProfiles();
    fireEvent.click(screen.getByRole("button", { name: "Añadir niño" }));
    passAdultGate();
    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Vera" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await openProfiles();
    fireEvent.click(screen.getByRole("button", { name: "Jugar como Peque" }));

    expect(
      screen.queryByRole("dialog", { name: "Sólo para adultos" })
    ).toBeNull();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Quién juega: Peque" })
      ).toBeInTheDocument()
    );
  });

  it("asks for an adult's year before it will add a child", async () => {
    await renderApp();
    await openProfiles();

    fireEvent.click(screen.getByRole("button", { name: "Añadir niño" }));

    expect(
      screen.getByRole("dialog", { name: "Sólo para adultos" })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Nombre")).toBeNull();
  });

  it("asks for an adult's year before it will edit a child", async () => {
    await renderApp();
    await openProfiles();

    fireEvent.click(screen.getByRole("button", { name: "Editar a Peque" }));

    expect(
      screen.getByRole("dialog", { name: "Sólo para adultos" })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Nombre")).toBeNull();
  });

  /* The one year a child might have heard said aloud is their own. */
  it("refuses a year too recent to be an adult's", async () => {
    await renderApp();
    await openProfiles();
    fireEvent.click(screen.getByRole("button", { name: "Añadir niño" }));

    tapYear("2024");

    expect(screen.queryByLabelText("Nombre")).toBeNull();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("records the name, the picture and the month an adult supplies", async () => {
    await renderApp();
    await openProfiles();
    fireEvent.click(screen.getByRole("button", { name: "Editar a Peque" }));
    passAdultGate();

    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Vera" }
    });
    fireEvent.click(screen.getByRole("radio", { name: "Búho" }));
    fireEvent.change(screen.getByLabelText("Mes"), { target: { value: "6" } });
    fireEvent.change(screen.getByLabelText("Año"), { target: { value: "2021" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Quién juega: Vera" })
      ).toBeInTheDocument()
    );

    await openProfiles();
    const row = screen.getByRole("dialog", { name: "Quién juega" });
    expect(row.textContent).toContain("Vera");
    expect(row.textContent).toMatch(/años/);
  });

  /* Nobody has said when this child was born, and the app must not pretend. */
  it("offers to fill in a birth date rather than inventing an age", async () => {
    await renderApp();
    await openProfiles();

    const drawer = screen.getByRole("dialog", { name: "Quién juega" });
    expect(drawer.textContent).toContain("Añadir fecha");
    expect(drawer.textContent).not.toMatch(/años/);
  });

  it("will not delete the only child on the device", async () => {
    await renderApp();
    await openProfiles();
    fireEvent.click(screen.getByRole("button", { name: "Editar a Peque" }));
    passAdultGate();

    expect(screen.queryByRole("button", { name: "Borrar" })).toBeNull();
  });

  it("deletes a child, and the stars that were theirs, once confirmed", async () => {
    await renderApp();
    await openProfiles();
    fireEvent.click(screen.getByRole("button", { name: "Añadir niño" }));
    passAdultGate();
    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Vera" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Quién juega: Vera" })
      ).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "El encuentro" }));
    completeActiveResource();
    await collectStars();
    await openChest();
    await waitFor(() => expect(starTotal()).toBe("3"));

    await openProfiles();
    fireEvent.click(screen.getByRole("button", { name: "Editar a Vera" }));
    passAdultGate();
    fireEvent.click(screen.getByRole("button", { name: "Borrar" }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, borrar a Vera" }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Quién juega: Peque" })
      ).toBeInTheDocument()
    );
    /* Vera was the only child who had played, so her namespace was the only
       progress on the device — and deleting her must take it with her. */
    expect(
      Object.keys(localStorage).filter((key) =>
        key.startsWith("lectoemocion.progress.")
      )
    ).toEqual([]);
  });

  /* Planned work, shown as planned. Neither pretends to be ready. */
  it("shows the rows that are not built yet as unavailable", async () => {
    await renderApp();
    await openProfiles();

    expect(screen.getByRole("button", { name: /Progreso/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Zona de adultos/ })).toBeDisabled();
  });
});
