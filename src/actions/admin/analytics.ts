"use server";

import { prisma } from "@/lib/db";
import { requireActionPermission, ok } from "@/lib/action-utils";

export async function getAdminAnalytics() {
  const { error } = await requireActionPermission("analytics.read");
  if (error) return error;

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    premiumUsers,
    activeSubscriptions,
    bannedUsers,
    openTickets,
    revenue,
    recentTickets,
    recentMods,
    recentPurchases,
    latestUsers,
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({
      where: {
        deletedAt: null,
        OR: [
          { role: "PREMIUM" },
          { subscriptions: { some: { status: "ACTIVE" } } },
        ],
      },
    }),
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { isBanned: true, deletedAt: null } }),
    prisma.supportTicket.count({
      where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_FOR_USER"] } },
    }),
    prisma.modPurchase.aggregate({
      _sum: { amountCents: true },
      where: { createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.supportTicket.findMany({
      take: 5,
      orderBy: { updatedAt: "desc" },
      include: { user: { select: { username: true } } },
    }),
    prisma.mod.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { author: { select: { username: true } }, game: { select: { name: true } } },
    }),
    prisma.modPurchase.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { username: true } }, mod: { select: { title: true } } },
    }),
    prisma.user.findMany({
      where: { deletedAt: null },
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { id: true, username: true, email: true, role: true, createdAt: true },
    }),
  ]);

  return ok({
    totalUsers,
    premiumUsers,
    activeSubscriptions,
    bannedUsers,
    openTickets,
    revenue30d: (revenue._sum.amountCents ?? 0) / 100,
    recentTickets,
    recentMods,
    recentPurchases,
    latestUsers,
  });
}
