import { defaultLocale, isValidLocale, locales, type Locale } from "@/i18n/config";

export const SUPPORTED_LOCALES = locales;

/** BCP 47 tags used by Intl APIs — short app locales are not valid alone. */
export const INTL_LOCALE_MAP: Record<Locale, string> = {
  en: "en-US",
  de: "de-DE",
  fr: "fr-FR",
  es: "es-ES",
  tr: "tr-TR",
  pl: "pl-PL",
};

export function getSafeLocale(locale?: string | null): Locale {
  if (!locale) return defaultLocale;
  const normalized = locale.split("-")[0]?.toLowerCase() ?? "";
  if (isValidLocale(normalized)) return normalized;
  if (isValidLocale(locale)) return locale;
  return defaultLocale;
}

export function getIntlLocale(locale?: string | null): string {
  const safe = getSafeLocale(locale);
  return INTL_LOCALE_MAP[safe] ?? "en-US";
}

export function safeToLocaleString(value: number, locale?: string | null): string {
  try {
    return value.toLocaleString(getIntlLocale(locale));
  } catch {
    try {
      return value.toLocaleString("en-US");
    } catch {
      return String(value);
    }
  }
}

export function safeToLocaleDateString(
  value: Date | number | string,
  locale?: string | null,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  if (!options || Object.keys(options).length === 0) {
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
  }
  try {
    return date.toLocaleDateString(getIntlLocale(locale), options);
  } catch {
    try {
      return date.toLocaleDateString("en-US", options);
    } catch {
      return date.toISOString().slice(0, 10);
    }
  }
}

export function safeToLocaleTimeString(
  value: Date | number | string,
  locale?: string | null,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  try {
    return date.toLocaleTimeString(getIntlLocale(locale), options);
  } catch {
    try {
      return date.toLocaleTimeString("en-US", options);
    } catch {
      return "";
    }
  }
}

export function safeIntlNumberFormat(
  locale: string | null | undefined,
  options?: Intl.NumberFormatOptions
): Intl.NumberFormat {
  try {
    return new Intl.NumberFormat(getIntlLocale(locale), options);
  } catch {
    return new Intl.NumberFormat("en-US", options);
  }
}

export function safeIntlDateTimeFormat(
  locale: string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat(getIntlLocale(locale), options);
  } catch {
    return new Intl.DateTimeFormat("en-US", options);
  }
}

export function safeIntlRelativeTimeFormat(
  locale: string | null | undefined,
  options?: Intl.RelativeTimeFormatOptions
): Intl.RelativeTimeFormat {
  try {
    return new Intl.RelativeTimeFormat(getIntlLocale(locale), options);
  } catch {
    return new Intl.RelativeTimeFormat("en-US", options);
  }
}
