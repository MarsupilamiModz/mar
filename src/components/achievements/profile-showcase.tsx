"use client";

import { AchievementBadge } from "@/components/achievements/achievement-badge";
import { CreatorRankBadge } from "@/components/leaderboards/creator-rank-badge";
import type { AchievementRarity, CreatorRankTier } from "@prisma/client";

type ShowcaseAchievement = {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  rarity: AchievementRarity;
  animated?: boolean;
  glowEffect?: boolean;
  unlockedAt: Date;
};

export function ProfileShowcase({
  achievements,
  rankTier,
  supporterLabel,
}: {
  achievements: ShowcaseAchievement[];
  rankTier?: CreatorRankTier | null;
  supporterLabel?: string | null;
}) {
  if (achievements.length === 0 && !rankTier && !supporterLabel) return null;

  return (
    <div className="glass rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Showcase</h3>
        {rankTier && <CreatorRankBadge tier={rankTier} size="sm" />}
        {supporterLabel && (
          <span className="text-xs rounded-full border border-neon-purple/40 bg-neon-purple/10 px-2 py-0.5 text-neon-purple">
            {supporterLabel}
          </span>
        )}
      </div>
      {achievements.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {achievements.map((a) => (
            <AchievementBadge
            key={a.id}
            name={a.name}
            description={a.description}
            icon={a.icon}
              rarity={a.rarity}
              animated={a.animated}
              glowEffect={a.glowEffect}
              unlockedAt={a.unlockedAt}
              size="sm"
            />
          ))}
        </div>
      )}
    </div>
  );
}
