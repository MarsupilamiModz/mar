"use client";

import { memo, useCallback, useLayoutEffect, useRef } from "react";
import type { GameDiscoveryCardData } from "@/lib/game-discovery";
import { prefetchGameModeAssets, prefetchImages } from "@/lib/image-prefetch";
import { useGameModePickerOptional } from "@/components/games/game-mode-picker-context";

export const GameModePreloader = memo(function GameModePreloader({
  games,
  eager = false,
}: {
  games: Pick<
    GameDiscoveryCardData,
    "modeCount" | "modeBundle" | "bannerUrl" | "coverUrl" | "logoUrl"
  >[];
  eager?: boolean;
}) {
  const picker = useGameModePickerOptional();
  const ranRef = useRef(false);

  const preload = useCallback(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    for (const game of games) {
      prefetchImages([game.bannerUrl, game.coverUrl, game.logoUrl]);
      if (game.modeCount > 1 && game.modeBundle?.modes.length) {
        prefetchGameModeAssets(game.modeBundle.modes);
        picker?.warm(game.modeBundle.modes);
      }
    }
  }, [games, picker]);

  useLayoutEffect(() => {
    if (eager) {
      preload();
      return;
    }
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(preload, { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }
    const t = window.setTimeout(preload, 32);
    return () => window.clearTimeout(t);
  }, [eager, preload]);

  return null;
});
