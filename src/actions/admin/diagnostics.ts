"use server";

import { getSession, getCurrentUser } from "@/lib/auth";
import { getEffectivePermissions } from "@/lib/permission-store";
import { prisma } from "@/lib/db";
import { checkDbHealth } from "@/lib/db";
import { ok, requireActionPermission } from "@/lib/action-utils";
import { hasModerationLogTable } from "@/lib/moderation-store";

export async function getAuthDiagnostics() {
  const { error } = await requireActionPermission("users.read");
  if (error) return error;

  const [user, session, dbHealth] = await Promise.all([
    getCurrentUser(),
    getSession(),
    checkDbHealth(),
  ]);

  const permissionGroup =
    user?.permissionGroupId != null
      ? await prisma.permissionGroup.findUnique({
          where: { id: user.permissionGroupId },
          select: { id: true, name: true, slug: true },
        })
      : null;

  const permissions = user
    ? Array.from(await getEffectivePermissions(user)).sort()
    : [];

  return ok({
    userId: user?.id ?? null,
    supabaseId: session?.id ?? null,
    email: user?.email ?? session?.email ?? null,
    role: user?.role ?? null,
    permissionGroup,
    permissions,
    sessionActive: Boolean(session),
    prismaLinked: Boolean(user),
    isBanned: user?.isBanned ?? false,
    isSuspended: (user as { isSuspended?: boolean } | null)?.isSuspended ?? false,
    db: dbHealth,
    moderationLogTable: hasModerationLogTable(),
    authProvider: session?.app_metadata?.provider ?? "email",
    env: {
      supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      r2Configured: Boolean(process.env.R2_ACCESS_KEY_ID && process.env.R2_BUCKET_NAME),
    },
  });
}
