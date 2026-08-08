import {
  prizeId,
  prizeImageId,
  type PrizeContent,
  type PrizeId
} from "@lectoemocion/domain";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  awardDue,
  configurePrize,
  derivePrizeView,
  EMPTY_PRIZES
} from "../../world/prizes";
import type { PrizePick } from "../../world/prizeImageStore";
import { AdultArea } from "./index";

const TODAY = new Date("2026-08-07");

function open(overrides: Partial<Parameters<typeof AdultArea>[0]> = {}) {
  const props = {
    view: derivePrizeView(EMPTY_PRIZES, 0),
    today: TODAY,
    onSetGoal: vi.fn(),
    onConfigure: vi.fn(),
    onPickImage: vi.fn(
      async (): Promise<PrizePick> => ({
        ok: true,
        id: prizeImageId("img-0")
      })
    ),
    onDiscardImage: vi.fn(),
    onClose: vi.fn(),
    ...overrides
  };
  render(<AdultArea {...props} />);
  return props;
}

/**
 * Answers the gate the way an adult does: a year tapped into the pad.
 *
 * The same pad the profile drawer puts up, because there is one gate. What it
 * does with the answer is `isAdultBirthYear`'s business and is proven in
 * `AdultGate.test.tsx`; here it is only the door onto this area.
 */
function passGate(year = "1988") {
  for (const digit of year) {
    fireEvent.click(screen.getByRole("button", { name: digit }));
  }
}

describe("the adult gate", () => {
  it("shows nothing of the adult area before it is answered", () => {
    open();
    expect(
      screen.getByRole("dialog", { name: "Sólo para adultos" })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Letriestrellas para el próximo regalo"))
      .toBeNull();
  });

  it("opens the area for a year that would make an adult", () => {
    open();
    passGate();
    expect(
      screen.getByLabelText("Letriestrellas para el próximo regalo")
    ).toBeVisible();
  });

  /* The one year a child might have heard said aloud is their own. */
  it("refuses a year that would make a child, and says so", () => {
    open();
    passGate("2024");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Ese año no puede ser. Inténtalo otra vez."
    );
    expect(screen.queryByLabelText("Letriestrellas para el próximo regalo"))
      .toBeNull();
  });
});

