"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { ok, requireActionPermission } from "@/lib/action-utils";
import { seedDefaultAchievements } from "@/lib/achievements";
import type { AchievementCategory, AchievementRarity, Prisma } from "@prisma/client";

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

export async function saveAchievement(input: {
  id?: string;
  slug: string;
  name: string;
  description?: string;
  title?: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  icon?: string;
  xpReward?: number;
  isHidden?: boolean;
  isSeasonal?: boolean;
  seasonStart?: string;
  seasonEnd?: string;
  unlockRule?: Record<string, unknown>;
  animated?: boolean;
  glowEffect?: boolean;
  isActive?: boolean;
  translations?: Record<string, unknown>;
}) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  const data = {
    slug: input.slug,
    name: input.name,
    description: input.description,
    title: input.title,
    category: input.category,
    rarity: input.rarity,
    icon: input.icon,
    xpReward: input.xpReward ?? 0,
    isHidden: input.isHidden ?? false,
    isSeasonal: input.isSeasonal ?? false,
    seasonStart: input.seasonStart ? new Date(input.seasonStart) : null,
    seasonEnd: input.seasonEnd ? new Date(input.seasonEnd) : null,
    unlockRule: (input.unlockRule ?? undefined) as Prisma.InputJsonValue | undefined,
    animated: input.animated ?? false,
    glowEffect: input.glowEffect ?? true,
    isActive: input.isActive ?? true,
    translations: (input.translations ?? undefined) as Prisma.InputJsonValue | undefined,
  };

  if (input.id) {
    await prisma.achievement.update({ where: { id: input.id }, data });
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

  await prisma.userAchievement.upsert({
    where: { userId_achievementId: { userId, achievementId } },
    create: { userId, achievementId, grantedById: user.id, progress: 100 },
    update: { progress: 100 },
  });
  revalidatePath(`/admin/users/${userId}`);
  return ok(undefined);
}

export async function revokeAchievementFromUser(userId: string, achievementId: string) {
  const { error } = await requireActionPermission("users.write");
  if (error) return error;
  await prisma.userAchievement.delete({
    where: { userId_achievementId: { userId, achievementId } },
  }).catch(() => null);
  revalidatePath(`/admin/users/${userId}`);
  return ok(undefined);
}
