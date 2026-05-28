"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { fail, ok, requireActionUser } from "@/lib/action-utils";
import type { ProfileType } from "@/lib/follows";

async function syncFollowerCount(userId: string, profileType: ProfileType, delta: number) {
  if (profileType === "creator") {
    await prisma.creatorProfile.updateMany({
      where: { userId },
      data: { followerCount: { increment: delta } },
    });
    return;
  }
  await prisma.partnerProfile.updateMany({
    where: { userId },
    data: { followerCount: { increment: delta } },
  });
}

export async function toggleFollow(followingUserId: string, profileType: ProfileType) {
  const { user, error } = await requireActionUser();
  if (error) return error;
  if (user.id === followingUserId) return fail("Cannot follow yourself");

  const existing = await prisma.profileFollow.findUnique({
    where: {
      followerId_followingId_profileType: {
        followerId: user.id,
        followingId: followingUserId,
        profileType,
      },
    },
  });

  if (existing) {
    await prisma.$transaction([
      prisma.profileFollow.delete({ where: { id: existing.id } }),
    ]);
    await syncFollowerCount(followingUserId, profileType, -1);
    revalidatePath("/creators");
    revalidatePath("/partners");
    return ok({ following: false });
  }

  await prisma.profileFollow.create({
    data: {
      followerId: user.id,
      followingId: followingUserId,
      profileType,
    },
  });
  await syncFollowerCount(followingUserId, profileType, 1);

  const creator = await prisma.user.findUnique({
    where: { id: followingUserId },
    select: { displayName: true, username: true },
  });
  if (creator) {
    await prisma.notification.create({
      data: {
        userId: followingUserId,
        title: "New follower",
        body: `${user.displayName ?? user.username} started following you`,
        link: profileType === "creator" ? "/creator" : "/partner",
      },
    });
  }

  revalidatePath("/creators");
  revalidatePath("/partners");
  return ok({ following: true });
}

export async function getFollowState(followingUserId: string, profileType: ProfileType) {
  const { user, error } = await requireActionUser();
  if (error) return ok({ following: false, authenticated: false });

  const existing = await prisma.profileFollow.findUnique({
    where: {
      followerId_followingId_profileType: {
        followerId: user.id,
        followingId: followingUserId,
        profileType,
      },
    },
  });

  return ok({ following: !!existing, authenticated: true });
}
