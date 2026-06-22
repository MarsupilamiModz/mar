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
export const extendedLocaleCatalog: Record<string, { name: string; flag: string }> = {
  en: { name: "English", flag: "🇺🇸" },
  de: { name: "Deutsch", flag: "🇩🇪" },
  fr: { name: "Français", flag: "🇫🇷" },
  es: { name: "Español", flag: "🇪🇸" },
  it: { name: "Italiano", flag: "🇮🇹" },
  pl: { name: "Polski", flag: "🇵🇱" },
  tr: { name: "Türkçe", flag: "🇹🇷" },
  nl: { name: "Nederlands", flag: "🇳🇱" },
};

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
