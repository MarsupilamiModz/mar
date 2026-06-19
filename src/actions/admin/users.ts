"use server";

import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import {
  canManageRole,
  fail,
  ok,
  requireActionPermission,
  type ActionResult,
} from "@/lib/action-utils";
import { hasPremiumAccess } from "@/lib/auth";
import { invalidateUserSessionCache } from "@/lib/auth-cache";

const roleSchema = z.nativeEnum(UserRole);

export async function getUsers(params: {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
  banned?: boolean;
  includeDeleted?: boolean;
}) {
  const { error } = await requireActionPermission("users.read");
  if (error) return error;

  const page = params.page ?? 1;
  const limit = Math.min(params.limit ?? 20, 100);
  const skip = (page - 1) * limit;

  const where = {
    ...(params.includeDeleted ? {} : { deletedAt: null }),
    ...(params.role && { role: params.role }),
    ...(params.banned !== undefined && { isBanned: params.banned }),
    ...(params.search && {
      OR: [
        { username: { contains: params.search, mode: "insensitive" as const } },
        { email: { contains: params.search, mode: "insensitive" as const } },
        { displayName: { contains: params.search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        isBanned: true,
        discordId: true,
        discordUsername: true,
        createdAt: true,
        deletedAt: true,
        subscriptions: { where: { status: "ACTIVE" }, select: { id: true, status: true } },
        membershipPurchases: {
          where: { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
          select: { id: true },
          take: 1,
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return ok({
    users: users.map((u) => ({
      ...u,
      isPremium: hasPremiumAccess({
        role: u.role,
        subscriptions: u.subscriptions,
        membershipPurchases: u.membershipPurchases,
      }),
    })),
    total,
    pages: Math.ceil(total / limit),
    page,
  });
}

export async function getUserDetail(userId: string) {
  const { error } = await requireActionPermission("users.read");
  if (error) return error;

  const target = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      subscriptions: { orderBy: { createdAt: "desc" } },
      membershipPurchases: {
        orderBy: { createdAt: "desc" },
        include: { plan: { select: { name: true, slug: true, priceCents: true } } },
      },
      banRecords: { orderBy: { createdAt: "desc" }, take: 10, include: { bannedBy: { select: { username: true } } } },
      supportTickets: { take: 5, orderBy: { updatedAt: "desc" } },
      _count: { select: { downloads: true, favorites: true, mods: true } },
    },
  });

  if (!target) return fail("User not found");

  const auditLogs = await prisma.auditLog.findMany({
    where: { OR: [{ entityId: userId }, { actorId: userId }] },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { actor: { select: { username: true } } },
  });

  return ok({ user: target, auditLogs });
}

export async function updateUserRole(
  userId: string,
  role: UserRole
): Promise<ActionResult> {
  const { user: actor, error } = await requireActionPermission("users.write");
  if (error) return error;

  const parsed = roleSchema.safeParse(role);
  if (!parsed.success) return fail("Invalid role");

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.deletedAt) return fail("User not found");
  if (!canManageRole(actor.role, target.role) || !canManageRole(actor.role, parsed.data)) {
    return fail("Cannot assign this role");
  }
  if (target.id === actor.id && parsed.data !== actor.role) {
    return fail("Cannot change your own role");
  }

  await prisma.user.update({ where: { id: userId }, data: { role: parsed.data } });
  await createAuditLog({
    actorId: actor.id,
    action: "user.role_change",
    entityType: "User",
    entityId: userId,
    metadata: { from: target.role, to: parsed.data },
  });

  if (target.supabaseId) {
    invalidateUserSessionCache(target.supabaseId);
  }

  const { invalidatePermissionCache } = await import("@/lib/permission-store");
  invalidatePermissionCache();
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  return ok(undefined);
}

export async function setUserPremium(
  userId: string,
  premium: boolean
): Promise<ActionResult> {
  const { user: actor, error } = await requireActionPermission("users.write");
  if (error) return error;

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.deletedAt) return fail("User not found");

  const newRole = premium
    ? ["USER", "PREMIUM"].includes(target.role)
      ? "PREMIUM"
      : target.role
    : target.role === "PREMIUM"
      ? "USER"
      : target.role;
  if (!canManageRole(actor.role, target.role)) return fail("Forbidden");

  await prisma.user.update({
    where: { id: userId },
    data: { role: newRole },
  });

  await createAuditLog({
    actorId: actor.id,
    action: premium ? "user.premium_grant" : "user.premium_revoke",
    entityType: "User",
    entityId: userId,
  });

  revalidatePath("/admin/users");
  return ok(undefined);
}

export async function assignUserPermissionGroup(
  userId: string,
  permissionGroupId: string | null
): Promise<ActionResult> {
  const { user: actor, error } = await requireActionPermission("users.write");
  if (error) return error;

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.deletedAt) return fail("User not found");
  if (!canManageRole(actor.role, target.role)) return fail("Forbidden");

  if (permissionGroupId) {
    const group = await prisma.permissionGroup.findUnique({ where: { id: permissionGroupId } });
    if (!group) return fail("Permission group not found");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { permissionGroupId },
  });

  if (target.supabaseId) {
    invalidateUserSessionCache(target.supabaseId);
  }

  await createAuditLog({
    actorId: actor.id,
    action: "user.permission_group",
    entityType: "User",
    entityId: userId,
    metadata: { permissionGroupId },
  });

  const { invalidatePermissionCache } = await import("@/lib/permission-store");
  invalidatePermissionCache();
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  return ok(undefined);
}

export async function banUser(
  userId: string,
  reason?: string
): Promise<ActionResult> {
  const { user: actor, error } = await requireActionPermission("users.write");
  if (error) return error;

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.deletedAt) return fail("User not found");
  if (target.id === actor.id) return fail("Cannot ban yourself");
  if (!canManageRole(actor.role, target.role)) return fail("Forbidden");

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { isBanned: true, banReason: reason, bannedAt: new Date(), bannedById: actor.id },
    }),
    prisma.userBan.create({
      data: { userId, reason, bannedById: actor.id },
    }),
  ]);

  await createAuditLog({
    actorId: actor.id,
    action: "user.ban",
    entityType: "User",
    entityId: userId,
    metadata: { reason },
  });

  revalidatePath("/admin/users");
  return ok(undefined);
}

