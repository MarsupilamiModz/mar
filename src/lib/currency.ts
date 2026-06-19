import { getIntlLocale, safeIntlNumberFormat } from "@/lib/i18n/safe-locale";

export type SupportedCurrency = "EUR" | "USD" | "GBP" | "PLN" | "TRY";

export const BASE_CURRENCY = "EUR" as const;

/** Static display rates from EUR base (Stripe handles actual billing currency). */
const EUR_RATES: Record<SupportedCurrency, number> = {
  EUR: 1,
  USD: 1.08,
  GBP: 0.86,
  PLN: 4.32,
  TRY: 35.5,
};

const LOCALE_CURRENCY: Record<string, SupportedCurrency> = {
  en: "USD",
  "en-US": "USD",
  "en-GB": "GBP",
  de: "EUR",
  "de-DE": "EUR",
  fr: "EUR",
  es: "EUR",
  pl: "PLN",
  tr: "TRY",
};

const COUNTRY_CURRENCY: Record<string, SupportedCurrency> = {
  US: "USD",
  GB: "GBP",
  DE: "EUR",
  FR: "EUR",
  ES: "EUR",
  IT: "EUR",
  NL: "EUR",
  AT: "EUR",
  PL: "PLN",
  TR: "TRY",
};

export function detectCurrency(locale?: string, countryCode?: string | null): SupportedCurrency {
  if (countryCode && COUNTRY_CURRENCY[countryCode.toUpperCase()]) {
    return COUNTRY_CURRENCY[countryCode.toUpperCase()];
  }
  if (locale) {
    const direct = LOCALE_CURRENCY[locale];
    if (direct) return direct;
    const lang = locale.split("-")[0];
    if (LOCALE_CURRENCY[lang]) return LOCALE_CURRENCY[lang];
  }
  return BASE_CURRENCY;
}

export function convertFromEurCents(eurCents: number, currency: SupportedCurrency): number {
  if (currency === "EUR") return eurCents;
  const rate = EUR_RATES[currency] ?? 1;
  return Math.round(eurCents * rate);
}

export function formatMoneyFromCents(
  eurCents: number,
  locale = "en",
  currency?: SupportedCurrency
): string {
  const cur = currency ?? detectCurrency(locale);
  const amount = convertFromEurCents(eurCents, cur);
  try {
    return safeIntlNumberFormat(locale, {
      style: "currency",
      currency: cur,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${cur}`;
  }
}

export function formatMoneyWithInterval(
  eurCents: number,
  locale = "en",
  currency?: SupportedCurrency,
  interval = "month"
): string {
  const price = formatMoneyFromCents(eurCents, locale, currency);
  let intervalLabel = `/${interval}`;
  if (interval === "month") {
    try {
      intervalLabel = new Intl.RelativeTimeFormat(getIntlLocale(locale), { numeric: "always" })
        .format(1, "month")
        .replace(/^in /, "/");
    } catch {
      intervalLabel = "/mo";
    }
  }
  return `${price}${interval === "month" ? "/mo" : intervalLabel}`;
}

export function stripeCurrencyCode(currency: SupportedCurrency): string {
  return currency.toLowerCase();
}
