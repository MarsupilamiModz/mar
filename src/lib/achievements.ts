import { prisma } from "@/lib/db";
import type { AchievementCategory, AchievementRarity, Prisma } from "@prisma/client";

export type UnlockRule = {
  type:
    | "account_age_days"
    | "membership"
    | "downloads"
    | "mod_purchases"
    | "creator_downloads"
    | "creator_revenue"
    | "creator_featured"
    | "partner_conversions"
    | "partner_revenue"
    | "partner_referrals"
    | "manual";
  threshold?: number;
  planSlug?: string;
};

export type AchievementTranslation = Record<
  string,
  { name?: string; description?: string; title?: string }
>;

export const RARITY_STYLES: Record<
  AchievementRarity,
  { color: string; glow: string; label: string }
> = {
  COMMON: { color: "#94a3b8", glow: "shadow-slate-500/20", label: "Common" },
  UNCOMMON: { color: "#22c55e", glow: "shadow-emerald-500/30", label: "Uncommon" },
  RARE: { color: "#3b82f6", glow: "shadow-blue-500/40", label: "Rare" },
  EPIC: { color: "#a855f7", glow: "shadow-purple-500/50", label: "Epic" },
  LEGENDARY: { color: "#f59e0b", glow: "shadow-amber-500/60", label: "Legendary" },
};

export const DEFAULT_ACHIEVEMENTS: {
  slug: string;
  name: string;
  description: string;
  title?: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  icon: string;
  xpReward: number;
  unlockRule: UnlockRule;
  isHidden?: boolean;
  animated?: boolean;
}[] = [
  { slug: "og-user", name: "OG User", description: "Joined during the platform launch era.", title: "OG", category: "USER", rarity: "LEGENDARY", icon: "🌟", xpReward: 500, unlockRule: { type: "account_age_days", threshold: 365 }, animated: true },
  { slug: "early-supporter", name: "Early Supporter", description: "Purchased a lifetime membership.", title: "Supporter", category: "USER", rarity: "EPIC", icon: "💎", xpReward: 300, unlockRule: { type: "membership" } },
  { slug: "premium-member", name: "Premium Member", description: "Active premium lifetime member.", category: "USER", rarity: "RARE", icon: "👑", xpReward: 200, unlockRule: { type: "membership" } },
  { slug: "verified-buyer", name: "Verified Buyer", description: "Completed a mod purchase.", category: "USER", rarity: "UNCOMMON", icon: "🛒", xpReward: 100, unlockRule: { type: "mod_purchases", threshold: 1 } },
  { slug: "top-downloader", name: "Top Downloader", description: "Downloaded 50+ mods.", category: "USER", rarity: "RARE", icon: "⬇️", xpReward: 250, unlockRule: { type: "downloads", threshold: 50 } },
  { slug: "top-creator", name: "Top Creator", description: "Reached elite creator status.", title: "Top Creator", category: "CREATOR", rarity: "LEGENDARY", icon: "🏆", xpReward: 1000, unlockRule: { type: "creator_downloads", threshold: 10000 }, animated: true },
  { slug: "most-downloaded", name: "Most Downloaded", description: "1,000+ total mod downloads.", category: "CREATOR", rarity: "EPIC", icon: "🔥", xpReward: 500, unlockRule: { type: "creator_downloads", threshold: 1000 } },
  { slug: "trending-creator", name: "Trending Creator", description: "Featured on the trending list.", category: "CREATOR", rarity: "RARE", icon: "📈", xpReward: 300, unlockRule: { type: "creator_featured" } },
  { slug: "elite-creator", name: "Elite Creator", description: "Verified elite creator level.", category: "CREATOR", rarity: "EPIC", icon: "⚡", xpReward: 400, unlockRule: { type: "creator_downloads", threshold: 5000 } },
  { slug: "community-favorite", name: "Community Favorite", description: "500+ downloads and featured.", category: "CREATOR", rarity: "RARE", icon: "❤️", xpReward: 350, unlockRule: { type: "creator_downloads", threshold: 500 } },
  { slug: "fast-growing", name: "Fast Growing Creator", description: "Rapid download growth.", category: "CREATOR", rarity: "UNCOMMON", icon: "🚀", xpReward: 200, unlockRule: { type: "creator_downloads", threshold: 100 } },
  { slug: "top-partner", name: "Top Partner", description: "100+ affiliate conversions.", category: "PARTNER", rarity: "LEGENDARY", icon: "🤝", xpReward: 800, unlockRule: { type: "partner_conversions", threshold: 100 }, animated: true },
  { slug: "highest-revenue", name: "Highest Revenue", description: "Generated €500+ partner revenue.", category: "PARTNER", rarity: "EPIC", icon: "💰", xpReward: 500, unlockRule: { type: "partner_revenue", threshold: 50000 } },
  { slug: "best-conversion", name: "Best Conversion Rate", description: "50+ conversions with high CTR.", category: "PARTNER", rarity: "RARE", icon: "🎯", xpReward: 300, unlockRule: { type: "partner_conversions", threshold: 50 } },
  { slug: "most-referrals", name: "Most Referrals", description: "200+ referral clicks.", category: "PARTNER", rarity: "RARE", icon: "🔗", xpReward: 350, unlockRule: { type: "partner_referrals", threshold: 200 } },
];

export async function seedDefaultAchievements() {
  for (const a of DEFAULT_ACHIEVEMENTS) {
    await prisma.achievement.upsert({
      where: { slug: a.slug },
      create: {
        slug: a.slug,
        name: a.name,
        description: a.description,
        title: a.title,
        category: a.category,
        rarity: a.rarity,
        icon: a.icon,
        xpReward: a.xpReward,
        unlockRule: a.unlockRule as Prisma.InputJsonValue,
        isHidden: a.isHidden ?? false,
        animated: a.animated ?? false,
        glowEffect: true,
      },
      update: {},
    });
  }
}

