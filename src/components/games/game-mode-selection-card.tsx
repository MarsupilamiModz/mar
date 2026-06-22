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
  onSelect?: () => void;
  className?: string;
};

export const GameModeSelectionCard = memo(function GameModeSelectionCard({
  locale,
  gameSlug,
  mode,
  onSelect,
  className,
}: Props) {
  const t = useTranslations("games");
  const banner = mode.bannerUrl ?? mode.thumbnailUrl;
  const href = `/${locale}/games/${gameSlug}/${mode.slug}`;

  return (
    <Link href={href} onClick={onSelect} className={cn("group block", className)}>
      <Card
        className="relative overflow-hidden rounded-2xl border-border/50 bg-background/40 transition-all duration-300 hover:-translate-y-0.5 hover:border-neon-purple/50 hover:shadow-[0_0_28px_rgba(168,85,247,0.2)]"
        style={mode.accentColor ? { borderColor: `${mode.accentColor}55` } : undefined}
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
              style={mode.accentColor ? { background: `linear-gradient(135deg, ${mode.accentColor}44, transparent)` } : undefined}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
          {mode.iconUrl && (
            <div className="absolute left-3 top-3 h-9 w-9 overflow-hidden rounded-lg border border-white/20 bg-background/80">
              <SafeImage src={mode.iconUrl} alt="" fill className="object-contain p-1" sizes="36px" />
            </div>
          )}
        </div>
        <div className="p-4">
          <h3 className="font-bold text-lg group-hover:text-neon-purple transition-colors">{mode.name}</h3>
          {mode.description && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{mode.description}</p>
          )}
          <p className="mt-2 text-xs text-neon-blue">
            {t("modsCount", { count: mode.modCount })}
          </p>
        </div>
      </Card>
    </Link>
  );
});

export const GameModeSelectionCardSkeleton = memo(function GameModeSelectionCardSkeleton() {
  return (
    <Card className="overflow-hidden rounded-2xl border-border/40 animate-pulse">
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
