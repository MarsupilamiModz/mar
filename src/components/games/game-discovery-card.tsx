"use client";

import { memo, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Download, Gamepad2, Sparkles, TrendingUp, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SafeImage } from "@/components/ui/safe-image";
import { useGameModePickerOptional } from "@/components/games/game-mode-picker-context";
import { formatCompactCount, type GameDiscoveryCardData } from "@/lib/game-discovery";
import { prefetchGameModeAssets } from "@/lib/image-prefetch";

type Props = {
  locale: string;
  game: GameDiscoveryCardData;
  priority?: boolean;
};

function parseDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isRecentlyUpdated(value: Date | string | null | undefined): boolean {
  const date = parseDate(value);
  if (!date) return false;
  return Date.now() - date.getTime() < 14 * 86_400_000;
}

export const GameDiscoveryCard = memo(function GameDiscoveryCard({
  locale,
  game,
  priority = false,
}: Props) {
  const t = useTranslations("games");
  const router = useRouter();
  const picker = useGameModePickerOptional();

  const coverSrc = game.coverUrl;
  const showPopular = game.downloadCount >= 500 || game.modCount >= 40;
  const showNew = isRecentlyUpdated(game.lastUpdated);

  const imageSizes = useMemo(
    () => "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw",
    []
  );

  const navigate = useCallback(
    (path: string) => {
      router.push(path);
    },
    [router]
  );

  const warmAssets = useCallback(() => {
    if (game.modeBundle?.modes.length) {
      prefetchGameModeAssets(game.modeBundle.modes);
      picker?.warm(game.modeBundle.modes);
    }
  }, [game.modeBundle, picker]);

  const handleClick = useCallback(() => {
    if (game.soleModeSlug) {
      navigate(`/${locale}/games/${game.slug}/${game.soleModeSlug}`);
      return;
    }
    if (game.modeCount > 1 && game.modeBundle) {
      picker?.open({
        locale,
        gameSlug: game.slug,
        gameName: game.name,
        modes: game.modeBundle.modes,
        picker: game.modeBundle.picker,
      });
      return;
    }
    navigate(`/${locale}/games/${game.slug}`);
  }, [game, locale, navigate, picker]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onMouseEnter={warmAssets}
      onFocus={warmAssets}
      onKeyDown={handleKeyDown}
      className="group mx-auto w-full max-w-[280px] cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-neon-purple rounded-2xl"
    >
      <Card className="relative flex h-full flex-col overflow-hidden rounded-2xl border-border/50 bg-background/40 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-neon-purple/50 hover:shadow-[0_8px_32px_rgba(168,85,247,0.22)]">
        <div className="relative aspect-[2/3] w-full shrink-0 overflow-hidden bg-muted/20">
          {coverSrc ? (
            <SafeImage
              src={coverSrc}
              alt={game.name}
              fill
              priority={priority}
              loading={priority ? "eager" : "lazy"}
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              sizes={imageSizes}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neon-purple/25 to-neon-blue/10">
              <Gamepad2 className="h-16 w-16 text-muted-foreground/35" />
            </div>
          )}

          <div className="absolute inset-x-0 top-0 flex flex-wrap gap-1.5 p-2.5 sm:p-3">
            {game.isFeatured && (
              <Badge variant="premium" className="text-[10px] shadow-md sm:text-xs">
                {t("featured")}
              </Badge>
            )}
            {showNew && (
              <Badge
                variant="outline"
                className="border-neon-blue/50 bg-background/85 text-[10px] text-neon-blue sm:text-xs"
              >
                <Sparkles className="mr-1 h-3 w-3" />
                {t("new")}
              </Badge>
            )}
            {showPopular && !game.isFeatured && (
              <Badge variant="outline" className="border-neon-purple/50 bg-background/85 text-[10px] sm:text-xs">
                <TrendingUp className="mr-1 h-3 w-3 text-neon-purple" />
                {t("popular")}
              </Badge>
            )}
            {game.modeCount > 1 && (
              <Badge variant="outline" className="ml-auto bg-background/80 text-[10px] sm:text-xs">
                {t("modesAvailable", { count: game.modeCount })}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 p-3 sm:p-4">
          <div className="min-h-0">
            <h3 className="line-clamp-2 text-base font-bold leading-snug tracking-tight text-foreground transition-colors duration-150 group-hover:text-neon-purple sm:text-lg">
              {game.name}
            </h3>
            {game.shortDescription && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground sm:text-sm">
                {game.shortDescription}
              </p>
            )}
          </div>

          <dl className="mt-auto grid grid-cols-3 gap-1 border-t border-border/40 pt-3 text-center text-[10px] sm:text-xs">
            <div>
              <dt className="sr-only">{t("modsCountShort", { count: game.modCount })}</dt>
              <dd className="flex flex-col items-center gap-0.5 font-medium">
                <Gamepad2 className="h-3.5 w-3.5 text-neon-blue sm:h-4 sm:w-4" />
                <span>{formatCompactCount(game.modCount)}</span>
                <span className="font-normal text-muted-foreground">Mods</span>
              </dd>
            </div>
            <div>
              <dt className="sr-only">{t("downloadsCount", { count: game.downloadCount })}</dt>
              <dd className="flex flex-col items-center gap-0.5 font-medium">
                <Download className="h-3.5 w-3.5 text-neon-purple sm:h-4 sm:w-4" />
                <span>{formatCompactCount(game.downloadCount)}</span>
                <span className="font-normal text-muted-foreground">Downloads</span>
              </dd>
            </div>
            <div>
              <dt className="sr-only">{t("creatorsCountShort", { count: game.creatorCount })}</dt>
              <dd className="flex flex-col items-center gap-0.5 font-medium">
                <Users className="h-3.5 w-3.5 text-neon-blue sm:h-4 sm:w-4" />
                <span>{game.creatorCount}</span>
                <span className="font-normal text-muted-foreground">Creators</span>
              </dd>
            </div>
          </dl>
        </div>
      </Card>
    </div>
  );
});
