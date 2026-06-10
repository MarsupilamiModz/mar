import {
  getBrandingAssetSettings,
  saveBrandingAssetSettings,
  type BrandingAssetSettings,
} from "@/lib/branding-cms";

/** @deprecated Use BrandingAssetSettings from branding-cms */
export type BrandingSettings = BrandingAssetSettings;

export const DEFAULT_BRANDING: BrandingSettings = {
  siteTitle: "Xumari Modz",
  siteShortName: "Xumari",
  browserTitle: "Xumari Modz — Premium Gaming Mods",
  siteTagline: "Premium gaming mods marketplace",
  logoUrl: null,
  logoDarkUrl: null,
  faviconUrl: null,
  appleTouchIconUrl: null,
  androidIconUrl: null,
  pwaIconUrl: null,
  loadingLogoUrl: null,
  mobileIconUrl: null,
  siteSymbolMode: "letter",
  siteSymbolLetter: "X",
  siteSymbolUrl: null,
  siteSymbolLibrary: "sparkles",
  siteSymbolColor: "#a855f7",
  logoObjectPosition: "center",
  footerText: "© Xumari Modz. All rights reserved.",
  primaryColor: "#a855f7",
  accentColor: "#3b82f6",
};

export async function getBrandingSettings() {
  return getBrandingAssetSettings();
}

export async function saveBrandingSettings(settings: BrandingSettings) {
  await saveBrandingAssetSettings(settings);
}

export type GameCoverSettings = {
  gameId: string;
  heroBannerUrl?: string | null;
  thumbnailUrl?: string | null;
  accentColor?: string | null;
  backgroundGradient?: string | null;
};

export async function getGameCoverOverrides(): Promise<Record<string, GameCoverSettings>> {
  const { getSiteSetting } = await import("@/lib/site-settings");
  return getSiteSetting("game_covers", {} as Record<string, GameCoverSettings>);
}

export async function saveGameCoverOverride(gameId: string, data: GameCoverSettings) {
  const { setSiteSettingSafe } = await import("@/lib/site-settings");
  const current = await getGameCoverOverrides();
  current[gameId] = { ...current[gameId], ...data, gameId };
  const saved = await setSiteSettingSafe("game_covers", current);
  if (!saved.ok) throw new Error(saved.error);
}
