import { prisma } from "@/lib/db";
import { localizedAchievement } from "@/lib/achievements";
import { SHOWCASE_MAX } from "@/lib/achievement-constants";
import type { AchievementRarity } from "@prisma/client";

export type InlineBadge = {
  id: string;
  name: string;
  icon: string | null;
  rarity: AchievementRarity;
  animated: boolean;
  glowEffect: boolean;
  description?: string | null;
  unlockedAt?: Date;
};

/** Featured showcase achievements only (public inline display). */
export async function getInlineUserBadges(userId: string, locale = "en", limit = SHOWCASE_MAX): Promise<InlineBadge[]> {
  try {
    const rows = await prisma.userAchievement.findMany({
      where: { userId, isShowcased: true },
      include: { achievement: true },
      orderBy: [{ showcaseOrder: "asc" }, { unlockedAt: "desc" }],
      take: limit,
    });

    return rows.map((r) => {
      const loc = localizedAchievement(r.achievement, locale);
      return {
        id: r.id,
        name: loc.name,
        icon: r.achievement.icon,
        rarity: r.achievement.rarity,
        animated: r.achievement.animated,
        glowEffect: r.achievement.glowEffect,
        description: loc.description,
        unlockedAt: r.unlockedAt,
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
      map.set(id, await getInlineUserBadges(id, locale, SHOWCASE_MAX));
    })
  );
  return map;
}