export function localizedAchievement(
  achievement: {
    name: string;
    description: string | null;
    title: string | null;
    translations: unknown;
  },
  locale: string
) {
  const t = (achievement.translations as AchievementTranslation | null)?.[locale];
  return {
    name: t?.name ?? achievement.name,
    description: t?.description ?? achievement.description,
    title: t?.title ?? achievement.title,
  };
}

export async function getUserStatsForAchievements(userId: string) {
  const [user, downloadCount, purchaseCount, membership, creator, partner] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true, role: true } }),
    prisma.download.count({ where: { userId } }),
    prisma.modPurchase.count({ where: { userId } }),
    prisma.membershipPurchase.findFirst({
      where: { userId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      include: { plan: { select: { slug: true } } },
    }),
    prisma.creatorProfile.findUnique({ where: { userId } }),
    prisma.partnerProfile.findUnique({ where: { userId } }),
  ]);

  const accountAgeDays = user
    ? Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return {
    accountAgeDays,
    downloadCount,
    purchaseCount,
    hasMembership: !!membership,
    membershipSlug: membership?.plan.slug,
    creatorDownloads: creator?.totalDownloads ?? 0,
    creatorFeatured: creator?.isTrending || creator?.isFeatured,
    partnerConversions: partner?.totalConversions ?? 0,
    partnerRevenueCents: partner?.totalRevenueCents ?? 0,
    partnerClicks: partner?.totalClicks ?? 0,
  };
}

function ruleMet(rule: UnlockRule, stats: Awaited<ReturnType<typeof getUserStatsForAchievements>>): boolean {
  switch (rule.type) {
    case "account_age_days":
      return stats.accountAgeDays >= (rule.threshold ?? 0);
    case "membership":
      return stats.hasMembership;
    case "downloads":
      return stats.downloadCount >= (rule.threshold ?? 1);
    case "mod_purchases":
      return stats.purchaseCount >= (rule.threshold ?? 1);
    case "creator_downloads":
      return stats.creatorDownloads >= (rule.threshold ?? 1);
    case "creator_featured":
      return stats.creatorFeatured === true;
    case "creator_revenue":
      return false;
    case "partner_conversions":
      return stats.partnerConversions >= (rule.threshold ?? 1);
    case "partner_revenue":
      return stats.partnerRevenueCents >= (rule.threshold ?? 1);
    case "partner_referrals":
      return stats.partnerClicks >= (rule.threshold ?? 1);
    case "manual":
      return false;
    default:
      return false;
  }
}

export async function evaluateUserAchievements(userId: string) {
  let achievements = await prisma.achievement.findMany({ where: { isActive: true } });
  if (achievements.length === 0) {
    await seedDefaultAchievements();
    achievements = await prisma.achievement.findMany({ where: { isActive: true } });
  }

  const stats = await getUserStatsForAchievements(userId);
  const unlocked: string[] = [];

  for (const achievement of achievements) {
    if (achievement.isHidden) continue;
    if (achievement.isSeasonal && achievement.seasonEnd && achievement.seasonEnd < new Date()) continue;

    const rule = achievement.unlockRule as UnlockRule | null;
    if (!rule || rule.type === "manual") continue;

    const existing = await prisma.userAchievement.findUnique({
      where: { userId_achievementId: { userId, achievementId: achievement.id } },
    });
    if (existing) continue;

    if (ruleMet(rule, stats)) {
      await prisma.userAchievement.create({
        data: { userId, achievementId: achievement.id, progress: 100 },
      });
      await addUserXp(userId, achievement.xpReward);
      unlocked.push(achievement.slug);
    }
  }

  return unlocked;
}

export async function addUserXp(userId: string, amount: number) {
  const xpPerLevel = 500;
  const progress = await prisma.userProgress.upsert({
    where: { userId },
    create: { userId, xp: amount, level: 1 },
    update: { xp: { increment: amount } },
  });
  const newLevel = Math.floor(progress.xp / xpPerLevel) + 1;
  if (newLevel !== progress.level) {
    await prisma.userProgress.update({ where: { userId }, data: { level: newLevel } });
  }
}

export async function getUserAchievements(userId: string, locale = "en") {
  const rows = await prisma.userAchievement.findMany({
    where: { userId },
    include: { achievement: true },
    orderBy: [{ isShowcased: "desc" }, { showcaseOrder: "asc" }, { unlockedAt: "desc" }],
  });
  return rows.map((r) => ({
    ...r,
    ...localizedAchievement(r.achievement, locale),
    rarity: r.achievement.rarity,
    icon: r.achievement.icon,
    animated: r.achievement.animated,
    glowEffect: r.achievement.glowEffect,
  }));
}

export async function getShowcasedAchievements(userId: string, locale = "en", limit = 6) {
  const rows = await prisma.userAchievement.findMany({
    where: { userId, isShowcased: true },
    include: { achievement: true },
    orderBy: [{ showcaseOrder: "asc" }, { unlockedAt: "desc" }],
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    unlockedAt: r.unlockedAt,
    ...localizedAchievement(r.achievement, locale),
    rarity: r.achievement.rarity,
    icon: r.achievement.icon,
    animated: r.achievement.animated,
    glowEffect: r.achievement.glowEffect,
  }));
}

export async function getUserProgress(userId: string) {
  return prisma.userProgress.findUnique({ where: { userId } });
}
