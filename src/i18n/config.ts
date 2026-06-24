import { GLOBAL_LANGUAGE_CATALOG } from "@/lib/language-catalog";

export const locales = ["en", "de", "fr", "es", "tr", "pl"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

/** Primary catalog game slug (GTA V / FiveM / Rage MP ecosystem). */
export const primaryGameSlug = "gta-v-fivem";

export const localeFlags: Record<Locale, string> = {
  en: "🇺🇸",
  de: "🇩🇪",
  fr: "🇫🇷",
  es: "🇪🇸",
  tr: "🇹🇷",
  pl: "🇵🇱",
};

/** Extended catalog for admin language management (may use EN fallback until translated). */
export const extendedLocaleCatalog: Record<string, { name: string; flag: string; nativeName?: string; countryName?: string }> =
  Object.fromEntries(
    GLOBAL_LANGUAGE_CATALOG.map((e) => [
      e.code,
      { name: e.name, flag: e.flag, nativeName: e.nativeName, countryName: e.countryName },
    ])
  );

export const localeLabels: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  tr: "Türkçe",
  pl: "Polski",
};

/** Browser Accept-Language → locale */
export function detectLocaleFromHeader(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return defaultLocale;
  const lower = acceptLanguage.toLowerCase();
  if (lower.includes("de")) return "de";
  if (lower.includes("fr")) return "fr";
  if (lower.includes("es")) return "es";
  if (lower.includes("tr")) return "tr";
  if (lower.includes("pl")) return "pl";
  return "en";
}

export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}

export const localeRegex = new RegExp(`^/(${locales.join("|")})(/|$)`);
