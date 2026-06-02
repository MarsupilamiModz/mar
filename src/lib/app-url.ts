import { defaultLocale, type Locale } from "@/i18n/config";

const PRODUCTION_HOSTS = new Set([
  "www.xumari-modz.com",
  "xumari-modz.com",
  "xumarimodz.com",
  "www.xumarimodz.com",
  // Legacy hosts — keep redirects working during migration
  "www.marsupilami-modz.com",
  "marsupilami-modz.com",
  "marsupilamimodz.com",
  "www.marsupilamimodz.com",
]);

/** Resolve the public app origin for redirects, emails, and OAuth. */
export function getAppUrl(): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (env) return env;

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  if (process.env.NODE_ENV === "production") {
    return "https://www.xumari-modz.com";
  }

  return "http://localhost:3000";
}

export function isProductionHost(host: string | null): boolean {
  if (!host) return process.env.NODE_ENV === "production";
  const normalized = host.split(":")[0]?.toLowerCase() ?? "";
  return PRODUCTION_HOSTS.has(normalized);
}

/** Build a locale-prefixed path on the current app origin. */
export function appPath(locale: string, path: string): string {
  const base = getAppUrl();
  const clean = path.startsWith("/") ? path : `/${path}`;
  const loc = locale || defaultLocale;
  if (clean === `/${loc}` || clean.startsWith(`/${loc}/`)) {
    return `${base}${clean}`;
  }
  return `${base}/${loc}${clean === "/" ? "" : clean}`;
}

export function appPathForLocale(locale: Locale | string, path: string): string {
  return appPath(locale, path);
}
