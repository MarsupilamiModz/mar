import { defaultLocale } from "@/i18n/config";

/** Never send users back to login/register after auth — fixes redirect loops. */
export function sanitizeAuthReturnPath(locale: string, returnPath?: string | null): string {
  const safeLocale = locale || defaultLocale;
  const fallback = `/${safeLocale}/dashboard`;

  if (!returnPath || !returnPath.trim()) return fallback;

  const normalized = returnPath.trim();
  if (
    normalized.includes("/login") ||
    normalized.includes("/register") ||
    normalized === `/${safeLocale}` ||
    normalized === "/"
  ) {
    return fallback;
  }

  return normalized.startsWith("/") ? normalized : fallback;
}

export function resolveLoginRedirect(
  locale: string,
  params: { redirect?: string | null; next?: string | null }
): string {
  return sanitizeAuthReturnPath(locale, params.redirect ?? params.next);
}
