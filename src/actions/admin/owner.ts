"use server";

import { prisma } from "@/lib/db";
import { ok, fail, requireActionUser } from "@/lib/action-utils";
import { getVisitorMetrics } from "@/lib/platform-analytics";
import { prismaModelExists } from "@/lib/prisma-schema";
import { listPlatformErrors } from "@/lib/platform-log";

function daysAgo(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function requireOwnerAction() {
  const { user, error } = await requireActionUser();
  if (error) return { user: null as never, error };
  if (user.role !== "OWNER") return { user: null as never, error: fail("Owner access only") };
  return { user, error: null };
}

export async function getOwnerControlCenterData() {
  const { error } = await requireOwnerAction();
  if (error) return error;

  const periods = {
    today: daysAgo(0),
    d3: daysAgo(3),
    d7: daysAgo(7),
    d14: daysAgo(14),
    d30: daysAgo(30),
    d90: daysAgo(90),
  };

  const [
    visitorsToday,
    visitors7d,
    visitors30d,
    visitors90d,
    downloadsToday,
    downloadsWeek,
    downloadsMonth,
    membershipLite,
    membershipPremium,
    membershipMax,
    revenueToday,
    revenueWeek,
    revenueMonth,
    openTickets,
    ticketVolume30d,
    authFailures,
    recentAuthLogs,
    platformErrors,
    campaigns,
    customOrdersPending,
  ] = await Promise.all([
    getVisitorMetrics(periods.today),
    getVisitorMetrics(periods.d7),
    getVisitorMetrics(periods.d30),
    getVisitorMetrics(periods.d90),
    prisma.download.count({ where: { createdAt: { gte: periods.today } } }),
    prisma.download.count({ where: { createdAt: { gte: periods.d7 } } }),
    prisma.download.count({ where: { createdAt: { gte: periods.d30 } } }),
    prisma.userMembership.count({ where: { membershipType: "PREMIUM_LITE", status: "ACTIVE" } }),
    prisma.userMembership.count({ where: { membershipType: "PREMIUM", status: "ACTIVE" } }),
    prisma.userMembership.count({ where: { membershipType: "PREMIUM_MAX", status: "ACTIVE" } }),
    prisma.modPurchase.aggregate({
      _sum: { amountCents: true },
      where: { createdAt: { gte: periods.today } },
    }),
    prisma.modPurchase.aggregate({
      _sum: { amountCents: true },
      where: { createdAt: { gte: periods.d7 } },
    }),
    prisma.modPurchase.aggregate({
      _sum: { amountCents: true },
      where: { createdAt: { gte: periods.d30 } },
    }),
    prisma.supportTicket.count({
      where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_FOR_USER", "ESCALATED"] } },
    }),
    prisma.supportTicket.count({ where: { createdAt: { gte: periods.d30 } } }),
    prisma.auditLog.count({
      where: {
        entityType: "Auth",
        action: { contains: "failed" },
        createdAt: { gte: periods.d7 },
      },
    }),
    prisma.auditLog.findMany({
      where: { entityType: "Auth" },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: { id: true, action: true, metadata: true, createdAt: true },
    }),
    listPlatformErrors(20),
    prismaModelExists("MembershipCampaign")
      ? prisma.membershipCampaign.findMany({
          orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
          include: { plan: { select: { name: true, slug: true } } },
        })
      : Promise.resolve([]),
    prisma.customOrder.count({
      where: { status: { in: ["PENDING", "IN_PROGRESS"] } },
    }).catch(() => 0),
  ]);

  const revenueChart = await prisma.modPurchase.groupBy({
    by: ["createdAt"],
    where: { createdAt: { gte: periods.d30 } },
    _sum: { amountCents: true },
  }).catch(() => []);

  const dailyRevenueMap = new Map<string, number>();
  for (const row of revenueChart) {
    const key = row.createdAt.toISOString().slice(0, 10);
    dailyRevenueMap.set(key, (dailyRevenueMap.get(key) ?? 0) + (row._sum.amountCents ?? 0));
  }

  const revenueSeries = Array.from(dailyRevenueMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, revenue]) => ({ date, revenue: revenue / 100 }));

  return ok({
    visitors: {
      today: visitorsToday.pageViews,
      uniqueToday: visitorsToday.uniqueVisitors,
      last3Days: (await getVisitorMetrics(periods.d3)).pageViews,
      last7Days: visitors7d.pageViews,
      last14Days: (await getVisitorMetrics(periods.d14)).pageViews,
      last30Days: visitors30d.pageViews,
      last90Days: visitors90d.pageViews,
      daily: visitors30d.daily,
    },
    downloads: { today: downloadsToday, week: downloadsWeek, month: downloadsMonth },
    memberships: {
      premiumLite: membershipLite,
      premium: membershipPremium,
      premiumMax: membershipMax,
    },
    revenue: {
      daily: (revenueToday._sum.amountCents ?? 0) / 100,
      weekly: (revenueWeek._sum.amountCents ?? 0) / 100,
      monthly: (revenueMonth._sum.amountCents ?? 0) / 100,
      series: revenueSeries,
    },
    tickets: { open: openTickets, volume30d: ticketVolume30d },
    customOrdersPending,
    auth: { failures7d: authFailures, recent: recentAuthLogs },
    platformErrors,
    campaigns: campaigns.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      description: c.description,
      badgeLabel: c.badgeLabel,
      priceCents: c.priceCents,
      currency: c.currency,
      totalSlots: c.totalSlots,
      soldSlots: c.soldSlots,
      remaining: Math.max(0, c.totalSlots - c.soldSlots),
      isVisible: c.isVisible,
      isActive: c.isActive,
      bannerText: c.bannerText,
      planName: c.plan?.name ?? null,
    })),
  });
}

export async function upsertMembershipCampaign(input: {
  id?: string;
  slug: string;
  title: string;
  description?: string;
  badgeLabel?: string;
  priceCents: number;
  totalSlots: number;
  planId?: string;
  isVisible?: boolean;
  isActive?: boolean;
  bannerText?: string;
}) {
  const { error } = await requireOwnerAction();
  if (error) return error;
  if (!prismaModelExists("MembershipCampaign")) {
    return fail("Run database migration: owner_platform");
  }

  const data = {
    slug: input.slug,
    title: input.title,
    description: input.description ?? null,
    badgeLabel: input.badgeLabel ?? null,
    priceCents: input.priceCents,
    totalSlots: input.totalSlots,
    planId: input.planId ?? null,
    isVisible: input.isVisible ?? true,
    isActive: input.isActive ?? true,
    bannerText: input.bannerText ?? null,
  };

  if (input.id) {
    await prisma.membershipCampaign.update({ where: { id: input.id }, data });
  } else {
    await prisma.membershipCampaign.create({ data });
  }

  return ok(undefined);
}
