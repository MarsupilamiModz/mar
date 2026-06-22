"use server";

import { revalidatePath } from "next/cache";
import { UserRole, type MembershipTier } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { fail, ok, requireActionOwner, type ActionResult } from "@/lib/action-utils";
import { invalidateUserSessionCache } from "@/lib/auth-cache";
import { createServiceClient } from "@/lib/supabase/server";
import { isValidEmail, normalizeEmail } from "@/lib/email/address";
import { PERMISSIONS, type PermissionKey } from "@/lib/permissions";
import { invalidatePermissionCache } from "@/lib/permission-store";
import { upsertUserMembership, syncUserRoleFromMembership } from "@/lib/user-membership";
import { uniqueUsername } from "@/lib/user-sync";

const banScopeSchema = z.enum(["ACCOUNT", "IP", "UPLOAD", "COMMENT"]);
const banDurationSchema = z.enum(["1d", "3d", "7d", "30d", "permanent"]);

function banExpires(duration: z.infer<typeof banDurationSchema>) {
  if (duration === "permanent") return null;
  const days = { "1d": 1, "3d": 3, "7d": 7, "30d": 30 }[duration];
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

export async function getOwnerUserManagementOverview(params?: {
  page?: number;
  search?: string;
  role?: UserRole;
  banned?: boolean;
}) {
  const { error } = await requireActionOwner();
  if (error) return error;

  const page = params?.page ?? 1;
  const limit = 25;
  const skip = (page - 1) * limit;

  const where = {
    deletedAt: null,
    ...(params?.role && { role: params.role }),
    ...(params?.banned !== undefined && { isBanned: params.banned }),
    ...(params?.search && {
      OR: [
        { username: { contains: params.search, mode: "insensitive" as const } },
        { email: { contains: params.search, mode: "insensitive" as const } },
        { displayName: { contains: params.search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [users, total, stats] = await Promise.all([
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
        isSuspended: true,
        uploadBanned: true,
        commentBanned: true,
        createdAt: true,
        userMembership: { select: { membershipType: true, status: true } },
        permissionGroup: { select: { name: true } },
      },
    }),
    prisma.user.count({ where }),
    Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { deletedAt: null, isBanned: true } }),
      prisma.creatorApplication.count({ where: { status: "PENDING" } }),
      prisma.partnerApplication.count({ where: { status: "PENDING" } }),
      prisma.supportTicket.count({ where: { status: { in: ["NEW", "OPEN", "PENDING"] } } }),
      prisma.contentReport.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW", "INVESTIGATING"] } } }),
    ]),
  ]);

  const [totalUsers, bannedUsers, pendingCreators, pendingPartners, openTickets, openReports] = stats;

  return ok({
    users,
    total,
    pages: Math.ceil(total / limit),
    page,
    stats: {
      totalUsers,
      bannedUsers,
      pendingCreators,
      pendingPartners,
      openTickets,
      openReports,
    },
  });
}

export async function getOwnerUserDetail(userId: string) {
  const { error } = await requireActionOwner();
  if (error) return error;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userMembership: true,
      permissionGroup: true,
      subscriptions: { orderBy: { createdAt: "desc" }, take: 5 },
      membershipPurchases: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { plan: { select: { name: true, slug: true } } },
      },
      purchases: { orderBy: { createdAt: "desc" }, take: 10, include: { mod: { select: { title: true, slug: true } } } },
      shopPurchases: { orderBy: { createdAt: "desc" }, take: 10, include: { product: { select: { name: true } } } },
      mods: { orderBy: { updatedAt: "desc" }, take: 10, select: { id: true, title: true, slug: true, status: true } },
      supportTickets: { orderBy: { updatedAt: "desc" }, take: 10 },
      creatorApplications: { orderBy: { createdAt: "desc" }, take: 5 },
      partnerApplications: { orderBy: { createdAt: "desc" }, take: 5 },
      banRecords: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { bannedBy: { select: { username: true } } },
      },
      userPermissions: { orderBy: { permissionKey: "asc" } },
      roleHistory: {
        orderBy: { createdAt: "desc" },
        take: 30,
        include: { changedBy: { select: { username: true } } },
      },
      _count: { select: { downloads: true, favorites: true, mods: true, supportTickets: true } },
    },
  });

  if (!user) return fail("User not found");

  const auditLogs = await prisma.auditLog.findMany({
    where: { OR: [{ entityId: userId }, { actorId: userId }] },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { actor: { select: { username: true, role: true } } },
  });

  return ok({ user, auditLogs });
}

