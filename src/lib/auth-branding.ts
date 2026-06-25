import { getSiteSetting, setSiteSettingSafe } from "@/lib/site-settings";
import { unstable_cache } from "next/cache";

export const AUTH_BRANDING_KEY = "auth_branding_settings";

export type AuthBrandingSettings = {
  loginLogoUrl: string | null;
  registerLogoUrl: string | null;
  faviconUrl: string | null;
  backgroundUrl: string | null;
  loginTitle: string;
  loginDescription: string;
  registerTitle: string;
  registerDescription: string;
  discordButtonText: string;
  microsoftButtonText: string;
};

export const DEFAULT_AUTH_BRANDING: AuthBrandingSettings = {
  loginLogoUrl: null,
  registerLogoUrl: null,
  faviconUrl: null,
  backgroundUrl: null,
  loginTitle: "Sign in",
  loginDescription: "Welcome back. Pick up where you left off.",
  registerTitle: "Create your account",
  registerDescription: "Join XumariModz — download, favorite, and support creators.",
  discordButtonText: "Continue with Discord",
  microsoftButtonText: "Continue with Microsoft",
};

export async function getAuthBrandingSettings(): Promise<AuthBrandingSettings> {
  const stored = await getSiteSetting<Partial<AuthBrandingSettings>>(AUTH_BRANDING_KEY, {});
  return { ...DEFAULT_AUTH_BRANDING, ...stored };
}

export async function saveAuthBrandingSettings(settings: AuthBrandingSettings) {
  const saved = await setSiteSettingSafe(AUTH_BRANDING_KEY, settings);
  if (!saved.ok) throw new Error(saved.error);
}

export const getCachedAuthBranding = unstable_cache(
  () => getAuthBrandingSettings(),
  ["auth-branding"],
  { revalidate: 60 }
);
