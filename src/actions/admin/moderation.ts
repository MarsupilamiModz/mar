"use server";

import { revalidatePath } from "next/cache";
import { ModerationAction, UserRole, type Prisma } from "@prisma/client";
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
import { invalidateUserSessionCache } from "@/lib/auth-cache";
import { banExpiresFromPreset, type BanDurationPreset } from "@/lib/user-moderation";

const banSchema = z.object({
  userId: z.string().cuid(),
  reason: z.string().min(3).max(500),
  internalNote: z.string().max(2000).optional(),
  duration: z.enum(["1d", "3d", "7d", "30d", "permanent"]),
});

async function logModeration(
  userId: string,
  actorId: string,
  action: ModerationAction,
  reason?: string | null,
  internalNote?: string | null,
  expiresAt?: Date | null,
  metadata?: Prisma.InputJsonValue
) {
  await prisma.userModerationLog.create({
    data: {
      userId,
      actorId,
      action,
      reason: reason ?? null,
      internalNote: internalNote ?? null,
      expiresAt: expiresAt ?? null,
      metadata: metadata ?? undefined,
    },
  });
}

async function assertCanModerate(actorId: string, actorRole: UserRole, targetId: string) {
  if (actorId === targetId) return fail("Cannot moderate yourself");
  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, role: true, deletedAt: true, supabaseId: true },
  });
  if (!target || target.deletedAt) return fail("User not found");
  if (!canManageRole(actorRole, target.role)) return fail("Forbidden");
  return ok(target);
}

export async function getModerationOverview(params?: { search?: string; page?: number }) {
  const { error } = await requireActionPermission("users.read");
  if (error) return error;

  const page = params?.page ?? 1;
  const limit = 25;
  const skip = (page - 1) * limit;

  const where = {
    deletedAt: null,
    ...(params?.search && {
      OR: [
        { username: { contains: params.search, mode: "insensitive" as const } },
        { email: { contains: params.search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [users, total, recentLogs, flagged] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        role: true,
        isBanned: true,
        isSuspended: true,
        isMuted: true,
        warningCount: true,
        banReason: true,
        banExpiresAt: true,
        bannedAt: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
    prisma.userModerationLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        user: { select: { username: true } },
        actor: { select: { username: true } },
      },
    }),
    prisma.user.count({
      where: { deletedAt: null, OR: [{ isBanned: true }, { isSuspended: true }, { warningCount: { gt: 0 } }] },
    }),
  ]);

  return ok({ users, total, pages: Math.ceil(total / limit), page, recentLogs, flagged });
}

export async function moderateBanUser(input: z.infer<typeof banSchema>): Promise<ActionResult> {
  const { user: actor, error } = await requireActionPermission("users.write");
  if (error) return error;

  const parsed = banSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.message);

  const check = await assertCanModerate(actor.id, actor.role, parsed.data.userId);
  if (!check.success) return check;

  const expiresAt = banExpiresFromPreset(parsed.data.duration as BanDurationPreset);
  const banType = parsed.data.duration === "permanent" ? "PERMANENT" : "TEMPORARY";
  const action: ModerationAction =
    parsed.data.duration === "permanent" ? "BAN_PERMANENT" : "BAN_TEMPORARY";

  await prisma.$transaction([
    prisma.user.update({
      where: { id: parsed.data.userId },
      data: {
        isBanned: true,
        banReason: parsed.data.reason,
        banExpiresAt: expiresAt,
        bannedAt: new Date(),
        bannedById: actor.id,
        moderationNote: parsed.data.internalNote ?? null,
      },
    }),
    prisma.userBan.create({
      data: {
        userId: parsed.data.userId,
        reason: parsed.data.reason,
        internalNote: parsed.data.internalNote,
        banType,
        expiresAt,
        bannedById: actor.id,
      },
    }),
  ]);

  const target = check.data!;
  if (target.supabaseId) invalidateUserSessionCache(target.supabaseId);

  await logModeration(
    parsed.data.userId,
    actor.id,
    action,
    parsed.data.reason,
    parsed.data.internalNote,
    expiresAt,
    { duration: parsed.data.duration }
  );
  await createAuditLog({
    actorId: actor.id,
    action: "user.ban",
    entityType: "User",
    entityId: parsed.data.userId,
    metadata: { reason: parsed.data.reason, duration: parsed.data.duration },
  });

  revalidatePath("/admin/moderation");
  revalidatePath("/admin/users");
  return ok(undefined);
}

export async function moderateUnbanUser(userId: string, note?: string): Promise<ActionResult> {
  const { user: actor, error } = await requireActionPermission("users.write");
  if (error) return error;

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return fail("User not found");

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        isBanned: false,
        banReason: null,
        banExpiresAt: null,
        bannedAt: null,
        bannedById: null,
      },
    }),
    prisma.userBan.updateMany({
      where: { userId, liftedAt: null },
      data: { liftedAt: new Date() },
    }),
  ]);

  if (target.supabaseId) invalidateUserSessionCache(target.supabaseId);

  await logModeration(userId, actor.id, "UNBAN", note ?? "Ban lifted by admin");
  await createAuditLog({ actorId: actor.id, action: "user.unban", entityType: "User", entityId: userId });

  revalidatePath("/admin/moderation");
  revalidatePath("/admin/users");
  return ok(undefined);
}