/* A panel with no way out is a trap on a device with no back button. */
describe("closing the area", () => {
  it("closes on Escape while the gate is still asking", () => {
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
    let resolvePick: (pick: PrizePick) => void = () => {};
    const pending = new Promise<PrizePick>((resolve) => {
      resolvePick = resolve;
    });
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
      resolvePick({ ok: true, id: prizeImageId("img-1") });
      await pending;
    });

    fireEvent.click(screen.getByRole("button", { name: "Guardar el regalo" }));
    expect(props.onConfigure).toHaveBeenCalledWith(prizeId("p-1"), {
      kind: "custom",
      text: "un helado",
      imageId: prizeImageId("img-1")
    } satisfies PrizeContent);
  });

  /* Three ways to press a button and be told nothing at all. */
  it("says the gift was saved", () => {
    open({ view: derivePrizeView(waiting, 30) });
    passGate();
    fireEvent.click(
      screen.getByRole("radio", { name: "Encuentra tu regalo en el patio" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Guardar el regalo" }));
    expect(screen.getByRole("status")).toHaveTextContent("Regalo guardado");
  });

  it("says what is missing when nothing has been chosen", () => {
    const props = open({ view: derivePrizeView(waiting, 30) });
    passGate();
    fireEvent.click(screen.getByRole("button", { name: "Guardar el regalo" }));
    expect(props.onConfigure).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Elige qué hay dentro del regalo"
    );
  });

  /*
   * A one-shot confirmation only ever announces the first save of the panel
   * session. Editing an already-prepared gift keeps it in the same list with
   * no remount, which is exactly how the original "no feedback at all" defect
   * survived a second save.
   */
  it("announces a second save of an already prepared gift, not just the first", () => {
    const prepared = configurePrize(
      awardDue(EMPTY_PRIZES, 30, [
        { id: prizeId("p-1"), at: "2026-08-01T10:00:00.000Z" }
      ]),
      prizeId("p-1"),
      { kind: "custom", text: "un helado", imageId: null }
    );
    open({ view: derivePrizeView(prepared, 30) });
    passGate();
    fireEvent.click(screen.getByRole("button", { name: "Guardar el regalo" }));
    const firstSaved = screen.getByRole("status");
    expect(firstSaved).toHaveTextContent("Regalo guardado");

    fireEvent.change(screen.getByLabelText("¿Qué hay dentro?"), {
      target: { value: "un caramelo" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar el regalo" }));
    const secondSaved = screen.getByRole("status");
    expect(secondSaved).toHaveTextContent("Regalo guardado");
    /* A different node, not the same one left with unchanged text: aria-live
       only announces text a screen reader has not already read. */
    expect(secondSaved).not.toBe(firstSaved);
  });

  /*
   * A save that went well and something that went wrong are different kinds of
   * news, so they carry different roles and can be on screen together without
   * either being mistaken for the other. Nothing dismisses the confirmation on
   * the adult's way through the panel — doing that re-rendered this panel
   * inside the interaction and React reverted the radio being selected, which
   * only a real browser caught.
   */
  it("keeps a save confirmation out of the way of a later error", () => {
    open({ view: derivePrizeView(waiting, 30) });
    passGate();
    fireEvent.click(
      screen.getByRole("radio", { name: "Encuentra tu regalo en el patio" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Guardar el regalo" }));
    expect(screen.getByRole("status")).toHaveTextContent("Regalo guardado");

    fireEvent.change(
      screen.getByLabelText("Letriestrellas para el próximo regalo"),
      { target: { value: "0" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("alert")).toHaveTextContent("entre 5 y 200");
    expect(screen.getByRole("status")).toHaveTextContent("Regalo guardado");
  });

  /*
   * The regression the browser found and jsdom did not: selecting a preset
   * must survive whatever else the panel does in the same event. Asserting the
   * radio is checked — rather than only that the form moved on — is what
   * catches a controlled input being reverted mid-interaction.
   */
  it("keeps a chosen place selected after a save has been confirmed", () => {
    open({ view: derivePrizeView(waiting, 30) });
    passGate();
    const patio = screen.getByRole("radio", {
      name: "Encuentra tu regalo en el patio"
    });
    fireEvent.click(patio);
    fireEvent.click(screen.getByRole("button", { name: "Guardar el regalo" }));
    expect(screen.getByRole("status")).toHaveTextContent("Regalo guardado");

    fireEvent.click(screen.getByRole("radio", { name: "Escribirlo yo" }));
    expect(screen.getByRole("radio", { name: "Escribirlo yo" })).toBeChecked();
    expect(screen.getByLabelText("¿Qué hay dentro?")).toBeVisible();
  });
});

/*
 * A gift an adult has already filled in is not a gift to fill in. Listing it
 * again under a blank form is how an adult with two gifts queued fills the
 * same one twice and leaves the other empty.
 */
describe("a gift already prepared", () => {
  const prepared = configurePrize(
    awardDue(EMPTY_PRIZES, 30, [
      { id: prizeId("p-1"), at: "2026-08-01T10:00:00.000Z" }
    ]),
    prizeId("p-1"),
    { kind: "custom", text: "un helado", imageId: null }
  );

  it("is not offered again as a gift waiting to be filled in", () => {
    open({ view: derivePrizeView(prepared, 30) });
    passGate();
    expect(screen.queryByText("Un regalo esperando")).toBeNull();
    expect(screen.getByText("Un regalo listo")).toBeVisible();
  });

  it("shows the words that were chosen rather than an empty form", () => {
    open({ view: derivePrizeView(prepared, 30) });
    passGate();
    expect(screen.getByRole("radio", { name: "Escribirlo yo" })).toBeChecked();
    expect(screen.getByLabelText("¿Qué hay dentro?")).toHaveValue("un helado");
  });

  it("shows a chosen hiding place as the chosen one", () => {
    const preset = configurePrize(prepared, prizeId("p-1"), {
      kind: "preset",
      preset: "mesa"
    });
    open({ view: derivePrizeView(preset, 30) });
    passGate();
    expect(
      screen.getByRole("radio", {
        name: "Encuentra tu regalo debajo de la mesa"
      })
    ).toBeChecked();
  });
});

/*
 * The picture is the optional half. A failed one must say so and must never
 * block the words, which are the half an adult reads aloud.
 */
describe("a picture that did not work", () => {
  const waiting = awardDue(EMPTY_PRIZES, 30, [
    { id: prizeId("p-1"), at: "2026-08-01T10:00:00.000Z" }
  ]);

  function pickPhoto() {
    fireEvent.click(screen.getByRole("radio", { name: "Escribirlo yo" }));
    fireEvent.change(screen.getByLabelText("¿Qué hay dentro?"), {
      target: { value: "un helado" }
    });
    return act(async () => {
      fireEvent.change(screen.getByLabelText("Añadir una foto"), {
        target: {
          files: [new File(["foto"], "foto.png", { type: "image/png" })]
        }
      });
    });
  }

  it("tells the adult, and still saves the words", async () => {
    const props = open({
      view: derivePrizeView(waiting, 30),
      onPickImage: vi.fn(
        async (): Promise<PrizePick> => ({
          ok: false,
          problem: "unreadable-picture"
        })
      )
    });
    passGate();
    await pickPhoto();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "No se pudo usar esa foto"
    );

    fireEvent.click(screen.getByRole("button", { name: "Guardar el regalo" }));
    expect(props.onConfigure).toHaveBeenCalledWith(prizeId("p-1"), {
      kind: "custom",
      text: "un helado",
      imageId: null
    } satisfies PrizeContent);
  });

  it("says so when there was no room to keep it", async () => {
    open({
      view: derivePrizeView(waiting, 30),
      onPickImage: vi.fn(
        async (): Promise<PrizePick> => ({ ok: false, problem: "no-room" })
      )
    });
    passGate();
    await pickPhoto();
    expect(screen.getByRole("alert")).toHaveTextContent("No hay sitio");
  });
});

/*
 * Every picture kept is a key in storage. A picture the prize no longer points
 * at is unreachable for ever unless the screen that replaced it says so.
 */
describe("a picture the prize no longer uses", () => {
  const waiting = awardDue(EMPTY_PRIZES, 30, [
    { id: prizeId("p-1"), at: "2026-08-01T10:00:00.000Z" }
  ]);

  function pickingInTurn() {
    let picked = 0;
    return vi.fn(
      async (): Promise<PrizePick> => ({
        ok: true,
        id: prizeImageId(`img-${++picked}`)
      })
    );
  }

  async function pick() {
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Añadir una foto"), {
        target: {
          files: [new File(["foto"], "foto.png", { type: "image/png" })]
        }
      });
    });
  }

  it("is discarded when the adult picks another one", async () => {
    const props = open({
      view: derivePrizeView(waiting, 30),
      onPickImage: pickingInTurn()
    });
    passGate();
    fireEvent.click(screen.getByRole("radio", { name: "Escribirlo yo" }));
    await pick();
    expect(props.onDiscardImage).not.toHaveBeenCalled();

    await pick();
    expect(props.onDiscardImage).toHaveBeenCalledWith(prizeImageId("img-1"));
    expect(props.onDiscardImage).toHaveBeenCalledTimes(1);
  });

  /*
   * A picture a saved gift still points at is not a draft. Discarding it the
   * moment another is picked would empty the gift the child is about to open
   * if the adult then closes the panel without saving.
   */
  it("is kept until the save that replaces it actually happens", async () => {
    const prepared = configurePrize(waiting, prizeId("p-1"), {
      kind: "custom",
      text: "un helado",
      imageId: prizeImageId("img-9")
    });
    const props = open({
      view: derivePrizeView(prepared, 30),
      onPickImage: pickingInTurn()
    });
    passGate();
    await pick();
    expect(props.onDiscardImage).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Guardar el regalo" }));
    expect(props.onConfigure).toHaveBeenCalledWith(prizeId("p-1"), {
      kind: "custom",
      text: "un helado",
      imageId: prizeImageId("img-1")
    } satisfies PrizeContent);
    expect(props.onDiscardImage).toHaveBeenCalledWith(prizeImageId("img-9"));
    expect(props.onDiscardImage).toHaveBeenCalledTimes(1);
  });

  it("is discarded when the gift is saved as a hiding place instead", async () => {
    const props = open({
      view: derivePrizeView(waiting, 30),
      onPickImage: pickingInTurn()
    });
    passGate();
    fireEvent.click(screen.getByRole("radio", { name: "Escribirlo yo" }));
    await pick();

    fireEvent.click(
      screen.getByRole("radio", { name: "Encuentra tu regalo en el patio" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Guardar el regalo" }));

    expect(props.onConfigure).toHaveBeenCalledWith(prizeId("p-1"), {
      kind: "preset",
      preset: "patio"
    } satisfies PrizeContent);
    expect(props.onDiscardImage).toHaveBeenCalledWith(prizeImageId("img-1"));
  });
});
