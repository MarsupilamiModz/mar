"use client";

import { memo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Layers } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";
import type { GameModeCardData } from "@/lib/game-modes";

type Props = {
  locale: string;
  gameSlug: string;
  mode: GameModeCardData;
  glowEnabled?: boolean;
  onHover?: () => void;
  onSelect?: () => void;
  className?: string;
};

export const GameModeSelectionCard = memo(function GameModeSelectionCard({
  locale,
  gameSlug,
  mode,
  glowEnabled = true,
  onHover,
  onSelect,
  className,
}: Props) {
  const t = useTranslations("games");
  const banner = mode.backgroundUrl ?? mode.bannerUrl ?? mode.thumbnailUrl;
  const href = `/${locale}/games/${gameSlug}/${mode.slug}`;
  const accent = mode.accentColor ?? "#a855f7";

  return (
    <Link
      href={href}
      onClick={onSelect}
      onMouseEnter={onHover}
      onFocus={onHover}
      className={cn("group block", className)}
    >
      <Card
        className={cn(
          "relative overflow-hidden rounded-2xl border-white/15 bg-background/35 backdrop-blur-md transition-all duration-300",
          "hover:-translate-y-1 hover:border-white/30",
          glowEnabled && "hover:shadow-[0_0_32px_var(--mode-glow)]"
        )}
        style={
          {
            borderColor: `${accent}44`,
            "--mode-glow": `${accent}55`,
          } as React.CSSProperties
        }
      >
        <div className="relative aspect-[16/9] overflow-hidden">
          {banner ? (
            <SafeImage
              src={banner}
              alt={mode.name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, 400px"
            />
          ) : (
            <div
              className="absolute inset-0 bg-gradient-to-br from-neon-purple/25 to-neon-blue/15"
              style={{ background: `linear-gradient(135deg, ${accent}44, transparent)` }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          {(mode.logoUrl || mode.iconUrl) && (
            <div className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-white/20 bg-background/80 p-1">
              <SafeImage
                src={mode.logoUrl ?? mode.iconUrl!}
                alt=""
                fill
                className="object-contain p-0.5"
                sizes="40px"
              />
            </div>
          )}
        </div>
        <div className="p-4">
          <h3 className="text-lg font-bold transition-colors group-hover:text-neon-purple">
            {mode.name}
          </h3>
          {mode.description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{mode.description}</p>
          )}
          <p className="mt-2 text-xs" style={{ color: accent }}>
            {t("modsCount", { count: mode.modCount })}
          </p>
        </div>
      </Card>
    </Link>
  );
});

export const GameModeSelectionCardSkeleton = memo(function GameModeSelectionCardSkeleton() {
  return (
    <Card className="overflow-hidden rounded-2xl border-border/40 animate-pulse bg-background/30">
      <div className="aspect-[16/9] bg-muted/40" />
      <div className="space-y-2 p-4">
        <div className="h-5 w-2/3 rounded bg-muted/50" />
        <div className="h-3 w-full rounded bg-muted/30" />
      </div>
    </Card>
  );
});

export const GameModeEmptyIcon = memo(function GameModeEmptyIcon() {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/30">
      <Layers className="h-6 w-6 text-muted-foreground/50" />
    </div>
  );
});