export async function moderateSuspendUser(userId: string, reason: string): Promise<ActionResult> {
  const { user: actor, error } = await requireActionPermission("users.write");
  if (error) return error;

  const check = await assertCanModerate(actor.id, actor.role, userId);
  if (!check.success) return check;

  await prisma.user.update({ where: { id: userId }, data: { isSuspended: true, moderationNote: reason } });
  await logModeration(userId, actor.id, "SUSPEND", reason);
  await createAuditLog({
    actorId: actor.id,
    action: "user.suspend",
    entityType: "User",
    entityId: userId,
    metadata: { reason },
  });

  revalidatePath("/admin/moderation");
  return ok(undefined);
}

export async function moderateUnsuspendUser(userId: string): Promise<ActionResult> {
  const { user: actor, error } = await requireActionPermission("users.write");
  if (error) return error;

  await prisma.user.update({ where: { id: userId }, data: { isSuspended: false } });
  await logModeration(userId, actor.id, "UNSUSPEND");
  revalidatePath("/admin/moderation");
  return ok(undefined);
}

export async function moderateMuteUser(userId: string, reason?: string): Promise<ActionResult> {
  const { user: actor, error } = await requireActionPermission("users.write");
  if (error) return error;

  const check = await assertCanModerate(actor.id, actor.role, userId);
  if (!check.success) return check;

  await prisma.user.update({ where: { id: userId }, data: { isMuted: true } });
  await logModeration(userId, actor.id, "MUTE", reason);
  revalidatePath("/admin/moderation");
  return ok(undefined);
}

export async function moderateUnmuteUser(userId: string): Promise<ActionResult> {
  const { user: actor, error } = await requireActionPermission("users.write");
  if (error) return error;

  await prisma.user.update({ where: { id: userId }, data: { isMuted: false } });
  await logModeration(userId, actor.id, "UNMUTE");
  revalidatePath("/admin/moderation");
  return ok(undefined);
}

export async function moderateWarnUser(userId: string, reason: string): Promise<ActionResult> {
  const { user: actor, error } = await requireActionPermission("users.write");
  if (error) return error;

  const check = await assertCanModerate(actor.id, actor.role, userId);
  if (!check.success) return check;

  await prisma.user.update({
    where: { id: userId },
    data: { warningCount: { increment: 1 }, moderationNote: reason },
  });
  await logModeration(userId, actor.id, "WARN", reason);
  await createAuditLog({
    actorId: actor.id,
    action: "user.warn",
    entityType: "User",
    entityId: userId,
    metadata: { reason },
  });

  revalidatePath("/admin/moderation");
  return ok(undefined);
}

export async function moderateResetWarnings(userId: string): Promise<ActionResult> {
  const { user: actor, error } = await requireActionPermission("users.write");
  if (error) return error;

  await prisma.user.update({ where: { id: userId }, data: { warningCount: 0 } });
  await logModeration(userId, actor.id, "RESET_WARNINGS");
  revalidatePath("/admin/moderation");
  return ok(undefined);
}

export async function moderateSoftDeleteUser(userId: string, reason: string): Promise<ActionResult> {
  const { user: actor, error } = await requireActionPermission("users.write");
  if (error) return error;

  const check = await assertCanModerate(actor.id, actor.role, userId);
  if (!check.success) return check;

  await prisma.user.update({ where: { id: userId }, data: { deletedAt: new Date() } });
  await logModeration(userId, actor.id, "SOFT_DELETE", reason);
  await createAuditLog({ actorId: actor.id, action: "user.soft_delete", entityType: "User", entityId: userId });

  revalidatePath("/admin/moderation");
  revalidatePath("/admin/users");
  return ok(undefined);
}

export async function moderateRestoreUser(userId: string): Promise<ActionResult> {
  const { user: actor, error } = await requireActionPermission("users.write");
  if (error) return error;

  await prisma.user.update({ where: { id: userId }, data: { deletedAt: null } });
  await logModeration(userId, actor.id, "RESTORE");
  revalidatePath("/admin/moderation");
  revalidatePath("/admin/users");
  return ok(undefined);
}

export async function backfillSoundMetadata(limit = 20) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  const profiles = await prisma.soundProfile.findMany({
    where: {
      previewFileKey: { not: null },
      OR: [
        { previewDurationSeconds: null },
        { previewDurationSeconds: 0 },
        { durationSeconds: null },
        { durationSeconds: 0 },
      ],
    },
    take: limit,
    select: { modId: true },
  });

  const { ensureSoundProfileMetadata } = await import("@/lib/audio-probe");
  let updated = 0;
  for (const p of profiles) {
    const result = await ensureSoundProfileMetadata(p.modId);
    if (result?.previewDurationSeconds || result?.durationSeconds) updated++;
  }

  revalidatePath("/admin/security");
  return ok({ scanned: profiles.length, updated });
}
