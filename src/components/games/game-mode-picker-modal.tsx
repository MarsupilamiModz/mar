"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { GameModeSelectionCard } from "@/components/games/game-mode-selection-card";
import type { GameModeCardData, GameModePickerSettings } from "@/lib/game-modes";
import { isImagePrefetched, prefetchedBackgroundStyle } from "@/lib/image-prefetch";
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

const OPEN_MS = 0.16;
const CLOSE_MS = 0.12;

const overlayMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: OPEN_MS } },
  exit: { opacity: 0, transition: { duration: CLOSE_MS } },
};

const panelMotion = {
  initial: { opacity: 0, scale: 0.97, y: 12 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: OPEN_MS, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: 8,
    transition: { duration: CLOSE_MS, ease: "easeIn" },
  },
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
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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

  const bgReady = isImagePrefetched(activeBg);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  if (!mounted || !modes.length) return null;

  return createPortal(
    <AnimatePresence mode="wait">
      {open && (
        <motion.div
          key="game-mode-picker"
          className="game-mode-picker-root fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
          initial="initial"
          animate="animate"
          exit="exit"
          role="dialog"
          aria-modal="true"
          aria-labelledby="game-mode-picker-title"
        >
          <motion.button
            type="button"
            aria-label="Close"
            className="absolute inset-0 cursor-default bg-[#050508]/85"
            style={{
              backdropFilter: picker.blurPx ? `blur(${Math.min(picker.blurPx, 8)}px)` : undefined,
            }}
            variants={overlayMotion}
            onClick={handleOverlayClick}
          />

          <motion.div
            ref={panelRef}
            className={cn(
              "game-mode-picker-panel relative z-[101] flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden",
              "rounded-t-2xl border border-white/10 sm:rounded-2xl",
              picker.glowEnabled && "shadow-[0_0_64px_rgba(168,85,247,0.22)]"
            )}
            style={{
              backgroundColor: `rgba(8, 8, 12, ${picker.panelOpacity})`,
              willChange: "transform, opacity",
              transform: "translate3d(0,0,0)",
            }}
            variants={panelMotion}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.35 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 72 || info.velocity.y > 420) onClose();
            }}
          >
            <div className="absolute inset-x-0 top-2 flex justify-center sm:hidden">
              <span className="h-1 w-10 rounded-full bg-white/25" aria-hidden />
            </div>

            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white transition-opacity hover:bg-black/70"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="relative min-h-[380px] flex-1 overflow-hidden">
              <div
                className="absolute inset-0 bg-gradient-to-br from-neon-purple/25 via-[#08080c] to-neon-blue/15"
                aria-hidden
              />
              {activeBg && (
                <div
                  className={cn(
                    "absolute inset-0 transition-opacity duration-150",
                    bgReady ? "opacity-100" : "opacity-0"
                  )}
                  style={prefetchedBackgroundStyle(activeBg)}
                  aria-hidden
                />
              )}
              <div
                className="absolute inset-0 bg-gradient-to-t from-[#08080c] via-[#08080c]/70 to-[#08080c]/30"
                style={{ opacity: picker.overlayOpacity }}
                aria-hidden
              />

              <div className="relative z-10 flex max-h-[92vh] flex-col">
                <div className="border-b border-white/10 px-6 pb-5 pt-8 sm:p-8">
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
});
