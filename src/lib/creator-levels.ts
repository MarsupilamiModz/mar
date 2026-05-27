import type { PublisherLevel } from "@prisma/client";

export type LevelConfig = {
  level: PublisherLevel;
  labelKey: string;
  badgeKey: string;
  icon: string;
  revenueShareBps: number;
  glowClass: string;
  borderClass: string;
  cardClass: string;
  tools: string[];
  sortBoost: number;
};

export const CREATOR_LEVELS: Record<PublisherLevel, LevelConfig> = {
  UNVERIFIED: {
    level: "UNVERIFIED",
    labelKey: "levelUnverified",
    badgeKey: "badgeUnverified",
    icon: "○",
    revenueShareBps: 0,
    glowClass: "",
    borderClass: "border-border/40",
    cardClass: "",
    tools: [],
    sortBoost: 0,
  },
  VERIFIED: {
    level: "VERIFIED",
    labelKey: "levelVerified",
    badgeKey: "badgeVerified",
    icon: "✔",
    revenueShareBps: 500,
    glowClass: "shadow-[0_0_12px_rgba(34,197,94,0.35)]",
    borderClass: "border-emerald-500/40",
    cardClass: "ring-1 ring-emerald-500/20",
    tools: ["analytics"],
    sortBoost: 10,
  },
  TRUSTED: {
    level: "TRUSTED",
    labelKey: "levelTrusted",
    badgeKey: "badgeTrusted",
    icon: "🔥",
    revenueShareBps: 1000,
    glowClass: "shadow-[0_0_16px_rgba(249,115,22,0.4)]",
    borderClass: "border-orange-500/50",
    cardClass: "ring-1 ring-orange-500/25",
    tools: ["analytics", "premiumUploads", "advancedAnalytics"],
    sortBoost: 25,
  },
  ELITE: {
    level: "ELITE",
    labelKey: "levelElite",
    badgeKey: "badgeElite",
    icon: "👑",
    revenueShareBps: 2000,
    glowClass: "shadow-[0_0_20px_rgba(168,85,247,0.45)]",
    borderClass: "border-neon-purple/60",
    cardClass: "ring-1 ring-neon-purple/30",
    tools: ["analytics", "premiumUploads", "advancedAnalytics", "earlyAccess", "privateCategories", "customThemes"],
    sortBoost: 50,
  },
  OFFICIAL_PARTNER: {
    level: "OFFICIAL_PARTNER",
    labelKey: "levelOfficial",
    badgeKey: "badgeOfficial",
    icon: "⭐",
    revenueShareBps: 3000,
    glowClass: "shadow-[0_0_24px_rgba(59,130,246,0.5)] animate-pulse",
    borderClass: "border-neon-blue/70",
    cardClass: "ring-2 ring-neon-blue/40",
    tools: [
      "analytics",
      "premiumUploads",
      "advancedAnalytics",
      "earlyAccess",
      "privateCategories",
      "customThemes",
      "homepagePlacement",
      "exclusiveLaunches",
      "advancedMonetization",
      "prioritySupport",
      "sponsoredSections",
    ],
    sortBoost: 100,
  },
};

export function effectiveRevenueShareBps(
  level: PublisherLevel,
  overrideBps?: number | null,
  storedBps?: number
) {
  if (overrideBps != null) return overrideBps;
  if (storedBps != null && storedBps > 0) return storedBps;
  return CREATOR_LEVELS[level]?.revenueShareBps ?? 0;
}

export function hasCreatorTool(level: PublisherLevel, tool: string) {
  return CREATOR_LEVELS[level]?.tools.includes(tool) ?? false;
}

export function levelRank(level: PublisherLevel) {
  const order: PublisherLevel[] = ["UNVERIFIED", "VERIFIED", "TRUSTED", "ELITE", "OFFICIAL_PARTNER"];
  return order.indexOf(level);
}

export const LEVEL_OPTIONS: PublisherLevel[] = [
  "VERIFIED",
  "TRUSTED",
  "ELITE",
  "OFFICIAL_PARTNER",
];
