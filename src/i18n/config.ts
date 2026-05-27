export const locales = ["en", "de", "fr", "es", "tr", "pl"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

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
