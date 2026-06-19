"use client";

import Link from "next/link";
import { safeToLocaleString } from "@/lib/i18n/safe-locale";
import { SafeImage } from "@/components/ui/safe-image";
import type { PublisherLevel } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { CreatorLevelBadge, CreatorCardFrame } from "@/components/creator/creator-level-badge";
import { formatDisplayName } from "@/lib/display-name";

type CreatorCardProps = {
  locale: string;
  creator: {
    id: string;
    slug: string;
    tagline: string | null;
    level: PublisherLevel;
    totalDownloads: number;
    isFeatured: boolean;
    user: { username: string; displayName: string | null; avatarUrl: string | null };
  };
};

export function CreatorDiscoveryCard({ locale, creator }: CreatorCardProps) {
  const displayName = formatDisplayName(creator.user);

  return (
    <Link href={`/${locale}/creators/${creator.slug}`}>
      <CreatorCardFrame level={creator.level}>
        <Card className="glass p-5 h-full hover:border-neon-purple/40 transition-all duration-300 hover:-translate-y-0.5">
          <div className="flex items-start gap-3">
            {creator.user.avatarUrl ? (
              <div className="relative h-12 w-12 rounded-xl overflow-hidden shrink-0 border border-border/50">
                <SafeImage src={creator.user.avatarUrl} alt="" fill className="object-cover" sizes="48px" />
              </div>
            ) : (
              <div className="h-12 w-12 rounded-xl bg-muted/40 flex items-center justify-center text-lg font-bold shrink-0">
                {displayName.slice(0, 1)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{creator.tagline ?? "Creator"}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <CreatorLevelBadge level={creator.level} size="xs" />
            {creator.isFeatured && (
              <span className="text-[10px] uppercase tracking-wide text-neon-purple">Featured</span>
            )}
          </div>
          <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
            <span>{safeToLocaleString(creator.totalDownloads)} DL</span>
          </div>
        </Card>
      </CreatorCardFrame>
    </Link>
  );
}
