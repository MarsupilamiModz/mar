"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { fail, ok, requireActionPermission } from "@/lib/action-utils";
import { getLeaderboardWeights, saveLeaderboardWeights, syncCreatorRanks, type LeaderboardWeights } from "@/lib/leaderboards";

export async function getAdminLeaderboardConfig() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  const weights = await getLeaderboardWeights();
  const pinned = await prisma.creatorProfile.findMany({
    where: { leaderboardPinned: true },
    include: { user: { select: { username: true, displayName: true } } },
    orderBy: { sortOrder: "asc" },
  });
  return ok({ weights, pinned });
}

export async function saveAdminLeaderboardWeights(weights: LeaderboardWeights) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  await saveLeaderboardWeights(weights);
  revalidatePath("/admin/leaderboards");
  revalidatePath("/leaderboards");
  return ok(undefined);
}

export async function pinCreatorOnLeaderboard(creatorProfileId: string, pinned: boolean, days = 7) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  await prisma.creatorProfile.update({
    where: { id: creatorProfileId },
    data: {
      leaderboardPinned: pinned,
      pinnedUntil: pinned ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null,
    },
  });
  revalidatePath("/leaderboards");
  return ok(undefined);
}

export async function resetCreatorRankings() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  await syncCreatorRanks();
  revalidatePath("/leaderboards");
  return ok(undefined);
}

export async function featureCreatorOnLeaderboard(creatorProfileId: string, featured: boolean) {
  const { error } = await requireActionPermission("users.write");
  if (error) return error;
  await prisma.creatorProfile.update({
    where: { id: creatorProfileId },
    data: { isFeatured: featured },
  });
  revalidatePath("/leaderboards");
  return ok(undefined);
}

export async function searchCreatorsForLeaderboard(query: string) {
  const { error } = await requireActionPermission("users.read");
  if (error) return error;

  const creators = await prisma.creatorProfile.findMany({
    where: {
      OR: [
        { slug: { contains: query, mode: "insensitive" } },
        { user: { username: { contains: query, mode: "insensitive" } } },
      ],
    },
    take: 20,
    include: { user: { select: { username: true, displayName: true } } },
  });
  return ok(creators);
}
