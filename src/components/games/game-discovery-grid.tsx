"use client";

import { memo } from "react";
import type { GameDiscoveryCardData } from "@/lib/game-discovery";
import { GameDiscoveryCard } from "@/components/games/game-discovery-card";
import { GameModePickerProvider } from "@/components/games/game-mode-picker-context";
import { GameModePreloader } from "@/components/games/game-mode-preloader";
import {
  GAMES_PAGE_GRID_CLASS,
  HOME_GAMES_GRID_CLASS,
} from "@/components/games/game-grid-layout";

type Props = {
  locale: string;
  games: GameDiscoveryCardData[];
  priorityCount?: number;
  /** "games" = /games (5 cols desktop); "home" = homepage featured row */
  layout?: "games" | "home";
  className?: string;
};

export const GameDiscoveryGrid = memo(function GameDiscoveryGrid({
  locale,
  games,
  priorityCount = 6,
  layout = "home",
  className,
}: Props) {
  const gridClass = className ?? (layout === "games" ? GAMES_PAGE_GRID_CLASS : HOME_GAMES_GRID_CLASS);
  return (
    <GameModePickerProvider>
      <GameModePreloader games={games} eager />
      <div className={gridClass}>
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
