"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/db";
import { fail, ok, requireActionUser } from "@/lib/action-utils";
import { reviewSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import { CACHE_TAGS } from "@/lib/cache";
import { locales } from "@/i18n/config";

export async function submitReview(
  modId: string,
  input: { rating: number; title?: string; content?: string }
) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  if ((user as { isSuspended?: boolean }).isSuspended) {
    return fail("Your account is suspended and cannot submit reviews.");
  }

  const limit = rateLimit(`review:${user.id}`, 10, 3600_000);
  if (!limit.success) return fail("Rate limited");

  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.message);

  const mod = await prisma.mod.findUnique({ where: { id: modId } });
  if (!mod || mod.status !== "PUBLISHED") return fail("Mod not found");

  await prisma.modReview.upsert({
    where: { modId_userId: { modId, userId: user.id } },
    create: {
      modId,
      userId: user.id,
      rating: parsed.data.rating,
      title: parsed.data.title,
      content: parsed.data.content,
    },
    update: {
      rating: parsed.data.rating,
      title: parsed.data.title,
      content: parsed.data.content,
    },
  });

  const agg = await prisma.modReview.aggregate({
    where: { modId },
    _avg: { rating: true },
    _count: true,
  });

  await prisma.mod.update({
    where: { id: modId },
    data: {
      averageRating: agg._count > 0 ? (agg._avg.rating ?? 0) : 0,
      reviewCount: agg._count,
    },
  });

  revalidateTag(CACHE_TAGS.mods);
  for (const loc of locales) {
    revalidatePath(`/${loc}/mods/${mod.slug}`);
  }
  revalidatePath(`/mods/${mod.slug}`);
  return ok(undefined);
}
