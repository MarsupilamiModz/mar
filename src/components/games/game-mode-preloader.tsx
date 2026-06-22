"use client";

import { memo, useEffect } from "react";
import type { GameDiscoveryCardData } from "@/lib/game-discovery";
import { prefetchGameModeAssets, scheduleIdlePrefetch } from "@/lib/image-prefetch";
import { useGameModePickerOptional } from "@/components/games/game-mode-picker-context";

export const GameModePreloader = memo(function GameModePreloader({
  games,
}: {
  games: Pick<GameDiscoveryCardData, "modeCount" | "modeBundle">[];
}) {
  const picker = useGameModePickerOptional();

  useEffect(() => {
    const bundles = games
      .filter((g) => g.modeCount > 1 && g.modeBundle?.modes.length)
      .map((g) => g.modeBundle!.modes);

    if (bundles.length === 0) return;

    scheduleIdlePrefetch(() => {
      for (const modes of bundles) {
        prefetchGameModeAssets(modes);
        picker?.warm(modes);
      }
    });
  }, [games, picker]);

  return null;
});