export async function ownerCreateUser(input: {
  email: string;
  username?: string;
  displayName?: string;
  role?: UserRole;
  password?: string;
}) {
  const { user: owner, error } = await requireActionOwner();
  if (error) return error;

  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) return fail("Invalid email");

  const username = input.username?.trim() || (await uniqueUsername(email.split("@")[0] ?? "user"));
  const admin = await createServiceClient();

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password: input.password || undefined,
    email_confirm: true,
    user_metadata: { full_name: input.displayName ?? username },
  });
  if (authError) return fail(authError.message);

  const dbUser = await prisma.user.create({
    data: {
      supabaseId: authData.user.id,
      email,
      username,
      displayName: input.displayName ?? username,
      role: input.role ?? "USER",
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  await createAuditLog({
    actorId: owner.id,
    action: "owner.user.create",
    entityType: "User",
    entityId: dbUser.id,
    metadata: { email, role: dbUser.role },
  });

  revalidatePath("/admin/owner/users");
  return ok({ id: dbUser.id });
}

export async function ownerUpdateUserRole(userId: string, role: UserRole, reason?: string) {
  const { user: owner, error } = await requireActionOwner();
  if (error) return error;
  if (userId === owner.id && role !== "OWNER") return fail("Cannot demote yourself");

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.deletedAt) return fail("User not found");

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { role } }),
    prisma.userRoleHistory.create({
      data: {
        userId,
        fromRole: target.role,
        toRole: role,
        changedById: owner.id,
        reason,
      },
    }),
  ]);

  await createAuditLog({
    actorId: owner.id,
    action: "owner.user.role_change",
    entityType: "User",
    entityId: userId,
    metadata: { from: target.role, to: role, reason },
  });

  if (target.supabaseId) invalidateUserSessionCache(target.supabaseId);
  invalidatePermissionCache();
  revalidatePath("/admin/owner/users");
  revalidatePath(`/admin/owner/users/${userId}`);
  return ok(undefined);
}

export async function ownerSetUserPermission(
  userId: string,
  permissionKey: PermissionKey,
  granted: boolean
) {
  const { user: owner, error } = await requireActionOwner();
  if (error) return error;
  if (!(permissionKey in PERMISSIONS)) return fail("Unknown permission");

  await prisma.userPermission.upsert({
    where: { userId_permissionKey: { userId, permissionKey } },
    create: { userId, permissionKey, granted, grantedById: owner.id },
    update: { granted, grantedById: owner.id },
  });

  await createAuditLog({
    actorId: owner.id,
    action: granted ? "owner.permission.grant" : "owner.permission.revoke",
    entityType: "User",
    entityId: userId,
    metadata: { permissionKey, granted },
  });

  invalidatePermissionCache();
  revalidatePath(`/admin/owner/users/${userId}`);
  return ok(undefined);
}

export async function ownerAssignMembership(
  userId: string,
  tier: MembershipTier,
  options?: { extendDays?: number; lifetime?: boolean }
) {
  const { user: owner, error } = await requireActionOwner();
  if (error) return error;

  const renewal = options?.lifetime ? null : new Date(Date.now() + (options?.extendDays ?? 30) * 86400000);

  await upsertUserMembership({
    userId,
    membershipType: tier,
    status: "ACTIVE",
    renewalDate: renewal,
    isLifetime: options?.lifetime ?? false,
  });
  await syncUserRoleFromMembership(userId);

  await createAuditLog({
    actorId: owner.id,
    action: "owner.membership.assign",
    entityType: "User",
    entityId: userId,
    metadata: { tier, extendDays: options?.extendDays, lifetime: options?.lifetime },
  });

  revalidatePath(`/admin/owner/users/${userId}`);
  return ok(undefined);
}

