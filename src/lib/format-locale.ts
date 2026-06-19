import {
  getIntlLocale,
  getSafeLocale,
  safeIntlDateTimeFormat,
  safeIntlNumberFormat,
  safeToLocaleDateString,
  safeToLocaleString,
} from "@/lib/i18n/safe-locale";

export { getSafeLocale, getIntlLocale, safeToLocaleString, safeToLocaleDateString };

export function formatNumber(value: number, locale?: string | null) {
  return safeToLocaleString(value, locale);
}

export function formatEuro(cents: number, locale?: string | null) {
  try {
    return safeIntlNumberFormat(locale, { style: "currency", currency: "EUR" }).format(cents / 100);
  } catch {
    return `€${(cents / 100).toFixed(2)}`;
  }
}

export function formatDateTime(value: Date | number | string, locale?: string | null) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  try {
    return safeIntlDateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
  } catch {
    return date.toISOString();
  }
}

export function formatDate(value: Date | number | string, locale?: string | null) {
  return safeToLocaleDateString(value, locale, { dateStyle: "medium" });
}
