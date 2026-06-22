"use client";

import { memo } from "react";
import type { GameDiscoveryCardData } from "@/lib/game-discovery";
import { GameDiscoveryCard } from "@/components/games/game-discovery-card";
import { GameModePickerProvider } from "@/components/games/game-mode-picker-context";
import { GameModePreloader } from "@/components/games/game-mode-preloader";
import { GAME_DISCOVERY_GRID_CLASS } from "@/components/games/game-grid-layout";

type Props = {
  locale: string;
  games: GameDiscoveryCardData[];
  priorityCount?: number;
  className?: string;
};

export const GameDiscoveryGrid = memo(function GameDiscoveryGrid({
  locale,
  games,
  priorityCount = 6,
  className = GAME_DISCOVERY_GRID_CLASS,
}: Props) {
  return (
    <GameModePickerProvider>
      <GameModePreloader games={games} eager />
      <div className={className}>
        {games.map((game, i) => (
          <GameDiscoveryCard
            key={game.id}
            locale={locale}
            game={game}
            priority={i < priorityCount}
          />
        ))}
      </div>
    </GameModePickerProvider>
  );
});
