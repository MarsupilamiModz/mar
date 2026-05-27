"use server";

import { prisma } from "@/lib/db";
import { fail, ok, requireActionUser } from "@/lib/action-utils";

const INTERNAL_PATHS = [
  "/mods",
  "/games",
  "/creators",
  "/partners",
  "/premium",
  "/dashboard",
  "/creator",
  "/partner",
];

export async function submitSnakeScore(score: number, locale = "en", username?: string) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  if (score < 0 || score > 99999) return fail("Invalid score");

  await prisma.snakeScore.create({
    data: {
      userId: user.id,
      username: username ?? user.displayName ?? user.username,
      score,
    },
  });

  const redirectPath = INTERNAL_PATHS[Math.floor(Math.random() * INTERNAL_PATHS.length)];
  return ok({ redirectPath: `/${locale}${redirectPath}` });
}

export async function getSnakeLeaderboard(limit = 10) {
  return prisma.snakeScore.findMany({
    orderBy: { score: "desc" },
    take: limit,
    select: { username: true, score: true, createdAt: true },
  });
}
