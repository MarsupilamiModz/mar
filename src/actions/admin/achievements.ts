"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, requireActionPermission, requireActionOwner, fail, formatZodError } from "@/lib/action-utils";
import { seedDefaultAchievements, addUserXp } from "@/lib/achievements";
import { resolveSlug, ensureUniqueSlug, zSlugInput } from "@/lib/slug";
import { createAuditLog } from "@/lib/audit";
import { revalidateAchievementShowcase } from "@/lib/showcase-revalidate";
import { achievementCacheTag } from "@/lib/achievements";
import type { AchievementCategory, AchievementRarity, Prisma, UserRole } from "@prisma/client";

const achievementSchema = z.object({
  id: z.string().cuid().optional(),
  slug: zSlugInput,
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  title: z.string().max(80).optional(),
  category: z.enum(["USER", "CREATOR", "PARTNER", "SEASONAL", "HIDDEN"]),
  rarity: z.enum(["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY"]),
  icon: z.string().max(40).optional(),
  xpReward: z.number().int().min(0).optional(),
  isHidden: z.boolean().optional(),
  isSeasonal: z.boolean().optional(),
  seasonStart: z.string().optional(),
  seasonEnd: z.string().optional(),
  unlockRule: z.record(z.unknown()).optional(),
  animated: z.boolean().optional(),
  glowEffect: z.boolean().optional(),
  isActive: z.boolean().optional(),
  translations: z.record(z.unknown()).optional(),
});

async function revalidateUserAchievements(userId: string) {
  revalidatePath(`/admin/owner/users/${userId}`);
  revalidatePath(`/admin/users/${userId}`);
  revalidateTag(achievementCacheTag(userId));
  await revalidateAchievementShowcase(userId);
}

export async function getAdminAchievements() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  let rows = await prisma.achievement.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }] });
  if (rows.length === 0) {
    await seedDefaultAchievements();
    rows = await prisma.achievement.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }] });
  }
  return ok(rows);
}

export async function getUserAchievementsAdmin(userId: string) {
  const { error } = await requireActionPermission("users.read");
  if (error) return error;

  const rows = await prisma.userAchievement.findMany({
    where: { userId },
    include: {
      achievement: true,
    },
    orderBy: { unlockedAt: "desc" },
  });

  const granterIds = Array.from(
    new Set(rows.map((r) => r.grantedById).filter((id): id is string => Boolean(id)))
  );
  const granters =
    granterIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: granterIds } },
          select: { id: true, username: true, displayName: true },
        })
      : [];
  const granterMap = new Map(granters.map((g) => [g.id, g]));

  return ok(
    rows.map((r) => ({
      id: r.id,
      unlockedAt: r.unlockedAt,
      isShowcased: r.isShowcased,
      grantedBy: r.grantedById ? granterMap.get(r.grantedById) ?? null : null,
      achievement: r.achievement,
    }))
  );
}

export async function getAchievementAnalytics() {
  const { error } = await requireActionOwner();
  if (error) return error;

  const [grantCounts, achievements, topUsers] = await Promise.all([
    prisma.userAchievement.groupBy({
      by: ["achievementId"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
    prisma.achievement.findMany({ select: { id: true, name: true, slug: true, rarity: true, category: true } }),
    prisma.userAchievement.groupBy({
      by: ["userId"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),
  ]);

  const achievementMap = new Map(achievements.map((a) => [a.id, a]));
  const userIds = topUsers.map((u) => u.userId);
  const users =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, username: true, displayName: true },
        })
      : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const ranked = grantCounts
    .map((g) => ({
      achievement: achievementMap.get(g.achievementId)!,
      count: g._count.id,
    }))
    .filter((g) => g.achievement);

  return ok({
    totalGrants: grantCounts.reduce((acc, g) => acc + g._count.id, 0),
    mostGranted: ranked.slice(0, 10),
    rarest: [...ranked].sort((a, b) => a.count - b.count).slice(0, 10),
    topUsers: topUsers.map((u) => ({
      user: userMap.get(u.userId)!,
      badgeCount: u._count.id,
    })).filter((u) => u.user),
  });
}

export async function saveAchievement(input: z.infer<typeof achievementSchema>) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  const parsed = achievementSchema.safeParse(input);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  const resolved = resolveSlug({ name: parsed.data.name, slug: parsed.data.slug, fallbackPrefix: "achievement" });
  const slug = parsed.data.id
    ? resolved.slug
    : await ensureUniqueSlug(resolved.slug, async (s) =>
        Boolean(await prisma.achievement.findUnique({ where: { slug: s } }))
      );

  const data = {
    slug,
    name: parsed.data.name,
    description: parsed.data.description,
    title: parsed.data.title,
    category: parsed.data.category as AchievementCategory,
    rarity: parsed.data.rarity as AchievementRarity,
    icon: parsed.data.icon,
    xpReward: parsed.data.xpReward ?? 0,
    isHidden: parsed.data.isHidden ?? false,
    isSeasonal: parsed.data.isSeasonal ?? false,
    seasonStart: parsed.data.seasonStart ? new Date(parsed.data.seasonStart) : null,
    seasonEnd: parsed.data.seasonEnd ? new Date(parsed.data.seasonEnd) : null,
    unlockRule: (parsed.data.unlockRule ?? undefined) as Prisma.InputJsonValue | undefined,
    animated: parsed.data.animated ?? false,
    glowEffect: parsed.data.glowEffect ?? true,
    isActive: parsed.data.isActive ?? true,
    translations: (parsed.data.translations ?? undefined) as Prisma.InputJsonValue | undefined,
  };

  if (parsed.data.id) {
    await prisma.achievement.update({ where: { id: parsed.data.id }, data });
  } else {
    await prisma.achievement.create({ data });
  }
  revalidatePath("/admin/achievements");
  return ok(undefined);
}

export async function deleteAchievement(id: string) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  await prisma.achievement.delete({ where: { id } });
  revalidatePath("/admin/achievements");
  return ok(undefined);
}

