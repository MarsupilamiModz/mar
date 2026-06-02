export function formatNumber(value: number, locale: string) {
  return value.toLocaleString(locale);
}

export function formatEuro(cents: number, locale: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function formatDateTime(value: Date | number | string, locale: string) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}
