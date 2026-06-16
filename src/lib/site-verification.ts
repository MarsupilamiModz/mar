import { getSiteSetting, setSiteSetting } from "@/lib/site-settings";

export type VerificationMetaTag = {
  id: string;
  name?: string;
  property?: string;
  content: string;
};

export type SiteVerificationSettings = {
  googleSiteVerification?: string;
  googleAdsenseVerification?: string;
  bingSiteVerification?: string;
  yandexVerification?: string;
  pinterestVerification?: string;
  customMetaTags: VerificationMetaTag[];
};

export const DEFAULT_SITE_VERIFICATION: SiteVerificationSettings = {
  customMetaTags: [],
};

const KEY = "site_verification";

export async function getSiteVerificationSettings(): Promise<SiteVerificationSettings> {
  return getSiteSetting(KEY, DEFAULT_SITE_VERIFICATION);
}

export async function saveSiteVerificationSettings(settings: SiteVerificationSettings) {
  await setSiteSetting(KEY, settings);
  const { revalidateTag } = await import("next/cache");
  revalidateTag("site-verification");
}
