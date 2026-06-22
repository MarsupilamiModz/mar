"use client";

import { memo, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SafeImage } from "@/components/ui/safe-image";
import { GameModeSelectionCard } from "@/components/games/game-mode-selection-card";
import type { GameModeCardData, GameModePickerSettings } from "@/lib/game-modes";
import { cn } from "@/lib/utils";

type Props = {
  locale: string;
  gameSlug: string;
  gameName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modes: GameModeCardData[];
  picker: GameModePickerSettings;
};

export const GameModePickerModal = memo(function GameModePickerModal({
  locale,
  gameSlug,
  gameName,
  open,
  onOpenChange,
  modes,
  picker,
}: Props) {
  const t = useTranslations("games");
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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

  const animationClass =
    picker.animation === "scale"
      ? "animate-in zoom-in-95 duration-300"
      : picker.animation === "slide"
        ? "animate-in slide-in-from-bottom-4 duration-300"
        : "animate-in fade-in duration-300";

  if (!modes.length) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[92vh] max-w-3xl overflow-hidden border-white/10 p-0 shadow-2xl sm:rounded-2xl",
          animationClass,
          picker.glowEnabled && "shadow-[0_0_80px_rgba(168,85,247,0.25)]"
        )}
        style={{
          backgroundColor: `rgba(8, 8, 12, ${picker.panelOpacity})`,
          backdropFilter: `blur(${picker.blurPx}px)`,
        }}
      >
        <div className="relative min-h-[420px]">
          {activeBg ? (
            <SafeImage
              src={activeBg}
              alt=""
              fill
              className="object-cover transition-opacity duration-700"
              sizes="800px"
              priority
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-neon-purple/30 via-background to-neon-blue/20" />
          )}
          <div
            className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/30"
            style={{ opacity: picker.overlayOpacity }}
          />

          <div className="relative z-10 flex max-h-[92vh] flex-col">
            <div className="border-b border-white/10 p-6 sm:p-8">
              <DialogHeader className="space-y-2 text-left">
                <DialogTitle className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {gameName}
                </DialogTitle>
                <DialogDescription className="text-base text-muted-foreground">
                  {t("choosePlatform")}
                </DialogDescription>
              </DialogHeader>
            </div>

            <div
              className="grid flex-1 gap-4 overflow-y-auto p-6 sm:grid-cols-2 sm:p-8"
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
                  onSelect={() => onOpenChange(false)}
                />
              ))}
            </div>

            <p className="border-t border-white/10 px-6 py-4 text-center text-sm text-muted-foreground sm:px-8">
              {t("modesAvailable", { count: modes.length })}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});
