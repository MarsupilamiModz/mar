import { prisma } from "@/lib/db";
import { localizedAchievement } from "@/lib/achievements";
import type { AchievementRarity } from "@prisma/client";

export type InlineBadge = {
  id: string;
  name: string;
  icon: string | null;
  rarity: AchievementRarity;
  animated: boolean;
  glowEffect: boolean;
};

const RARITY_ORDER: Record<AchievementRarity, number> = {
  LEGENDARY: 5,
  EPIC: 4,
  RARE: 3,
  UNCOMMON: 2,
  COMMON: 1,
};

/** Top showcased or highest-rarity achievements for inline username display. */
export async function getInlineUserBadges(userId: string, locale = "en", limit = 3): Promise<InlineBadge[]> {
  try {
    const rows = await prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true },
      orderBy: [{ isShowcased: "desc" }, { showcaseOrder: "asc" }, { unlockedAt: "desc" }],
      take: 12,
    });

    const sorted = [...rows].sort((a, b) => {
      if (a.isShowcased !== b.isShowcased) return a.isShowcased ? -1 : 1;
      return RARITY_ORDER[b.achievement.rarity] - RARITY_ORDER[a.achievement.rarity];
    });

    return sorted.slice(0, limit).map((r) => {
      const loc = localizedAchievement(r.achievement, locale);
      return {
        id: r.id,
        name: loc.name,
        icon: r.achievement.icon,
        rarity: r.achievement.rarity,
        animated: r.achievement.animated,
        glowEffect: r.achievement.glowEffect,
      };
    });
  } catch (error) {
    console.error("[getInlineUserBadges]", error);
    return [];
  }
}

export async function getInlineBadgesForUsers(userIds: string[], locale = "en"): Promise<Map<string, InlineBadge[]>> {
  const unique = Array.from(new Set(userIds));
  const map = new Map<string, InlineBadge[]>();
  await Promise.all(
    unique.map(async (id) => {
      map.set(id, await getInlineUserBadges(id, locale, 2));
    })
  );
  return map;
}
