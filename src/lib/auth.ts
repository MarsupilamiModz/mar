import { cache } from "react";
import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { defaultLocale } from "@/i18n/config";
import { getSafeLocale } from "@/lib/i18n/safe-locale";
import { createClient } from "@/lib/supabase/server";
import { isAdmin, isStaff, isDesigner, canAccessStudio } from "@/lib/permissions";
import { userHasPermission } from "@/lib/permission-store";
import { ensurePrismaUser, findAppUserBySupabaseId } from "@/lib/user-sync";
import { logPlatformError } from "@/lib/platform-log";
import { resolveActiveBan } from "@/lib/user-moderation";
import { sanitizeAuthReturnPath } from "@/lib/auth-redirect";
import { requiresMfa } from "@/lib/user-security";
import { withDbRetry } from "@/lib/db";
import type { PermissionKey } from "@/lib/permissions";
import type { AppUser, CurrentAppUser } from "@/lib/auth-cache";
import type { User } from "@supabase/supabase-js";
import { isDynamicServerUsageError } from "@/lib/is-dynamic-server-error";

export const getSession = cache(async () => {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) {
      const msg = error.message ?? "";
      if (!msg.toLowerCase().includes("session") && !msg.toLowerCase().includes("jwt")) {
        console.error("[getSession]", msg);
      }
      return null;
    }
    return user;
  } catch (err) {
    if (!isDynamicServerUsageError(err)) {
      console.error("[getSession]", err);
    }
    return null;
  }
});

async function applyBanState(user: AppUser): Promise<CurrentAppUser> {
  try {
    const banState = await resolveActiveBan(user.id);
    if (banState?.isBanned) {
      return {
        ...user,
        isBanned: true,
        banReason: banState.banReason ?? user.banReason,
      };
    }
  } catch (banErr) {
    console.warn("[getCurrentUser] ban check skipped", banErr);
  }
  return user;
}

async function recoverPrismaUserFromSession(session: User): Promise<AppUser | null> {
  const direct = await withDbRetry(
    () => findAppUserBySupabaseId(session.id),
    { retries: 2, label: "auth:recover-direct" }
  );
  if (!direct || direct.deletedAt) return null;

  try {
    return await withDbRetry(() => ensurePrismaUser(session), { label: "auth:recover-sync" });
  } catch {
    return direct;
  }
}

export const getCurrentUser = cache(async (): Promise<CurrentAppUser | null> => {
  const session = await getSession();
  if (!session) return null;

  try {
    let user = await ensurePrismaUser(session);

    if (!user) {
      user = await recoverPrismaUserFromSession(session);
    }

    if (user?.deletedAt) return null;
    if (!user) return null;

    return applyBanState(user);
  } catch (err) {
    void logPlatformError("auth:get-current-user", err);
    console.error("[getCurrentUser]", err);

    const recovered = await recoverPrismaUserFromSession(session);
    if (recovered && !recovered.deletedAt) {
      return applyBanState(recovered);
    }
    return null;
  }
});

async function resolveAuthLocale(): Promise<string> {
  try {
    return getSafeLocale(await getLocale());
  } catch {
    return defaultLocale;
  }
}

async function resolveAuthReturnPath(returnPath?: string): Promise<string | undefined> {
  if (returnPath && !returnPath.includes("/login") && !returnPath.includes("/register")) {
    return returnPath;
  }
  try {
    const pathname = (await headers()).get("x-pathname");
    if (pathname && !pathname.includes("/login") && !pathname.includes("/register")) {
      return pathname;
    }
  } catch {
    /* headers unavailable */
  }
  return returnPath;
}

export async function requireAuth(returnPath?: string) {
  const locale = await resolveAuthLocale();
  const rawReturn = await resolveAuthReturnPath(returnPath);
  const loginPath = `/${locale}/login?redirect=${encodeURIComponent(
    sanitizeAuthReturnPath(locale, rawReturn)
  )}`;

  const session = await getSession();
  if (!session) {
    redirect(loginPath);
  }

  let user = await getCurrentUser();
  if (!user) {
    user = await recoverPrismaUserFromSession(session);
    if (user && !user.deletedAt) {
      user = await applyBanState(user);
    }
  }

  if (!user) {
    const destination = sanitizeAuthReturnPath(locale, rawReturn);
    redirect(`/${locale}/auth/sync-error?redirect=${encodeURIComponent(destination)}`);
  }

  if (user.isBanned) redirect(`/${locale}/banned`);
  return user;
}

export async function requireRole(...roles: UserRole[]) {
  const locale = await resolveAuthLocale();
  const user = await requireAuth();
  if (!roles.includes(user.role)) redirect(`/${locale}/dashboard`);
  return user;
}

export async function redirectIfMfaRequired(user: { role: UserRole; mfaEnabled: boolean }) {
  if (!requiresMfa(user.role) || user.mfaEnabled) return;

  const h = await headers();
  if (h.get("next-action")) return;

  const locale = await resolveAuthLocale();
  redirect(`/${locale}/dashboard/security?required=1`);
}

export async function requireStaff() {
  const locale = await resolveAuthLocale();
  const user = await requireAuth();
  if (!isStaff(user.role)) redirect(`/${locale}/dashboard`);
  await redirectIfMfaRequired(user);
  return user;
}

export async function requireOwner() {
  const locale = await resolveAuthLocale();
  const user = await requireAuth();
  if (user.role !== "OWNER") redirect(`/${locale}/dashboard`);
  await redirectIfMfaRequired(user);
  return user;
}

export async function requireAdmin() {
  const locale = await resolveAuthLocale();
  const user = await requireAuth();
  if (!isAdmin(user.role)) redirect(`/${locale}/dashboard`);
  await redirectIfMfaRequired(user);
  return user;
}

export async function requireDesigner() {
  const locale = await resolveAuthLocale();
  const user = await requireAuth();
  if (!isDesigner(user.role) && !user.designerProfile) {
    redirect(`/${locale}/dashboard`);
  }
  return user;
}

export async function requirePagePermission(permission: PermissionKey) {
  const locale = await resolveAuthLocale();
  const user = await requireAuth();
  if (user.role === "OWNER") return user;
  const allowed = await userHasPermission(
    { id: user.id, role: user.role, permissionGroupId: user.permissionGroupId },
    permission
  );
  if (!allowed) redirect(`/${locale}/dashboard`);
  return user;
}

export async function requireStudio() {
  const locale = await resolveAuthLocale();
  const user = await requireAuth();
  if (!canAccessStudio(user.role) && !user.creatorProfile && !user.designerProfile) {
    redirect(`/${locale}/dashboard`);
  }
  await redirectIfMfaRequired(user);
  return user;
}

export async function requireAuthApi() {
  const session = await getSession();
  if (!session) return null;

  let user = await getCurrentUser();
  if (!user) {
    user = await recoverPrismaUserFromSession(session);
  }
  if (!user || user.isBanned) return null;
  return user;
}

export function hasPremiumAccess(user: {
  role: UserRole;
  subscriptions?: { status: string }[];
  membershipPurchases?: { id: string }[];
}) {
  return (
    user.role === "PREMIUM" ||
    user.role === "OWNER" ||
    user.role === "ADMIN" ||
    (user.membershipPurchases?.length ?? 0) > 0 ||
    (user.subscriptions?.some((s) => s.status === "ACTIVE") ?? false)
  );
}