export async function ownerEnterpriseBan(input: {
  userId: string;
  reason: string;
  scope: z.infer<typeof banScopeSchema>;
  duration: z.infer<typeof banDurationSchema>;
  ipHash?: string;
  internalNote?: string;
}): Promise<ActionResult> {
  const { user: owner, error } = await requireActionOwner();
  if (error) return error;

  const parsed = z
    .object({
      userId: z.string().cuid(),
      reason: z.string().min(3).max(500),
      scope: banScopeSchema,
      duration: banDurationSchema,
      ipHash: z.string().optional(),
      internalNote: z.string().max(2000).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return fail(parsed.error.message);
  if (parsed.data.userId === owner.id) return fail("Cannot ban yourself");

  const expiresAt = banExpires(parsed.data.duration);
  const banType = parsed.data.duration === "permanent" ? "PERMANENT" : "TEMPORARY";

  const userUpdate: Record<string, unknown> = {};
  if (parsed.data.scope === "ACCOUNT") {
    userUpdate.isBanned = true;
    userUpdate.banReason = parsed.data.reason;
    userUpdate.bannedAt = new Date();
    userUpdate.bannedById = owner.id;
    userUpdate.banExpiresAt = expiresAt;
  } else if (parsed.data.scope === "UPLOAD") {
    userUpdate.uploadBanned = true;
  } else if (parsed.data.scope === "COMMENT") {
    userUpdate.commentBanned = true;
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: parsed.data.userId }, data: userUpdate }),
    prisma.userBan.create({
      data: {
        userId: parsed.data.userId,
        reason: parsed.data.reason,
        banType,
        banScope: parsed.data.scope,
        ipHash: parsed.data.ipHash,
        expiresAt,
        internalNote: parsed.data.internalNote,
        bannedById: owner.id,
      },
    }),
  ]);

  const target = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { supabaseId: true },
  });
  if (target?.supabaseId) invalidateUserSessionCache(target.supabaseId);

  await createAuditLog({
    actorId: owner.id,
    action: "owner.user.ban",
    entityType: "User",
    entityId: parsed.data.userId,
    metadata: {
      reason: parsed.data.reason,
      scope: parsed.data.scope,
      duration: parsed.data.duration,
    },
  });

  revalidatePath("/admin/owner/users");
  revalidatePath(`/admin/owner/users/${parsed.data.userId}`);
  return ok(undefined);
}

export async function ownerLiftBan(userId: string, scope = "ACCOUNT") {
  const { user: owner, error } = await requireActionOwner();
  if (error) return error;

  const userUpdate: Record<string, unknown> = {};
  if (scope === "ACCOUNT") {
    userUpdate.isBanned = false;
    userUpdate.banReason = null;
    userUpdate.bannedAt = null;
    userUpdate.bannedById = null;
    userUpdate.banExpiresAt = null;
  } else if (scope === "UPLOAD") {
    userUpdate.uploadBanned = false;
  } else if (scope === "COMMENT") {
    userUpdate.commentBanned = false;
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: userUpdate }),
    prisma.userBan.updateMany({
      where: { userId, banScope: scope, liftedAt: null },
      data: { liftedAt: new Date() },
    }),
  ]);

  await createAuditLog({
    actorId: owner.id,
    action: "owner.user.unban",
    entityType: "User",
    entityId: userId,
    metadata: { scope },
  });

  revalidatePath("/admin/owner/users");
  revalidatePath(`/admin/owner/users/${userId}`);
  return ok(undefined);
}

export async function ownerSoftDeleteUser(userId: string) {
  const { user: owner, error } = await requireActionOwner();
  if (error) return error;
  if (userId === owner.id) return fail("Cannot delete yourself");

  await prisma.user.update({ where: { id: userId }, data: { deletedAt: new Date() } });
  await createAuditLog({
    actorId: owner.id,
    action: "owner.user.soft_delete",
    entityType: "User",
    entityId: userId,
  });
  revalidatePath("/admin/owner/users");
  return ok(undefined);
}

export async function ownerRestoreUser(userId: string) {
  const { user: owner, error } = await requireActionOwner();
  if (error) return error;

  await prisma.user.update({ where: { id: userId }, data: { deletedAt: null } });
  await createAuditLog({
    actorId: owner.id,
    action: "owner.user.restore",
    entityType: "User",
    entityId: userId,
  });
  revalidatePath("/admin/owner/users");
  return ok(undefined);
}

export async function ownerSuspendUser(userId: string, suspended: boolean, reason?: string) {
  const { user: owner, error } = await requireActionOwner();
  if (error) return error;

  await prisma.user.update({
    where: { id: userId },
    data: { isSuspended: suspended },
  });

  await createAuditLog({
    actorId: owner.id,
    action: suspended ? "owner.user.suspend" : "owner.user.unsuspend",
    entityType: "User",
    entityId: userId,
    metadata: { reason },
  });

  revalidatePath(`/admin/owner/users/${userId}`);
  return ok(undefined);
}
