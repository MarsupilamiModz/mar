import type { Locale } from "@/i18n/config";
import { getCachedPublicBranding } from "@/lib/branding-data";
import { resolvePageContent, type PageId } from "@/lib/branding-cms";

export async function getCmsPageText(
  locale: Locale,
  page: PageId,
  field: string,
  fallback: string
): Promise<string> {
  const bundle = await getCachedPublicBranding();
  return resolvePageContent(bundle.pageContent, page, locale, field, fallback);
}

export async function getCmsBranding() {
  const bundle = await getCachedPublicBranding();
  return bundle.branding;
}

export async function getCmsHeader() {
  const bundle = await getCachedPublicBranding();
  return bundle.header;
}

export async function getCmsFooter() {
  const bundle = await getCachedPublicBranding();
  return bundle.footer;
}

export async function getCmsSeo(locale: Locale) {
  const bundle = await getCachedPublicBranding();
  const { resolveSeoForLocale } = await import("@/lib/branding-cms");
  return resolveSeoForLocale(bundle.seo, locale);
}
