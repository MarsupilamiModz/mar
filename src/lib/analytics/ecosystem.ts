import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import type { CommissionSource, UserRole } from "@prisma/client";

export async function getActiveCommissionRule(source: CommissionSource, role?: UserRole) {
  return prisma.commissionRule.findFirst({
    where: {
      source,
      isActive: true,
      ...(role && { OR: [{ targetRole: role }, { targetRole: null }] }),
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function recordCommission(input: {
  userId: string;
  source: CommissionSource;
  sourceId?: string;
  grossCents: number;
  role?: UserRole;
  description?: string;
}) {
  const rule = await getActiveCommissionRule(input.source, input.role);
  let amountCents = 0;

  if (rule) {
    amountCents =
      rule.type === "FIXED"
        ? rule.value
        : Math.round((input.grossCents * rule.value) / 10000);
  }

  if (amountCents <= 0) return null;

  return prisma.commissionEntry.create({
    data: {
      userId: input.userId,
      ruleId: rule?.id,
      source: input.source,
      sourceId: input.sourceId,
      amountCents,
      description: input.description,
    },
  });
}

export async function getUserCommissionSummary(userId: string) {
  const [pending, paid, payouts] = await Promise.all([
    prisma.commissionEntry.aggregate({
      where: { userId, status: "PENDING" },
      _sum: { amountCents: true },
      _count: true,
    }),
    prisma.commissionEntry.aggregate({
      where: { userId, status: "PAID" },
      _sum: { amountCents: true },
      _count: true,
    }),
    prisma.payout.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return {
    pendingCents: pending._sum.amountCents ?? 0,
    pendingCount: pending._count,
    paidCents: paid._sum.amountCents ?? 0,
    paidCount: paid._count,
    payouts,
  };
}

export function getCreatorAnalytics(userId: string) {
  return unstable_cache(
    async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [mods, downloads, purchases, coupons, events, commissions] = await Promise.all([
      prisma.mod.findMany({
        where: { authorId: userId },
        select: {
          id: true,
          title: true,
          slug: true,
          downloadCount: true,
          pricing: true,
          status: true,
        },
        orderBy: { downloadCount: "desc" },
        take: 10,
      }),
      prisma.download.count({
        where: { mod: { authorId: userId }, createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.modPurchase.aggregate({
        where: { mod: { authorId: userId } },
        _sum: { amountCents: true },
        _count: true,
      }),
      prisma.coupon.findMany({
        where: { ownerUserId: userId },
        select: {
          id: true,
          code: true,
          usedCount: true,
          clickCount: true,
          conversionCount: true,
          revenueCents: true,
          discountCents: true,
          isActive: true,
        },
      }),
      prisma.affiliateEvent.groupBy({
        by: ["eventType"],
        where: { ownerUserId: userId, createdAt: { gte: thirtyDaysAgo } },
        _count: true,
      }),
      prisma.commissionEntry.aggregate({
        where: { userId, createdAt: { gte: thirtyDaysAgo } },
        _sum: { amountCents: true },
      }),
    ]);

    const totalDownloads = mods.reduce((s, m) => s + m.downloadCount, 0);
    const couponUses = coupons.reduce((s, c) => s + c.usedCount, 0);
    const couponRevenue = coupons.reduce((s, c) => s + c.revenueCents, 0);

    return {
      mods,
      totalDownloads,
      monthlyDownloads: downloads,
      purchaseRevenue: purchases._sum.amountCents ?? 0,
      purchaseCount: purchases._count,
      coupons,
      couponUses,
      couponRevenue,
      events: events.map((e) => ({ type: e.eventType, count: e._count })),
      monthlyCommission: commissions._sum.amountCents ?? 0,
    };
    },
    [`creator-analytics-${userId}`],
    { revalidate: 60 }
  )();
}

export function getPartnerAnalytics(userId: string) {
  return unstable_cache(
    async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [coupons, events, commissions, referrals] = await Promise.all([
      prisma.coupon.findMany({
        where: { ownerUserId: userId },
        orderBy: { usedCount: "desc" },
      }),
      prisma.affiliateEvent.findMany({
        where: { ownerUserId: userId, createdAt: { gte: thirtyDaysAgo } },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.commissionEntry.aggregate({
        where: { userId },
        _sum: { amountCents: true },
      }),
      prisma.affiliateEvent.count({
        where: { ownerUserId: userId, eventType: "SIGNUP" },
      }),
    ]);

    const clicks = events.filter((e) => e.eventType === "CLICK").length;
    const conversions = events.filter((e) => e.eventType === "CONVERSION").length;
    const totalRevenue = coupons.reduce((s, c) => s + c.revenueCents, 0);
    const totalDiscount = coupons.reduce((s, c) => s + c.discountCents, 0);

    return {
      coupons,
      clicks,
      conversions,
      conversionRate: clicks > 0 ? (conversions / clicks) * 100 : 0,
      totalRevenue,
      totalDiscount,
      totalUses: coupons.reduce((s, c) => s + c.usedCount, 0),
      totalCommission: commissions._sum.amountCents ?? 0,
      referrals,
      recentEvents: events.slice(0, 20),
    };
    },
    [`partner-analytics-${userId}`],
    { revalidate: 60 }
  )();
}

export async function getDailyChartData(userId: string, days = 14) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const events = await prisma.affiliateEvent.findMany({
    where: { ownerUserId: userId, createdAt: { gte: since } },
    select: { createdAt: true, eventType: true, amountCents: true },
    orderBy: { createdAt: "asc" },
  });

  const buckets = new Map<string, { clicks: number; conversions: number; revenue: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000);
    buckets.set(d.toISOString().slice(0, 10), { clicks: 0, conversions: 0, revenue: 0 });
  }

  for (const e of events) {
    const key = e.createdAt.toISOString().slice(0, 10);
    const b = buckets.get(key);
    if (!b) continue;
    if (e.eventType === "CLICK") b.clicks++;
    if (e.eventType === "CONVERSION" || e.eventType === "SUBSCRIPTION") {
      b.conversions++;
      b.revenue += e.amountCents;
    }
  }

  return Array.from(buckets.entries()).map(([date, data]) => ({ date, ...data }));
}
