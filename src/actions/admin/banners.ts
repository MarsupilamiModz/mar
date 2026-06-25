"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SiteBannerFrequency, SiteBannerType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { actionTry, fail, formatZodError, requireActionPermission } from "@/lib/action-utils";

const bannerSchema = z.object({
  type: z.nativeEnum(SiteBannerType),
  title: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  imageUrl: z.string().max(500).optional(),
  linkUrl: z.string().max(500).optional(),
  buttonText: z.string().max(80).optional(),
  frequency: z.nativeEnum(SiteBannerFrequency).default("ALWAYS"),
  isActive: z.boolean().optional(),
  priority: z.number().int().min(0).max(100).optional(),
  gameId: z.string().cuid().nullable().optional(),
  gameCategoryId: z.string().cuid().nullable().optional(),
  modId: z.string().cuid().nullable().optional(),
  partnerProfileId: z.string().cuid().nullable().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

export async function getAdminSiteBanners() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  return actionTry(
    () =>
      prisma.siteBanner.findMany({
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        include: {
          game: { select: { name: true, slug: true } },
          gameCategory: { select: { name: true, slug: true } },
        },
      }),
    "banners:list"
  );
}

export async function createSiteBanner(input: z.infer<typeof bannerSchema>) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  const parsed = bannerSchema.safeParse(input);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  return actionTry(async () => {
    await prisma.siteBanner.create({
      data: {
        ...parsed.data,
        startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : undefined,
        endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      },
    });
    revalidatePath("/admin/banners");
  }, "banners:create");
}

export async function updateSiteBanner(id: string, input: Partial<z.infer<typeof bannerSchema>>) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  const parsed = bannerSchema.partial().safeParse(input);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  return actionTry(async () => {
    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.startsAt) data.startsAt = new Date(parsed.data.startsAt);
    if (parsed.data.endsAt !== undefined) {
      data.endsAt = parsed.data.endsAt ? new Date(parsed.data.endsAt) : null;
    }
    await prisma.siteBanner.update({ where: { id }, data });
    revalidatePath("/admin/banners");
  }, "banners:update");
}

export async function deleteSiteBanner(id: string) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  return actionTry(async () => {
    await prisma.siteBanner.delete({ where: { id } });
    revalidatePath("/admin/banners");
  }, "banners:delete");
}

export async function toggleSiteBanner(id: string, isActive: boolean) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  return actionTry(async () => {
    await prisma.siteBanner.update({ where: { id }, data: { isActive } });
    revalidatePath("/admin/banners");
  }, "banners:toggle");
}
