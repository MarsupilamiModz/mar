"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, requireActionPermission, fail, formatZodError } from "@/lib/action-utils";
import { seedDefaultAchievements } from "@/lib/achievements";
import { resolveSlug, ensureUniqueSlug, zSlugInput } from "@/lib/slug";
import type { AchievementCategory, AchievementRarity, Prisma } from "@prisma/client";

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
