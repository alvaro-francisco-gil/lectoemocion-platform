import {
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

/** Plays the entry chapter to its end, banking the letriestrellas it pays. */
async function finishTheFirstChapter(): Promise<void> {
  fireEvent.click(screen.getByRole("button", { name: "El encuentro" }));
  createGame.mock.calls.at(-1)?.[2]();

  await screen.findByRole("status");
  fireEvent.click(screen.getByRole("button", { name: "Seguir" }));

  fireEvent.click(await screen.findByRole("button", { name: "Abrir el cofre 1" }));
  await screen.findByRole("status");
  fireEvent.click(screen.getByRole("button", { name: "Seguir" }));
  await screen.findByRole("navigation", { name: "Mundo" });
}

function openMenu(): void {
  fireEvent.click(screen.getByRole("button", { name: "Menú" }));
}

function closeMenu(): void {
  fireEvent.click(screen.getByRole("button", { name: "Cerrar el menú" }));
}

/** Writes a coupon the way an adult does: through the menu's form. */
async function createCoupon(label: string, cost: number): Promise<void> {
  openMenu();
  fireEvent.change(screen.getByLabelText("Premio"), { target: { value: label } });
  fireEvent.change(screen.getByLabelText("Letriestrellas"), {
    target: { value: String(cost) }
  });
  fireEvent.click(screen.getByRole("button", { name: "Crear" }));
  await screen.findByRole("button", { name: `Editar ${label}` });
  closeMenu();
  await screen.findByRole("navigation", { name: "Mundo" });
}

/** The stars themselves are the way in, once there is anything to spend them on. */
function openShop(): void {
  fireEvent.click(screen.getByRole("button", { name: /Ver los premios/ }));
}

/**
 * The balance the map shows in its corner, whether or not it is pressable.
 *
 * The counter is a readout with no coupons and a control with them, so the
 * number is read through the label both states share rather than through a role
 * that changes underneath the test.
 */
function mapBalance(): string {
  return screen.getByLabelText(/letriestrellas/i).textContent ?? "";
}

function historyLabels(): string[] {
  return within(screen.getByRole("region", { name: "Ya conseguidos" }))
    .queryAllByRole("listitem")
    .map((entry) => entry.textContent ?? "");
}

describe("premios bought with letriestrellas", () => {
  beforeEach(() => {
    localStorage.clear();
    createGame.mockClear();
  });

  it("offers no shop until an adult has promised something", async () => {
    render(<App />);
    await screen.findByRole("navigation", { name: "Mundo" });

    expect(screen.queryByRole("button", { name: /Ver los premios/ })).toBeNull();
    /* A readout, not a disabled target: pressing must never do nothing. */
    expect(
      screen.getByRole("region", { name: "Letriestrellas" })
    ).toBeInTheDocument();
  });

  it("turns the stars themselves into the way in", async () => {
    render(<App />);
    await createCoupon("Fútbol", 3);

    expect(screen.queryByRole("region", { name: "Letriestrellas" })).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "0 letriestrellas. Ver los premios" })
    );

    expect(
      await screen.findByRole("main", { name: "Premios" })
    ).toBeInTheDocument();
  });

  it("opens the shop once a coupon exists", async () => {
    render(<App />);
    await createCoupon("30 minutos de fútbol", 3);

    openShop();

    expect(
      await screen.findByRole("button", {
        name: "30 minutos de fútbol, 3 letriestrellas"
      })
    ).toBeInTheDocument();
  });

  it("shows a coupon the child cannot afford, but refuses it", async () => {
    render(<App />);
    await createCoupon("Un cuento extra", 5);
    openShop();

    const coupon = await screen.findByRole("button", {
      name: "Un cuento extra, 5 letriestrellas"
    });
    expect(coupon).toBeDisabled();
    expect(coupon).toHaveAttribute("data-affordable", "false");
    expect(historyLabels()).toEqual([]);
  });

  it("spends the stars, tells the child, and records the purchase", async () => {
    render(<App />);
    await createCoupon("30 minutos de fútbol", 3);
    await finishTheFirstChapter();
    expect(mapBalance()).toContain("3");

    openShop();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "30 minutos de fútbol, 3 letriestrellas"
      })
    );

    /* The prize is announced before anything else happens. */
    expect(await screen.findByRole("status")).toHaveTextContent(
      "¡30 minutos de fútbol!"
    );
    fireEvent.click(screen.getByRole("button", { name: "Seguir" }));

    const history = await screen.findByRole("region", {
      name: "Ya conseguidos"
    });
    expect(within(history).getByRole("listitem")).toHaveTextContent(
      "30 minutos de fútbol"
    );
    expect(screen.getByLabelText("Letriestrellas para gastar")).toHaveTextContent(
      "0"
    );
  });

  it("charges the map's counter too", async () => {
    render(<App />);
    await createCoupon("Fútbol", 3);
    await finishTheFirstChapter();

    openShop();
    fireEvent.click(
      await screen.findByRole("button", { name: "Fútbol, 3 letriestrellas" })
    );
    fireEvent.click(await screen.findByRole("button", { name: "Seguir" }));
    fireEvent.click(
      await screen.findByRole("button", { name: /Volver al mapa/ })
    );

    await waitFor(() => expect(mapBalance()).toContain("0"));
  });

  it("keeps the coupon on the shelf, out of reach until it is earned again", async () => {
    render(<App />);
    await createCoupon("Fútbol", 3);
    await finishTheFirstChapter();

    openShop();
    fireEvent.click(
      await screen.findByRole("button", { name: "Fútbol, 3 letriestrellas" })
    );
    fireEvent.click(await screen.findByRole("button", { name: "Seguir" }));

    expect(
      await screen.findByRole("button", { name: "Fútbol, 3 letriestrellas" })
    ).toBeDisabled();
  });

  it("remembers the purchase across a session", async () => {
    render(<App />);
    await createCoupon("Fútbol", 3);
    await finishTheFirstChapter();
    openShop();
    fireEvent.click(
      await screen.findByRole("button", { name: "Fútbol, 3 letriestrellas" })
    );
    fireEvent.click(await screen.findByRole("button", { name: "Seguir" }));
    await screen.findByRole("region", { name: "Ya conseguidos" });

    const reopened = render(<App />);
    fireEvent.click(
      (await reopened.findAllByRole("button", { name: /Ver los premios/ })).at(
        -1
      ) ??
        document.body
    );

    const shops = await reopened.findAllByRole("region", {
      name: "Ya conseguidos"
    });
    expect(shops.at(-1)).toHaveTextContent("Fútbol");
  });
});

