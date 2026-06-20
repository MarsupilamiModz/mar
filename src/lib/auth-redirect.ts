import { UserRole } from "@prisma/client";
import { defaultLocale } from "@/i18n/config";
import { isStaff } from "@/lib/permissions";

type RoleHomeUser = {
  role: UserRole;
  creatorProfile?: { id: string } | null;
  partnerProfile?: { id: string } | null;
  designerProfile?: { id: string } | null;
};

/** Default landing page after login for each role. */
export function resolveRoleHomePath(locale: string, user: RoleHomeUser): string {
  const base = `/${locale || defaultLocale}`;

  switch (user.role) {
    case "OWNER":
      return `${base}/admin/owner`;
    case "ADMIN":
      return `${base}/admin`;
    case "MODERATOR":
      return `${base}/admin/moderation`;
    case "SUPPORT":
      return `${base}/admin/tickets`;
    case "DESIGNER":
      return `${base}/designer`;
    case "CREATOR":
      return `${base}/creator`;
    case "PARTNER":
      return `${base}/partner`;
    case "PREMIUM":
    case "USER":
    default:
      break;
  }

  if (user.creatorProfile) return `${base}/creator`;
  if (user.partnerProfile) return `${base}/partner`;
  if (user.designerProfile) return `${base}/designer`;
  if (isStaff(user.role)) return `${base}/admin`;

  return `${base}/dashboard`;
}

/** Never send users back to login/register after auth — fixes redirect loops. */
export function sanitizeAuthReturnPath(
  locale: string,
  returnPath?: string | null,
  user?: RoleHomeUser | null
): string {
  const safeLocale = locale || defaultLocale;
  const fallback = user ? resolveRoleHomePath(safeLocale, user) : `/${safeLocale}/dashboard`;

  if (!returnPath || !returnPath.trim()) return fallback;

  const normalized = returnPath.trim();
  if (
    normalized.includes("/login") ||
    normalized.includes("/register") ||
    normalized.includes("/auth/sync-error") ||
    normalized === `/${safeLocale}` ||
    normalized === "/"
  ) {
    return fallback;
  }

  return normalized.startsWith("/") ? normalized : fallback;
}

export function resolveLoginRedirect(
  locale: string,
  params: { redirect?: string | null; next?: string | null },
  user?: RoleHomeUser | null
): string {
  return sanitizeAuthReturnPath(locale, params.redirect ?? params.next, user);
}

/** True when the path is the generic post-login dashboard (role home should apply). */
export function isGenericDashboardPath(path: string, locale: string): boolean {
  const normalized = path.trim();
  return (
    normalized === `/${locale}/dashboard` ||
    normalized === "/dashboard" ||
    normalized === `/${locale}` ||
    normalized === "/"
  );
}
