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
  const datePart = formatDate(date, locale);
  try {
    const timePart = safeIntlDateTimeFormat(locale, { timeStyle: "short" }).format(date);
    return `${datePart} ${timePart}`;
  } catch {
    return datePart;
  }
}

/** Global date format: DD.MM.YYYY */
export function formatDate(value: Date | number | string, _locale?: string | null) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}
