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
  const [state, setState] = useState<(GameModePickerPayload & { visible: boolean }) | null>(null);

  const warm = useCallback((modes: GameModeCardData[]) => {
    prefetchGameModeAssets(modes);
  }, []);

  const open = useCallback((payload: GameModePickerPayload) => {
    prefetchGameModeAssets(payload.modes);
    setState({ ...payload, visible: true });
  }, []);

  const close = useCallback(() => {
    setState((prev) => (prev ? { ...prev, visible: false } : null));
  }, []);

  const value = useMemo(() => ({ open, close, warm }), [open, close, warm]);

  return (
    <GameModePickerContext.Provider value={value}>
      {children}
      {state && state.modes.length > 0 && (
        <GameModePickerModal
          locale={state.locale}
          gameSlug={state.gameSlug}
          gameName={state.gameName}
          modes={state.modes}
          picker={state.picker}
          open={state.visible}
          onClose={close}
        />
      )}
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

/** Optional hook — no-op when provider is absent (e.g. storybook). */
export function useGameModePickerOptional() {
  return useContext(GameModePickerContext);
}