export async function unbanUser(userId: string): Promise<ActionResult> {
  const { user: actor, error } = await requireActionPermission("users.write");
  if (error) return error;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { isBanned: false, banReason: null, bannedAt: null, bannedById: null },
    }),
    prisma.userBan.updateMany({
      where: { userId, liftedAt: null },
      data: { liftedAt: new Date() },
    }),
  ]);

  await createAuditLog({
    actorId: actor.id,
    action: "user.unban",
    entityType: "User",
    entityId: userId,
  });

  revalidatePath("/admin/users");
  return ok(undefined);
}

export async function softDeleteUser(userId: string): Promise<ActionResult> {
  const { user: actor, error } = await requireActionPermission("users.write");
  if (error) return error;

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return fail("User not found");
  if (target.id === actor.id) return fail("Cannot delete yourself");

  await prisma.user.update({
    where: { id: userId },
    data: { deletedAt: new Date() },
  });

  await createAuditLog({
    actorId: actor.id,
    action: "user.soft_delete",
    entityType: "User",
    entityId: userId,
  });

  revalidatePath("/admin/users");
  return ok(undefined);
}

export async function restoreUser(userId: string): Promise<ActionResult> {
  const { error } = await requireActionPermission("users.write");
  if (error) return error;

  await prisma.user.update({
    where: { id: userId },
    data: { deletedAt: null },
  });

  revalidatePath("/admin/users");
  return ok(undefined);
}

export async function permanentlyDeleteUser(userId: string): Promise<ActionResult> {
  const { user: actor, error } = await requireActionPermission("users.write");
  if (error) return error;
  if (actor.role !== "OWNER") return fail("Only owners can permanently delete users");

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return fail("User not found");
  if (target.id === actor.id) return fail("Cannot delete yourself");

  await prisma.user.delete({ where: { id: userId } });

  await createAuditLog({
    actorId: actor.id,
    action: "user.permanent_delete",
    entityType: "User",
    entityId: userId,
  });

  revalidatePath("/admin/users");
  return ok(undefined);
}
