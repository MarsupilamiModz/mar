"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { GameModeCardData, GameModePickerSettings } from "@/lib/game-modes";
import { prefetchGameModeAssets } from "@/lib/image-prefetch";
import { GameModePickerModal } from "@/components/games/game-mode-picker-modal";

export type GameModePickerPayload = {
  locale: string;
  gameSlug: string;
  gameName: string;
  modes: GameModeCardData[];
  picker: GameModePickerSettings;
};

type ContextValue = {
  open: (payload: GameModePickerPayload) => void;
  close: () => void;
  warm: (modes: GameModeCardData[]) => void;
};

const GameModePickerContext = createContext<ContextValue | null>(null);

export function GameModePickerProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<GameModePickerPayload | null>(null);
  const [open, setOpen] = useState(false);

  const warm = useCallback((modes: GameModeCardData[]) => {
    prefetchGameModeAssets(modes);
  }, []);

  const openPicker = useCallback((next: GameModePickerPayload) => {
    prefetchGameModeAssets(next.modes);
    setPayload(next);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const value = useMemo(
    () => ({ open: openPicker, close, warm }),
    [openPicker, close, warm]
  );

  return (
    <GameModePickerContext.Provider value={value}>
      {children}
      <GameModePickerModal
        locale={payload?.locale ?? "en"}
        gameSlug={payload?.gameSlug ?? ""}
        gameName={payload?.gameName ?? ""}
        modes={payload?.modes ?? []}
        picker={
          payload?.picker ?? {
            overlayOpacity: 0.72,
            blurPx: 0,
            glowEnabled: true,
            animation: "fade",
            panelOpacity: 0.92,
          }
        }
        open={open && Boolean(payload?.modes.length)}
        onClose={close}
      />
    </GameModePickerContext.Provider>
  );
}

export function useGameModePicker() {
  const ctx = useContext(GameModePickerContext);
  if (!ctx) {
    throw new Error("useGameModePicker must be used within GameModePickerProvider");
  }
  return ctx;
}

export function useGameModePickerOptional() {
  return useContext(GameModePickerContext);
}
