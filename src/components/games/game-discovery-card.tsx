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

  const bannerSrc = game.bannerUrl ?? game.coverUrl;
  const showPopular = game.downloadCount >= 500 || game.modCount >= 40;
  const showNew = isRecentlyUpdated(game.lastUpdated);

  const imageSizes = useMemo(
    () => "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
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
      className="group block h-full min-h-[420px] cursor-pointer rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-neon-purple"
    >
      <Card className="relative flex h-full min-h-[420px] flex-col overflow-hidden rounded-2xl border-border/50 bg-background/40 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-neon-purple/50 hover:shadow-[0_8px_40px_rgba(168,85,247,0.25)]">
        <div className="relative min-h-[320px] flex-1 overflow-hidden">
          {bannerSrc ? (
            <SafeImage
              src={bannerSrc}
              alt={game.name}
              fill
              priority={priority}
              loading={priority ? "eager" : "lazy"}
              className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
              sizes={imageSizes}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neon-purple/30 to-neon-blue/15">
              <Gamepad2 className="h-20 w-20 text-muted-foreground/35" />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/45 to-background/10" />

          <div className="absolute left-4 right-4 top-4 flex flex-wrap gap-2">
            {game.isFeatured && (
              <Badge variant="premium" className="shadow-lg">
                {t("featured")}
              </Badge>
            )}
            {showNew && (
              <Badge variant="outline" className="border-neon-blue/50 bg-background/80 text-neon-blue">
                <Sparkles className="mr-1 h-3 w-3" />
                {t("new")}
              </Badge>
            )}
            {showPopular && !game.isFeatured && (
              <Badge variant="outline" className="border-neon-purple/50 bg-background/80">
                <TrendingUp className="mr-1 h-3 w-3 text-neon-purple" />
                {t("popular")}
              </Badge>
            )}
            {game.modeCount > 1 && (
              <Badge variant="outline" className="ml-auto bg-background/75 text-xs">
                {t("modesAvailable", { count: game.modeCount })}
              </Badge>
            )}
          </div>

          {game.logoUrl && (
            <div className="absolute bottom-4 left-4 h-16 w-16 overflow-hidden rounded-xl border-2 border-white/25 bg-background/90 shadow-xl sm:h-20 sm:w-20">
              <SafeImage
                src={game.logoUrl}
                alt=""
                fill
                className="object-contain p-1.5"
                sizes="80px"
              />
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 p-4 pt-16 sm:p-5 sm:pt-20">
            <h3 className="text-xl font-bold leading-tight tracking-tight text-foreground drop-shadow-sm transition-colors duration-150 group-hover:text-neon-purple sm:text-2xl">
              {game.name}
            </h3>
            {game.shortDescription && (
              <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{game.shortDescription}</p>
            )}
          </div>
        </div>

        <dl className="grid grid-cols-3 gap-2 border-t border-border/40 bg-background/50 px-4 py-4 text-center text-xs sm:text-sm">
          <div>
            <dt className="sr-only">{t("modsCountShort", { count: game.modCount })}</dt>
            <dd className="flex flex-col items-center gap-1 font-medium">
              <Gamepad2 className="h-4 w-4 text-neon-blue" />
              <span>{formatCompactCount(game.modCount)}</span>
              <span className="text-[10px] font-normal text-muted-foreground sm:text-xs">Mods</span>
            </dd>
          </div>
          <div>
            <dt className="sr-only">{t("downloadsCount", { count: game.downloadCount })}</dt>
            <dd className="flex flex-col items-center gap-1 font-medium">
              <Download className="h-4 w-4 text-neon-purple" />
              <span>{formatCompactCount(game.downloadCount)}</span>
              <span className="text-[10px] font-normal text-muted-foreground sm:text-xs">Downloads</span>
            </dd>
          </div>
          <div>
            <dt className="sr-only">{t("creatorsCountShort", { count: game.creatorCount })}</dt>
            <dd className="flex flex-col items-center gap-1 font-medium">
              <Users className="h-4 w-4 text-neon-blue" />
              <span>{game.creatorCount}</span>
              <span className="text-[10px] font-normal text-muted-foreground sm:text-xs">Creators</span>
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  );
});
