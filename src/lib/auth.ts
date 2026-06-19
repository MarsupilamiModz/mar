import { cache } from "react";
import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { defaultLocale } from "@/i18n/config";
import { getSafeLocale } from "@/lib/i18n/safe-locale";
import { createClient } from "@/lib/supabase/server";
import { isAdmin, isStaff, isDesigner, canAccessStudio } from "@/lib/permissions";
import { userHasPermission } from "@/lib/permission-store";
import { ensurePrismaUser } from "@/lib/user-sync";
import { logPlatformError } from "@/lib/platform-log";
import type { PermissionKey } from "@/lib/permissions";

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
    console.error("[getSession]", err);
    return null;
  }
});

export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session) return null;

  try {
    const user = await ensurePrismaUser(session);
    if (user?.deletedAt) return null;
    return user;
  } catch (err) {
    void logPlatformError("auth:get-current-user", err);
    console.error("[getCurrentUser]", err);
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

export async function requireAuth(returnPath?: string) {
  const locale = await resolveAuthLocale();
  const loginBase = `/${locale}/login`;
  const loginPath = returnPath
    ? `${loginBase}?redirect=${encodeURIComponent(returnPath)}`
    : loginBase;
  const user = await getCurrentUser();
  if (!user) redirect(loginPath);
  if (user.isBanned) redirect(`/${locale}/banned`);
  return user;
}

export async function requireRole(...roles: UserRole[]) {
  const locale = await resolveAuthLocale();
  const user = await requireAuth();
  if (!roles.includes(user.role)) redirect(`/${locale}/dashboard`);
  return user;
}

export async function requireStaff() {
  const locale = await resolveAuthLocale();
  const user = await requireAuth();
  if (!isStaff(user.role)) redirect(`/${locale}/dashboard`);
  return user;
}

export async function requireAdmin() {
  const locale = await resolveAuthLocale();
  const user = await requireAuth();
  if (!isAdmin(user.role)) redirect(`/${locale}/dashboard`);
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
  return user;
}

export async function requireAuthApi() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.isBanned) return null;
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
