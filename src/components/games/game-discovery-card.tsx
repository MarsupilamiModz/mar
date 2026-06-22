"use client";

import { memo, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Gamepad2, Download, Users, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SafeImage } from "@/components/ui/safe-image";
import { GameModePickerModal } from "@/components/games/game-mode-picker-modal";
import { formatCompactCount, type GameDiscoveryCardData } from "@/lib/game-discovery";

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

function formatRelativeDate(value: Date | string | null | undefined, locale: string): string | null {
  const date = parseDate(value);
  if (!date) return null;
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days < 1) return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(0, "day");
  if (days < 30) return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-days, "day");
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export const GameDiscoveryCard = memo(function GameDiscoveryCard({
  locale,
  game,
  priority = false,
}: Props) {
  const t = useTranslations("games");
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const coverSrc = game.coverUrl ?? game.bannerUrl;
  const updated = formatRelativeDate(game.lastUpdated, locale);

  const navigate = useCallback(
    (path: string) => {
      router.push(path);
    },
    [router]
  );

  const handleClick = useCallback(() => {
    if (game.soleModeSlug) {
      navigate(`/${locale}/games/${game.slug}/${game.soleModeSlug}`);
      return;
    }
    if (game.modeCount > 1) {
      setModalOpen(true);
      return;
    }
    navigate(`/${locale}/games/${game.slug}`);
  }, [game.modeCount, game.slug, game.soleModeSlug, locale, navigate]);

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
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className="group block h-full cursor-pointer rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-neon-purple"
      >
        <Card className="relative h-full overflow-hidden rounded-2xl border-border/50 bg-background/40 transition-all duration-300 hover:-translate-y-1 hover:border-neon-purple/50 hover:shadow-[0_0_32px_rgba(168,85,247,0.25)]">
          <div className="relative aspect-[3/4] overflow-hidden">
            {coverSrc ? (
              <SafeImage
                src={coverSrc}
                alt={game.name}
                fill
                priority={priority}
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neon-purple/20 to-neon-blue/10">
                <Gamepad2 className="h-16 w-16 text-muted-foreground/40" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
            {game.isFeatured && (
              <Badge variant="premium" className="absolute left-3 top-3 shadow-lg">
                {t("featured")}
              </Badge>
            )}
            {game.modeCount > 1 && (
              <Badge variant="outline" className="absolute right-3 top-3 bg-background/70 text-xs">
                {t("modesAvailable", { count: game.modeCount })}
              </Badge>
            )}
            {game.logoUrl && (
              <div className="absolute bottom-3 left-3 h-10 w-10 overflow-hidden rounded-lg border border-white/20 bg-background/80 shadow-lg">
                <SafeImage src={game.logoUrl} alt="" fill className="object-contain p-1" sizes="40px" />
              </div>
            )}
          </div>

          <div className="space-y-3 p-4">
            <h3 className="text-lg font-bold leading-tight tracking-tight group-hover:text-neon-purple transition-colors line-clamp-2">
              {game.name}
            </h3>
            {game.shortDescription && (
              <p className="text-xs text-muted-foreground line-clamp-2">{game.shortDescription}</p>
            )}
            <dl className="grid grid-cols-1 gap-1.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Gamepad2 className="h-3.5 w-3.5 shrink-0 text-neon-blue" />
                <dd>{t("modsCountShort", { count: formatCompactCount(game.modCount) })}</dd>
              </div>
              <div className="flex items-center gap-2">
                <Download className="h-3.5 w-3.5 shrink-0 text-neon-purple" />
                <dd>{t("downloadsCount", { count: formatCompactCount(game.downloadCount) })}</dd>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 shrink-0 text-neon-blue" />
                <dd>{t("creatorsCountShort", { count: game.creatorCount })}</dd>
              </div>
              {updated && (
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  <dd>{t("lastUpdated", { date: updated })}</dd>
                </div>
              )}
            </dl>
          </div>
        </Card>
      </div>

      {game.modeCount > 1 && (
        <GameModePickerModal
          locale={locale}
          gameSlug={game.slug}
          gameName={game.name}
          open={modalOpen}
          onOpenChange={setModalOpen}
        />
      )}
    </>
  );
});
