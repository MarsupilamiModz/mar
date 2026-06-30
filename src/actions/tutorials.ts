"use server";

import { prisma } from "@/lib/db";
import { ok, fail, requireActionUser } from "@/lib/action-utils";
import { revalidatePath } from "next/cache";

export async function toggleTutorialLike(tutorialId: string) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const existing = await prisma.tutorialLike.findUnique({
    where: { tutorialId_userId: { tutorialId, userId: user.id } },
  });

  if (existing) {
    await prisma.$transaction([
      prisma.tutorialLike.delete({ where: { id: existing.id } }),
      prisma.tutorial.update({
        where: { id: tutorialId },
        data: { likeCount: { decrement: 1 } },
      }),
    ]);
    revalidatePath("/tutorials");
    return ok({ liked: false });
  }

  await prisma.$transaction([
    prisma.tutorialLike.create({ data: { tutorialId, userId: user.id } }),
    prisma.tutorial.update({
      where: { id: tutorialId },
      data: { likeCount: { increment: 1 } },
    }),
  ]);
  revalidatePath("/tutorials");
  return ok({ liked: true });
}

export async function postTutorialComment(tutorialId: string, content: string) {
  const { user, error } = await requireActionUser();
  if (error) return error;
  const text = content.trim();
  if (text.length < 2) return fail("Comment too short");

  await prisma.$transaction([
    prisma.tutorialComment.create({
      data: { tutorialId, userId: user.id, content: text },
    }),
    prisma.tutorial.update({
      where: { id: tutorialId },
      data: { commentCount: { increment: 1 } },
    }),
  ]);

  revalidatePath("/tutorials");
  return ok(true);
}

export async function recordTutorialWatch(tutorialId: string, watchSec: number) {
  const auth = await requireActionUser();
  const tutorial = await prisma.tutorial.findUnique({ where: { id: tutorialId } });
  if (!tutorial) return fail("Not found");

  const nextAvg =
    tutorial.viewCount > 0
      ? (tutorial.avgWatchSec * tutorial.viewCount + watchSec) / (tutorial.viewCount + 1)
      : watchSec;

  await prisma.tutorialView.create({
    data: { tutorialId, userId: auth.user?.id, watchSec },
  });
  await prisma.tutorial.update({
    where: { id: tutorialId },
    data: { avgWatchSec: nextAvg },
  });

  return ok(true);
}
