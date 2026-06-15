import { prisma } from "@/lib/db";
import type { AdFormat, AdProviderType } from "@prisma/client";
import { getSiteSetting, setSiteSetting } from "@/lib/site-settings";

export type AdProviderSettings = {
  adsenseClientId?: string;
  adsenseEnabled?: boolean;
  nitropayId?: string;
  nitropayEnabled?: boolean;
  ezoicId?: string;
  ezoicEnabled?: boolean;
  globalAdsEnabled?: boolean;
  popupAdsEnabled?: boolean;
  /** Built-in UserRole values that should NOT see ads (staff, premium tiers, creators, etc.) */
  rolesWithoutAds?: string[];
  /** If set, only these roles see ads (typically USER). Empty = use rolesWithoutAds logic. */
  rolesWithAds?: string[];
  /** Membership plan slugs that hide ads (premium-lite, premium, premium-max) */
  membershipSlugsWithoutAds?: string[];
};

export const DEFAULT_AD_SETTINGS: AdProviderSettings = {
  globalAdsEnabled: false,
  popupAdsEnabled: false,
  adsenseEnabled: false,
  nitropayEnabled: false,
  ezoicEnabled: false,
  rolesWithoutAds: [
    "PREMIUM",
    "CREATOR",
    "PARTNER",
    "DESIGNER",
    "MODERATOR",
    "SUPPORT",
    "ADMIN",
    "OWNER",
  ],
  rolesWithAds: ["USER"],
  membershipSlugsWithoutAds: ["premium-lite", "premium", "premium-max"],
};

export type AdLocation =
  | "homepage"
  | "mod-detail"
  | "category"
  | "creator"
  | "dashboard"
  | "sidebar"
  | "footer"
  | "listing"
  | "search";

export async function getAdSettings() {
  return getSiteSetting("ad_settings", DEFAULT_AD_SETTINGS);
}

export async function saveAdSettings(settings: AdProviderSettings) {
  await setSiteSetting("ad_settings", settings);
}

export async function getAdProviders() {
  return prisma.adProviderConfig.findMany({ orderBy: { type: "asc" } });
}

export async function getAdsForLocation(location: AdLocation) {
  const now = new Date();
  return prisma.adPlacement.findMany({
    where: {
      location,
      isEnabled: true,
      format: { not: "POPUP" },
      OR: [
        { scheduleStart: null, scheduleEnd: null },
        { scheduleStart: { lte: now }, scheduleEnd: null },
        { scheduleStart: null, scheduleEnd: { gte: now } },
        { scheduleStart: { lte: now }, scheduleEnd: { gte: now } },
      ],
    },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getPopupAds() {
  const now = new Date();
  return prisma.adPlacement.findMany({
    where: {
      format: "POPUP",
      isEnabled: true,
      OR: [
        { scheduleStart: null, scheduleEnd: null },
        { scheduleStart: { lte: now }, scheduleEnd: null },
        { scheduleStart: null, scheduleEnd: { gte: now } },
        { scheduleStart: { lte: now }, scheduleEnd: { gte: now } },
      ],
    },
    orderBy: { sortOrder: "asc" },
    take: 1,
  });
}

export async function trackAdImpression(adId: string) {
  await prisma.adPlacement.update({
    where: { id: adId },
    data: { impressions: { increment: 1 } },
  });
}

export async function trackAdClick(adId: string) {
  await prisma.adPlacement.update({
    where: { id: adId },
    data: { clicks: { increment: 1 } },
  });
}

export function buildProviderScript(
  provider: AdProviderType,
  config: Record<string, string | boolean | undefined>
): string | null {
  switch (provider) {
    case "ADSENSE": {
      const client = config.adsenseClientId as string | undefined;
      if (!client) return null;
      return `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}" crossorigin="anonymous"></script>`;
    }
    case "NITROPAY": {
      const id = config.nitropayId as string | undefined;
      if (!id) return null;
      return `<script async src="https://s.nitropay.com/ads-${id}.js"></script>`;
    }
    case "EZOIC": {
      const id = config.ezoicId as string | undefined;
      if (!id) return null;
      return `<script async src="//www.ezojs.com/ezoic/sa.min.js?id=${id}"></script>`;
    }
    default:
      return null;
  }
}

export const DEFAULT_AD_PLACEMENTS: {
  slug: string;
  name: string;
  location: string;
  format: AdFormat;
  provider: AdProviderType;
  sortOrder: number;
}[] = [
  { slug: "homepage-hero", name: "Homepage Hero Banner", location: "homepage", format: "BANNER", provider: "CUSTOM", sortOrder: 0 },
  { slug: "mod-detail-top", name: "Mod Page Top", location: "mod-detail", format: "BANNER", provider: "CUSTOM", sortOrder: 0 },
  { slug: "sidebar-primary", name: "Sidebar Primary", location: "sidebar", format: "SIDEBAR", provider: "CUSTOM", sortOrder: 0 },
  { slug: "footer-banner", name: "Footer Banner", location: "footer", format: "FOOTER", provider: "CUSTOM", sortOrder: 0 },
  { slug: "listing-inline", name: "Between Mod Listings", location: "listing", format: "NATIVE", provider: "CUSTOM", sortOrder: 0 },
  { slug: "mobile-sticky", name: "Mobile Sticky", location: "homepage", format: "MOBILE", provider: "CUSTOM", sortOrder: 1 },
  { slug: "popup-primary", name: "Homepage Popup", location: "homepage", format: "POPUP", provider: "CUSTOM", sortOrder: 0 },
];

export async function seedDefaultAdPlacements() {
  for (const ad of DEFAULT_AD_PLACEMENTS) {
    await prisma.adPlacement.upsert({
      where: { slug: ad.slug },
      create: ad,
      update: {},
    });
  }
}

export async function seedDefaultAdProviders() {
  const types: AdProviderType[] = ["ADSENSE", "NITROPAY", "EZOIC", "CUSTOM", "AFFILIATE", "DIRECT"];
  for (const type of types) {
    await prisma.adProviderConfig.upsert({
      where: { type },
      create: { type, name: type, config: {}, isEnabled: false },
      update: {},
    });
  }
}
