"use client";

import { memo } from "react";
import type { GameDiscoveryCardData } from "@/lib/game-discovery";
import { GameDiscoveryCard } from "@/components/games/game-discovery-card";
import { GameModePickerProvider } from "@/components/games/game-mode-picker-context";
import { GameModePreloader } from "@/components/games/game-mode-preloader";

type Props = {
  locale: string;
  games: GameDiscoveryCardData[];
  priorityCount?: number;
  className?: string;
};

export const GameDiscoveryGrid = memo(function GameDiscoveryGrid({
  locale,
  games,
  priorityCount = 4,
  className,
}: Props) {
  return (
    <GameModePickerProvider>
      <GameModePreloader games={games} />
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
