import { cache } from "react";
import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { isAdmin, isStaff, isDesigner, canAccessStudio } from "@/lib/permissions";

export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});

export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session) return null;

  let user = await prisma.user.findUnique({
    where: { supabaseId: session.id },
    include: {
      creatorProfile: true,
      designerProfile: true,
      subscriptions: { where: { status: "ACTIVE" }, select: { status: true } },
    },
  });

  if (user?.deletedAt) return null;

  if (!user) {
    const username = session.email?.split("@")[0] ?? `user_${session.id.slice(0, 8)}`;
    const base = username.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20) || "user";
    let uniqueUsername = base;
    let i = 0;
    while (await prisma.user.findUnique({ where: { username: uniqueUsername } })) {
      uniqueUsername = `${base}${++i}`;
    }

    user = await prisma.user.create({
      data: {
        supabaseId: session.id,
        email: session.email!,
        username: uniqueUsername,
        displayName: session.user_metadata?.full_name ?? uniqueUsername,
        avatarUrl: session.user_metadata?.avatar_url,
        emailVerified: !!session.email_confirmed_at,
        discordId: session.user_metadata?.provider_id,
      },
      include: {
        creatorProfile: true,
        designerProfile: true,
        subscriptions: { where: { status: "ACTIVE" }, select: { status: true } },
      },
    });
  }

  return user;
});

export async function requireAuth(redirectTo?: string) {
  const locale = await getLocale();
  const loginPath = redirectTo ?? `/${locale}/login`;
  const user = await getCurrentUser();
  if (!user) redirect(loginPath);
  if (user.isBanned) redirect(`/${locale}/banned`);
  return user;
}

export async function requireRole(...roles: UserRole[]) {
  const locale = await getLocale();
  const user = await requireAuth();
  if (!roles.includes(user.role)) redirect(`/${locale}/dashboard`);
  return user;
}

export async function requireStaff() {
  const locale = await getLocale();
  const user = await requireAuth();
  if (!isStaff(user.role)) redirect(`/${locale}/dashboard`);
  return user;
}

export async function requireAdmin() {
  const locale = await getLocale();
  const user = await requireAuth();
  if (!isAdmin(user.role)) redirect(`/${locale}/dashboard`);
  return user;
}

export async function requireDesigner() {
  const locale = await getLocale();
  const user = await requireAuth();
  if (!isDesigner(user.role) && !user.designerProfile) {
    redirect(`/${locale}/dashboard`);
  }
  return user;
}

export async function requireStudio() {
  const locale = await getLocale();
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
