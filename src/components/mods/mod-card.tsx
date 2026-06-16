import Link from "next/link";
import { Download, Play, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SafeImage } from "@/components/ui/safe-image";
import { getFeaturedMediaUrl, type ModMediaItem } from "@/lib/mod-media";
import { formatNumber } from "@/lib/format-locale";
import { SecurityBadge } from "@/components/security/security-badge";
import { isSecurityVerified } from "@/lib/security/status";
import type { FileScanStatus } from "@prisma/client";

import { ModCardLikeButton } from "@/components/mods/mod-card-like-button";

type ModCardProps = {
  locale: string;
  mod: {
    id?: string;
    slug: string;
    title: string;
    shortDescription?: string | null;
    pricing: string;
    downloadCount: number;
    averageRating: number;
    favoriteCount?: number;
    game?: { name: string; slug: string };
    media?: ModMediaItem[];
    screenshots?: { url: string }[];
    versions?: Array<{
      scanStatus?: FileScanStatus;
      trustedFile?: { id: string } | null;
      fileSize?: bigint | number;
      version?: string;
      gameVersion?: string | null;
    }>;
  };
  pricingLabel?: string;
  isFavorited?: boolean;
  showLike?: boolean;
};

export function ModCard({ locale, mod, pricingLabel, isFavorited, showLike = true }: ModCardProps) {
  const media = mod.media ?? [];
  const cover = getFeaturedMediaUrl(
    media,
    mod.screenshots?.map((s, i) => ({ url: s.url, sortOrder: i }))
  );
  const hasVideo = media.some((m) => m.mediaType === "YOUTUBE" && m.youtubeVideoId);
  const label = pricingLabel ?? mod.pricing;
  const primaryVersion = mod.versions?.[0];
  const scanStatus = primaryVersion?.scanStatus;
  const showSecurityBadge =
    scanStatus && isSecurityVerified(scanStatus, !!primaryVersion?.trustedFile);

  return (
    <Link href={`/${locale}/mods/${mod.slug}`} prefetch className="group block h-full">
      <Card className="h-full overflow-hidden border-border/50 transition-all duration-300 hover:-translate-y-0.5 hover:border-neon-purple/40 hover:shadow-[0_0_24px_-4px_rgba(168,85,247,0.25)]">
        <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-neon-purple/20 via-background to-neon-blue/10">
          {cover && (
            <SafeImage
              src={cover}
              alt={mod.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              loading="lazy"
            />
          )}
          {hasVideo && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="rounded-full bg-background/60 p-2 backdrop-blur-sm border border-white/20 opacity-80 group-hover:opacity-100 transition-opacity">
                <Play className="h-5 w-5 fill-white text-white" />
              </div>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          <Badge
            variant={mod.pricing === "FREE" ? "free" : "premium"}
            className="absolute right-2.5 top-2.5 backdrop-blur-sm"
          >
            {label}
          </Badge>
          {showLike && mod.id && (
            <ModCardLikeButton modId={mod.id} initialFavorited={isFavorited} />
          )}
        </div>
        <CardContent className="flex flex-col gap-2 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-neon-blue/90">
            {mod.game?.name ?? "Mod"}
          </p>
          <h3 className="font-semibold leading-snug line-clamp-1 group-hover:text-neon-purple transition-colors">
            {mod.title}
          </h3>
          {mod.shortDescription && (
            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
              {mod.shortDescription}
            </p>
          )}
          {showSecurityBadge && scanStatus && (
            <SecurityBadge
              scanStatus={scanStatus}
              isTrusted={!!primaryVersion?.trustedFile}
              compact
            />
          )}
          <div className="mt-auto flex items-center gap-4 pt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-neon-purple/80 text-neon-purple" />
              {mod.averageRating.toFixed(1)}
            </span>
            <span className="flex items-center gap-1">
              <Download className="h-3.5 w-3.5" />
              {formatNumber(mod.downloadCount, locale)}
            </span>
            {mod.favoriteCount != null && mod.favoriteCount > 0 && (
              <span className="flex items-center gap-1 text-neon-purple">
                ♥ {formatNumber(mod.favoriteCount, locale)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