describe("the adult's coupon list", () => {
  beforeEach(() => {
    localStorage.clear();
    createGame.mockClear();
  });

  it("refuses a coupon with no name, and says why", async () => {
    render(<App />);
    openMenu();

    fireEvent.change(screen.getByLabelText("Letriestrellas"), {
      target: { value: "5" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Escribe qué se puede conseguir."
    );
    expect(screen.getByText("Todavía no has creado ningún premio.")).toBeInTheDocument();
  });

  it("refuses a price that is not a whole number of letriestrellas", async () => {
    render(<App />);
    openMenu();

    fireEvent.change(screen.getByLabelText("Premio"), {
      target: { value: "Medio premio" }
    });
    fireEvent.change(screen.getByLabelText("Letriestrellas"), {
      target: { value: "2.5" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El precio son letriestrellas enteras."
    );
  });

  it("edits a coupon in place", async () => {
    render(<App />);
    await createCoupon("Fútbol", 3);
    openMenu();

    fireEvent.click(screen.getByRole("button", { name: "Editar Fútbol" }));
    fireEvent.change(screen.getByLabelText("Premio"), {
      target: { value: "45 minutos de fútbol" }
    });
    fireEvent.change(screen.getByLabelText("Letriestrellas"), {
      target: { value: "9" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(
      await screen.findByRole("button", { name: "Editar 45 minutos de fútbol" })
    ).toBeInTheDocument();
    expect(screen.getByText("9 letriestrellas")).toBeInTheDocument();
  });

  it("asks a second time before deleting", async () => {
    render(<App />);
    await createCoupon("Fútbol", 3);
    openMenu();

    fireEvent.click(screen.getByRole("button", { name: "Borrar Fútbol" }));
    fireEvent.click(screen.getByRole("button", { name: "No" }));
    expect(
      screen.getByRole("button", { name: "Editar Fútbol" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Borrar Fútbol" }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, borrar" }));

    expect(
      await screen.findByText("Todavía no has creado ningún premio.")
    ).toBeInTheDocument();
  });

  it("closes the shop door again when the last coupon is deleted", async () => {
    render(<App />);
    await createCoupon("Fútbol", 3);
    openMenu();

    fireEvent.click(screen.getByRole("button", { name: "Borrar Fútbol" }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, borrar" }));
    closeMenu();

    await screen.findByRole("navigation", { name: "Mundo" });
    expect(screen.queryByRole("button", { name: /Ver los premios/ })).toBeNull();
  });

  it("keeps a purchase readable after its coupon is deleted", async () => {
    render(<App />);
    await createCoupon("Fútbol", 3);
    await finishTheFirstChapter();
    openShop();
    fireEvent.click(
      await screen.findByRole("button", { name: "Fútbol, 3 letriestrellas" })
    );
    fireEvent.click(await screen.findByRole("button", { name: "Seguir" }));
    fireEvent.click(
      await screen.findByRole("button", { name: /Volver al mapa/ })
    );

    openMenu();
    fireEvent.click(await screen.findByRole("button", { name: "Borrar Fútbol" }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, borrar" }));

    const history = await screen.findByRole("region", {
      name: "Premios conseguidos"
    });
    expect(within(history).getByRole("listitem")).toHaveTextContent("Fútbol");
  });
});
