import {
  prizeId,
  prizeImageId,
  type PrizeContent,
  type PrizeId
} from "@lectoemocion/domain";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { derivePrizeView, EMPTY_PRIZES, awardDue } from "../../world/prizes";
import { AdultArea } from "./index";

const NOW = 2026;

function open(overrides: Partial<Parameters<typeof AdultArea>[0]> = {}) {
  const props = {
    view: derivePrizeView(EMPTY_PRIZES, 0),
    currentYear: NOW,
    onSetGoal: vi.fn(),
    onConfigure: vi.fn(),
    onPickImage: vi.fn(async () => null),
    onClose: vi.fn(),
    ...overrides
  };
  render(<AdultArea {...props} />);
  return props;
}

/** Answers the gate the way an adult does. */
function passGate(year = 1988) {
  fireEvent.change(screen.getByLabelText("¿En qué año naciste?"), {
    target: { value: String(year) }
  });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
}

describe("the adult gate", () => {
  it("shows nothing of the adult area before it is answered", () => {
    open();
    expect(screen.queryByLabelText("Letriestrellas para el próximo regalo"))
      .toBeNull();
  });

  it("opens the area for a year that would make an adult", () => {
    open();
    passGate(1988);
    expect(
      screen.getByLabelText("Letriestrellas para el próximo regalo")
    ).toBeVisible();
  });

  it("refuses a year a child would type and says so", () => {
    open();
    passGate(7);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Ese año no puede ser. Inténtalo otra vez."
    );
    expect(screen.queryByLabelText("Letriestrellas para el próximo regalo"))
      .toBeNull();
  });

  it("refuses a year that would make a child", () => {
    open();
    passGate(NOW - 5);
    expect(screen.getByRole("alert")).toBeVisible();
  });
});

/* A panel with no way out is a trap on a device with no back button. */
describe("closing the area", () => {
  it("closes on Escape, gate answered or not", () => {
    const props = open();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape once the gate has been passed", () => {
    const props = open();
    passGate();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});

describe("the goal", () => {
  it("saves a goal an adult typed", () => {
    const props = open();
    passGate();
    fireEvent.change(
      screen.getByLabelText("Letriestrellas para el próximo regalo"),
      { target: { value: "12" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(props.onSetGoal).toHaveBeenCalledWith(12);
  });

  it("refuses a goal outside the range and does not save it", () => {
    const props = open();
    passGate();
    fireEvent.change(
      screen.getByLabelText("Letriestrellas para el próximo regalo"),
      { target: { value: "0" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(props.onSetGoal).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("entre 5 y 200");
  });
});

describe("configuring a waiting gift", () => {
  const waiting = awardDue(EMPTY_PRIZES, 30, [
    { id: prizeId("p-1"), at: "2026-08-01T10:00:00.000Z" }
  ]);

  it("lists a gift that is waiting to be filled", () => {
    open({ view: derivePrizeView(waiting, 30) });
    passGate();
    expect(screen.getByText("Un regalo esperando")).toBeVisible();
  });

  it("saves a preset the adult chose", () => {
    const props = open({ view: derivePrizeView(waiting, 30) });
    passGate();
    fireEvent.click(
      screen.getByRole("radio", { name: "Encuentra tu regalo en el patio" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Guardar el regalo" }));
    expect(props.onConfigure).toHaveBeenCalledWith(prizeId("p-1"), {
      kind: "preset",
      preset: "patio"
    } satisfies PrizeContent);
  });

  it("saves custom words with no picture", () => {
    const props = open({ view: derivePrizeView(waiting, 30) });
    passGate();
    fireEvent.click(screen.getByRole("radio", { name: "Escribirlo yo" }));
    fireEvent.change(screen.getByLabelText("¿Qué hay dentro?"), {
      target: { value: "  un helado  " }
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar el regalo" }));
    expect(props.onConfigure).toHaveBeenCalledWith(prizeId("p-1"), {
      kind: "custom",
      text: "un helado",
      imageId: null
    } satisfies PrizeContent);
  });

  it("refuses custom words that are empty", () => {
    const props = open({ view: derivePrizeView(waiting, 30) });
    passGate();
    fireEvent.click(screen.getByRole("radio", { name: "Escribirlo yo" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar el regalo" }));
    expect(props.onConfigure).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Escribe qué hay dentro");
  });

  it("does not lose a photo picked while the pick is still processing", async () => {
    let resolvePick: (id: ReturnType<typeof prizeImageId> | null) => void =
      () => {};
    const pending = new Promise<ReturnType<typeof prizeImageId> | null>(
      (resolve) => {
        resolvePick = resolve;
      }
    );
    const props = open({
      view: derivePrizeView(waiting, 30),
      onPickImage: vi.fn(() => pending)
    });
    passGate();
    fireEvent.click(screen.getByRole("radio", { name: "Escribirlo yo" }));
    fireEvent.change(screen.getByLabelText("¿Qué hay dentro?"), {
      target: { value: "un helado" }
    });
    const file = new File(["foto"], "foto.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Añadir una foto"), {
      target: { files: [file] }
    });

    /* The pick has not resolved yet: an attempt to save now must not go
       through with the photo silently dropped. */
    fireEvent.click(screen.getByRole("button", { name: "Guardar el regalo" }));
    expect(props.onConfigure).not.toHaveBeenCalled();

    await act(async () => {
      resolvePick(prizeImageId("img-1"));
      await pending;
    });

    fireEvent.click(screen.getByRole("button", { name: "Guardar el regalo" }));
    expect(props.onConfigure).toHaveBeenCalledWith(prizeId("p-1"), {
      kind: "custom",
      text: "un helado",
      imageId: prizeImageId("img-1")
    } satisfies PrizeContent);
  });
});
