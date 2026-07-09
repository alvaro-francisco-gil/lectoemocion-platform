import { useEffect, useMemo, useRef, useState } from "react";
import {
  createInitialsGameResource,
  createNameStoryResource,
  syntheticClass
} from "@lectoemocion/template-catalog";
import { createGame } from "../game/createGame";

type ResourceChoice = "story" | "game";

export function App() {
  const [choice, setChoice] = useState<ResourceChoice>("story");
  const gameHost = useRef<HTMLDivElement>(null);
  const resource = useMemo(
    () =>
      choice === "story"
        ? createNameStoryResource(syntheticClass, "demo-story")
        : createInitialsGameResource(syntheticClass, "A", "demo-game"),
    [choice]
  );

  useEffect(() => {
    if (!gameHost.current) return;
    const game = createGame(gameHost.current, resource);
    return () => game.destroy(true);
  }, [resource]);

  return (
    <main>
      <header>
        <h1>LectoEmoción</h1>
        <nav aria-label="Recursos">
          <button
            aria-pressed={choice === "story"}
            onClick={() => setChoice("story")}
          >
            Historia de nombres
          </button>
          <button
            aria-pressed={choice === "game"}
            onClick={() => setChoice("game")}
          >
            Juego de iniciales
          </button>
        </nav>
      </header>
      <div ref={gameHost} className="game-host" data-testid="game-host" />
    </main>
  );
}
