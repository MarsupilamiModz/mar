"use server";

import { prisma } from "@/lib/db";
import { fail, ok, requireActionUser } from "@/lib/action-utils";
import { evaluateUserAchievements } from "@/lib/achievements";
import { SHOWCASE_MAX } from "@/lib/achievement-constants";
import { revalidateAchievementShowcase } from "@/lib/showcase-revalidate";

export async function toggleAchievementShowcase(userAchievementId: string, showcased: boolean) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const row = await prisma.userAchievement.findUnique({ where: { id: userAchievementId } });
  if (!row || row.userId !== user.id) return fail("Not found");

  if (showcased) {
    const count = await prisma.userAchievement.count({ where: { userId: user.id, isShowcased: true } });
    if (count >= SHOWCASE_MAX) return fail(`Maximum ${SHOWCASE_MAX} featured achievements`);
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

  await revalidateAchievementShowcase(user.id);
  return ok(undefined);
}

export async function refreshMyAchievements() {
  const { user, error } = await requireActionUser();
  if (error) return error;
  const unlocked = await evaluateUserAchievements(user.id);
  await revalidateAchievementShowcase(user.id);
  return ok({ unlocked });
}

export async function setShowcaseOrder(orderedIds: string[]) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const trimmed = orderedIds.slice(0, SHOWCASE_MAX);
  await prisma.$transaction(
    trimmed.map((id, i) =>
      prisma.userAchievement.updateMany({
        where: { id, userId: user.id, isShowcased: true },
        data: { showcaseOrder: i },
      })
    )
  );
  await revalidateAchievementShowcase(user.id);
  return ok(undefined);
}
