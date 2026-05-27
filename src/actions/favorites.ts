"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { ok, requireActionUser } from "@/lib/action-utils";

export async function toggleFavorite(modId: string) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const existing = await prisma.modFavorite.findUnique({
    where: { modId_userId: { modId, userId: user.id } },
  });

  if (existing) {
    await prisma.$transaction([
      prisma.modFavorite.delete({ where: { id: existing.id } }),
      prisma.mod.update({
        where: { id: modId },
        data: { favoriteCount: { decrement: 1 } },
      }),
    ]);
    revalidatePath("/dashboard/favorites");
    return ok({ favorited: false });
  }

  await prisma.$transaction([
    prisma.modFavorite.create({ data: { modId, userId: user.id } }),
    prisma.mod.update({
      where: { id: modId },
      data: { favoriteCount: { increment: 1 } },
    }),
  ]);

  revalidatePath("/dashboard/favorites");
  return ok({ favorited: true });
}

export async function getUserFavorites() {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const favorites = await prisma.modFavorite.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      mod: {
        include: {
          game: true,
          media: { orderBy: [{ isFeatured: "desc" }, { orderIndex: "asc" }] },
          screenshots: { take: 1, orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });

  return ok(favorites);
}