export async function grantAchievementToUser(userId: string, achievementId: string) {
  const { user, error } = await requireActionPermission("users.write");
  if (error) return error;

  const achievement = await prisma.achievement.findUnique({ where: { id: achievementId } });
  if (!achievement) return fail("Achievement not found");

  const existing = await prisma.userAchievement.findUnique({
    where: { userId_achievementId: { userId, achievementId } },
  });

  await prisma.userAchievement.upsert({
    where: { userId_achievementId: { userId, achievementId } },
    create: { userId, achievementId, grantedById: user.id, progress: 100 },
    update: { grantedById: user.id, progress: 100 },
  });

  if (!existing && achievement.xpReward > 0) {
    await addUserXp(userId, achievement.xpReward);
  }

  await createAuditLog({
    actorId: user.id,
    action: "achievement.grant",
    entityType: "UserAchievement",
    entityId: userId,
    metadata: { achievementId, achievementSlug: achievement.slug },
  });

  await revalidateUserAchievements(userId);
  return ok(undefined);
}

export async function revokeAchievementFromUser(userId: string, achievementId: string) {
  const { user, error } = await requireActionPermission("users.write");
  if (error) return error;

  await prisma.userAchievement.delete({
    where: { userId_achievementId: { userId, achievementId } },
  }).catch(() => null);

  await createAuditLog({
    actorId: user.id,
    action: "achievement.revoke",
    entityType: "UserAchievement",
    entityId: userId,
    metadata: { achievementId },
  });

  await revalidateUserAchievements(userId);
  return ok(undefined);
}

export async function bulkGrantAchievement(input: {
  achievementId: string;
  userIds?: string[];
  role?: UserRole;
  premiumOnly?: boolean;
}) {
  const { user, error } = await requireActionOwner();
  if (error) return error;

  const achievement = await prisma.achievement.findUnique({ where: { id: input.achievementId } });
  if (!achievement) return fail("Achievement not found");

  let userIds = input.userIds ?? [];
  if (input.role) {
    const users = await prisma.user.findMany({
      where: { role: input.role, deletedAt: null, isBanned: false },
      select: { id: true },
    });
    userIds = users.map((u) => u.id);
  }
  if (input.premiumOnly) {
    const premiumUsers = await prisma.userMembership.findMany({
      where: { status: "ACTIVE", membershipType: { not: "FREE" } },
      select: { userId: true },
    });
    userIds = premiumUsers.map((u) => u.userId);
  }

  if (userIds.length === 0) return fail("No users matched");

  let granted = 0;
  for (const userId of userIds) {
    const existing = await prisma.userAchievement.findUnique({
      where: { userId_achievementId: { userId, achievementId: input.achievementId } },
    });
    if (existing) continue;

    await prisma.userAchievement.create({
      data: { userId, achievementId: input.achievementId, grantedById: user.id, progress: 100 },
    });
    if (achievement.xpReward > 0) await addUserXp(userId, achievement.xpReward);
    granted++;
    void revalidateUserAchievements(userId);
  }

  await createAuditLog({
    actorId: user.id,
    action: "achievement.bulk_grant",
    entityType: "Achievement",
    entityId: input.achievementId,
    metadata: { granted, totalTargets: userIds.length },
  });

  revalidatePath("/admin/owner/achievements");
  return ok({ granted, total: userIds.length });
}
