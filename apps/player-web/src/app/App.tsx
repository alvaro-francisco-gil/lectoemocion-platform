import { useEffect, useMemo, useRef, useState } from "react";
import type { ResourceManifest } from "@lectoemocion/resource-schema";
import {
  createInitialsGameResource,
  createNameStoryResource,
  createPairsGameResource,
  createSyllablesGameResource,
  createWordPictureGameResource,
  defaultVocabulary
} from "@lectoemocion/template-catalog";
import { createGame } from "../game/createGame";

interface ResourceChoice {
  readonly id: string;
  readonly label: string;
  readonly create: () => ResourceManifest;
}

const CHOICES: readonly ResourceChoice[] = [
  {
    id: "story",
    label: "Historia de nombres",
    create: () => createNameStoryResource("demo-story")
  },
  {
    id: "initials",
    label: "Juego de iniciales",
    create: () => createInitialsGameResource("A", "demo-game")
  },
  {
    id: "pairs",
    label: "Parejas",
    create: () => createPairsGameResource(defaultVocabulary, 3, "demo-pairs")
  },
  {
    id: "word-picture",
    label: "¿Cuál es?",
    create: () =>
      createWordPictureGameResource(defaultVocabulary, "casa", 3, "demo-word")
  },
  {
    id: "syllables",
    label: "Sílabas",
    create: () =>
      createSyllablesGameResource(defaultVocabulary, "mariposa", "demo-syllables")
  }
];

export function App() {
  const [choiceId, setChoiceId] = useState<string>("story");
  const gameHost = useRef<HTMLDivElement>(null);
  const resource = useMemo(() => {
    const choice = CHOICES.find((candidate) => candidate.id === choiceId);
    if (!choice) {
      throw new Error(`Unknown resource choice: ${choiceId}`);
    }
    return choice.create();
  }, [choiceId]);

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
          {CHOICES.map((choice) => (
            <button
              key={choice.id}
              aria-pressed={choice.id === choiceId}
              onClick={() => setChoiceId(choice.id)}
            >
              {choice.label}
            </button>
          ))}
        </nav>
      </header>
      <div ref={gameHost} className="game-host" data-testid="game-host" />
    </main>
  );
}
