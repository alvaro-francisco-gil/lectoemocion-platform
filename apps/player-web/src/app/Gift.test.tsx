import { prizeId, type Prize } from "@lectoemocion/domain";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Gift } from "./Gift";

const ID = prizeId("p-1");
const BASE = { id: ID, awardedAt: "2026-08-01T10:00:00.000Z", costStars: 30 };

const UNCONFIGURED: Prize = { ...BASE, state: "unconfigured" };
const READY_PRESET: Prize = {
  ...BASE,
  state: "ready",
  content: { kind: "preset", preset: "patio" }
};
const OPENED_CUSTOM: Prize = {
  ...BASE,
  state: "opened",
  content: { kind: "custom", text: "un helado", imageId: null },
  openedAt: "2026-08-02T10:00:00.000Z"
};

function show(prize: Prize, imageUrl: string | null = null) {
  const props = {
    prize,
    imageUrl,
    onOpen: vi.fn(),
    onPrepare: vi.fn(),
    onContinue: vi.fn()
  };
  render(<Gift {...props} />);
  return props;
}

describe("a gift nobody has filled yet", () => {
  it("cannot be opened", () => {
    show(UNCONFIGURED);
    expect(screen.queryByRole("button", { name: "¡Ábrelo!" })).toBeNull();
  });

  it("offers the adult a way to fill it", () => {
    const props = show(UNCONFIGURED);
    fireEvent.click(screen.getByRole("button", { name: "Preparar el regalo" }));
    expect(props.onPrepare).toHaveBeenCalled();
  });

  it("lets the child carry on rather than trapping them in front of it", () => {
    const props = show(UNCONFIGURED);
    fireEvent.click(screen.getByRole("button", { name: "Seguir" }));
    expect(props.onContinue).toHaveBeenCalled();
  });
});

describe("a gift that is ready", () => {
  it("opens on one press", () => {
    const props = show(READY_PRESET);
    fireEvent.click(screen.getByRole("button", { name: "¡Ábrelo!" }));
    expect(props.onOpen).toHaveBeenCalledWith(ID);
  });

  it("shows nothing of what is inside before it is opened", () => {
    show(READY_PRESET);
    expect(screen.queryByText("Encuentra tu regalo en el patio")).toBeNull();
  });
});

describe("a gift that is open", () => {
  it("shows the preset's picture and its phrase", () => {
    render(
      <Gift
        prize={{ ...BASE, state: "opened", content: { kind: "preset", preset: "patio" },
          openedAt: "2026-08-02T10:00:00.000Z" }}
        imageUrl={null}
        onOpen={vi.fn()}
        onPrepare={vi.fn()}
        onContinue={vi.fn()}
      />
    );
    expect(screen.getByText("Encuentra tu regalo en el patio")).toBeVisible();
    expect(screen.getByTestId("prize-illustration-patio")).toBeVisible();
  });

  it("shows the adult's words, and their picture when there is one", () => {
    show(OPENED_CUSTOM, "data:image/jpeg;base64,AAAA");
    expect(screen.getByText("un helado")).toBeVisible();
    expect(screen.getByAltText("")).toHaveAttribute(
      "src",
      "data:image/jpeg;base64,AAAA"
    );
  });

  it("shows the words alone when the picture could not be stored", () => {
    show(OPENED_CUSTOM, null);
    expect(screen.getByText("un helado")).toBeVisible();
    expect(screen.queryByRole("img")).toBeNull();
  });
});
