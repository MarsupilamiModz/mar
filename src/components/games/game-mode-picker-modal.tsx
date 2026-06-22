"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { GameModeSelectionCard } from "@/components/games/game-mode-selection-card";
import type { GameModeCardData, GameModePickerSettings } from "@/lib/game-modes";
import { prefetchedBackgroundStyle } from "@/lib/image-prefetch";
import { cn } from "@/lib/utils";

type Props = {
  locale: string;
  gameSlug: string;
  gameName: string;
  open: boolean;
  onClose: () => void;
  modes: GameModeCardData[];
  picker: GameModePickerSettings;
};

export const GameModePickerModal = memo(function GameModePickerModal({
  locale,
  gameSlug,
  gameName,
  open,
  onClose,
  modes,
  picker,
}: Props) {
  const t = useTranslations("games");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const dragY = useRef(0);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const activeBg = useMemo(() => {
    const hovered = modes.find((m) => m.id === hoveredId);
    return (
      hovered?.backgroundUrl ??
      modes.find((m) => m.backgroundUrl)?.backgroundUrl ??
      modes[0]?.bannerUrl ??
      modes[0]?.thumbnailUrl ??
      null
    );
  }, [hoveredId, modes]);

  const handleOverlayPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    dragY.current = e.touches[0]?.clientY ?? 0;
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const endY = e.changedTouches[0]?.clientY ?? 0;
      if (endY - dragY.current > 80) onClose();
    },
    [onClose]
  );

  if (!mounted || modes.length === 0) return null;

  return createPortal(
    <div
      className={cn(
        "game-mode-picker-root fixed inset-0 z-[100]",
        open ? "pointer-events-auto" : "pointer-events-none"
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Close"
        tabIndex={open ? 0 : -1}
        className={cn(
          "absolute inset-0 bg-[#050508]/88 transition-opacity duration-100",
          open ? "opacity-100" : "opacity-0"
        )}
        onPointerDown={handleOverlayPointerDown}
      />

      <div
        className="pointer-events-none fixed inset-0 z-[101] flex items-end justify-center sm:items-center sm:p-6"
        role="dialog"
        aria-modal={open}
        aria-labelledby="game-mode-picker-title"
        aria-hidden={!open}
      >
        <div
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          className={cn(
            "game-mode-picker-panel pointer-events-auto relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden",
            "rounded-t-2xl border border-white/10 sm:rounded-2xl",
            "transition-[transform,opacity] duration-150 ease-out",
            open
              ? "opacity-100"
              : "opacity-0",
            picker.glowEnabled && open && "shadow-[0_0_64px_rgba(168,85,247,0.22)]"
          )}
          style={{
            backgroundColor: `rgba(8, 8, 12, ${picker.panelOpacity})`,
            transform: open ? "translate3d(0,0,0) scale(1)" : "translate3d(0,12px,0) scale(0.98)",
            willChange: "transform, opacity",
          }}
        >
          <div className="absolute inset-x-0 top-2 flex justify-center sm:hidden">
            <span className="h-1 w-10 rounded-full bg-white/25" aria-hidden />
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="absolute right-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white hover:bg-black/80"
            aria-label="Close"
            tabIndex={open ? 0 : -1}
          >
            <X className="h-5 w-5" />
          </button>

          <div className="relative min-h-[380px] flex-1 overflow-hidden">
            <div
              className="absolute inset-0 bg-gradient-to-br from-neon-purple/25 via-[#08080c] to-neon-blue/15"
              aria-hidden
            />
            {activeBg && (
              <div
                className="absolute inset-0"
                style={prefetchedBackgroundStyle(activeBg)}
                aria-hidden
              />
            )}
            <div
              className="absolute inset-0 bg-gradient-to-t from-[#08080c] via-[#08080c]/75 to-[#08080c]/25"
              style={{ opacity: picker.overlayOpacity }}
              aria-hidden
            />

            <div className="relative z-10 flex max-h-[92vh] flex-col">
              <div className="border-b border-white/10 px-6 pb-5 pt-10 sm:p-8">
                <h2 id="game-mode-picker-title" className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {gameName}
                </h2>
                <p className="mt-2 text-base text-muted-foreground">{t("choosePlatform")}</p>
              </div>

              <div
                className="grid flex-1 gap-4 overflow-y-auto overscroll-contain p-6 sm:grid-cols-2 sm:p-8"
                onMouseLeave={() => setHoveredId(null)}
              >
                {modes.map((mode) => (
                  <GameModeSelectionCard
                    key={mode.id}
                    locale={locale}
                    gameSlug={gameSlug}
                    mode={mode}
                    glowEnabled={picker.glowEnabled}
                    onHover={() => setHoveredId(mode.id)}
                    onSelect={onClose}
                  />
                ))}
              </div>

              <p className="border-t border-white/10 px-6 py-4 text-center text-sm text-muted-foreground sm:px-8">
                {t("modesAvailable", { count: modes.length })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
});
