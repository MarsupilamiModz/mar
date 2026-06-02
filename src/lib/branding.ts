import { getSiteSetting, setSiteSetting } from "@/lib/site-settings";

export type BrandingSettings = {
  siteTitle: string;
  siteTagline: string;
  logoUrl: string | null;
  logoDarkUrl: string | null;
  faviconUrl: string | null;
  loadingLogoUrl: string | null;
  mobileIconUrl: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageUrl: string | null;
  footerText: string | null;
  primaryColor: string;
  accentColor: string;
};

export const DEFAULT_BRANDING: BrandingSettings = {
  siteTitle: "XumariModz",
  siteTagline: "Premium gaming mods marketplace",
  logoUrl: null,
  logoDarkUrl: null,
  faviconUrl: null,
  loadingLogoUrl: null,
  mobileIconUrl: null,
  ogTitle: null,
  ogDescription: null,
  ogImageUrl: null,
  footerText: "© Xumari Modz. All rights reserved.",
  primaryColor: "#a855f7",
  accentColor: "#3b82f6",
};

export async function getBrandingSettings() {
  return getSiteSetting("branding", DEFAULT_BRANDING);
}

export async function saveBrandingSettings(settings: BrandingSettings) {
  await setSiteSetting("branding", settings);
}

export type GameCoverSettings = {
  gameId: string;
  heroBannerUrl?: string | null;
  thumbnailUrl?: string | null;
  accentColor?: string | null;
  backgroundGradient?: string | null;
};

export async function getGameCoverOverrides(): Promise<Record<string, GameCoverSettings>> {
  return getSiteSetting("game_covers", {} as Record<string, GameCoverSettings>);
}

export async function saveGameCoverOverride(gameId: string, data: GameCoverSettings) {
  const current = await getGameCoverOverrides();
  current[gameId] = { ...current[gameId], ...data, gameId };
  await setSiteSetting("game_covers", current);
}
