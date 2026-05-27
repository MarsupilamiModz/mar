import { createHash, randomBytes } from "crypto";
import type { SocialPlatform } from "@prisma/client";

export function generateAffiliateCode(prefix = "MM") {
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}${suffix}`;
}

export function visitorHash(ip: string, userAgent?: string) {
  return createHash("sha256")
    .update(`${ip}:${userAgent ?? "unknown"}`)
    .digest("hex")
    .slice(0, 24);
}

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  "YOUTUBE",
  "TWITCH",
  "TIKTOK",
  "INSTAGRAM",
  "TWITTER",
  "DISCORD",
  "WEBSITE",
];

export const SOCIAL_LABELS: Record<SocialPlatform, string> = {
  YOUTUBE: "YouTube",
  TWITCH: "Twitch",
  TIKTOK: "TikTok",
  INSTAGRAM: "Instagram",
  TWITTER: "X",
  DISCORD: "Discord",
  WEBSITE: "Website",
};

export const SOCIAL_COLORS: Record<SocialPlatform, string> = {
  YOUTUBE: "hover:border-red-500/60 hover:text-red-400",
  TWITCH: "hover:border-purple-500/60 hover:text-purple-400",
  TIKTOK: "hover:border-pink-500/60 hover:text-pink-400",
  INSTAGRAM: "hover:border-orange-500/60 hover:text-orange-400",
  TWITTER: "hover:border-sky-500/60 hover:text-sky-400",
  DISCORD: "hover:border-indigo-500/60 hover:text-indigo-400",
  WEBSITE: "hover:border-neon-blue/60 hover:text-neon-blue",
};

import { formatCreditsFromCents } from "@/lib/credits";

export function formatCents(cents: number, locale = "en") {
  return formatCreditsFromCents(cents, locale);
}

export function formatPercent(bps: number) {
  return `${(bps / 100).toFixed(1)}%`;
}
