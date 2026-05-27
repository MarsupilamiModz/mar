"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { fail, ok, requireActionUser } from "@/lib/action-utils";
import { evaluateUserAchievements } from "@/lib/achievements";

export async function toggleAchievementShowcase(userAchievementId: string, showcased: boolean) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const row = await prisma.userAchievement.findUnique({ where: { id: userAchievementId } });
  if (!row || row.userId !== user.id) return fail("Not found");

  if (showcased) {
    const count = await prisma.userAchievement.count({ where: { userId: user.id, isShowcased: true } });
    if (count >= 6) return fail("Maximum 6 showcased achievements");
  }

  const showcaseCount = showcased
    ? await prisma.userAchievement.count({ where: { userId: user.id, isShowcased: true } })
    : 0;

  await prisma.userAchievement.update({
    where: { id: userAchievementId },
    data: {
      isShowcased: showcased,
      showcaseOrder: showcased ? showcaseCount : null,
    },
  });

  revalidatePath("/dashboard/settings");
  return ok(undefined);
}

export async function refreshMyAchievements() {
  const { user, error } = await requireActionUser();
  if (error) return error;
  const unlocked = await evaluateUserAchievements(user.id);
  revalidatePath("/dashboard/settings");
  return ok({ unlocked });
}

export async function setShowcaseOrder(orderedIds: string[]) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  await prisma.$transaction(
    orderedIds.map((id, i) =>
      prisma.userAchievement.updateMany({
        where: { id, userId: user.id },
        data: { showcaseOrder: i, isShowcased: true },
      })
    )
  );
  revalidatePath("/dashboard/settings");
  return ok(undefined);
}
