import type { CreatorRankTier } from "@prisma/client";

export const RANK_TIERS: CreatorRankTier[] = [
  "BRONZE",
  "SILVER",
  "GOLD",
  "DIAMOND",
  "ELITE",
  "LEGENDARY",
];

export const RANK_CONFIG: Record<
  CreatorRankTier,
  { minScore: number; color: string; border: string; glow: string; label: string }
> = {
  BRONZE: { minScore: 0, color: "#cd7f32", border: "border-amber-700/50", glow: "", label: "Bronze" },
  SILVER: { minScore: 100, color: "#c0c0c0", border: "border-slate-400/50", glow: "shadow-slate-400/20", label: "Silver" },
  GOLD: { minScore: 500, color: "#fbbf24", border: "border-yellow-500/50", glow: "shadow-yellow-500/30", label: "Gold" },
  DIAMOND: { minScore: 2000, color: "#38bdf8", border: "border-sky-400/50", glow: "shadow-sky-400/40", label: "Diamond" },
  ELITE: { minScore: 10000, color: "#a855f7", border: "border-purple-500/50", glow: "shadow-purple-500/50", label: "Elite" },
  LEGENDARY: { minScore: 50000, color: "#f97316", border: "border-orange-500/50", glow: "shadow-orange-500/60", label: "Legendary" },
};

export function scoreToRankTier(score: number): CreatorRankTier {
  let tier: CreatorRankTier = "BRONZE";
  for (const t of RANK_TIERS) {
    if (score >= RANK_CONFIG[t].minScore) tier = t;
  }
  return tier;
}

export function computeCreatorRankScore(stats: {
  totalDownloads: number;
  totalRevenueCents: number;
  followerCount: number;
  reviewCount?: number;
  averageRating?: number;
  modCount?: number;
}) {
  const downloadScore = stats.totalDownloads * 1;
  const revenueScore = stats.totalRevenueCents / 100;
  const followerScore = stats.followerCount * 5;
  const reviewScore = (stats.reviewCount ?? 0) * 10;
  const ratingBonus = (stats.averageRating ?? 0) * 50;
  const modBonus = (stats.modCount ?? 0) * 25;
  return downloadScore + revenueScore + followerScore + reviewScore + ratingBonus + modBonus;
}
