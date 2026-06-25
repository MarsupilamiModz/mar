import "server-only";
import { prisma } from "@/lib/db";

export type CreatorAdminAnalytics = {
  overview: {
    totalUploads: number;
    totalDownloads: number;
    totalLikes: number;
    totalReviews: number;
    totalComments: number;
    followers: number;
    totalRevenueCents: number;
    premiumSales: number;
    shopSales: number;
  };
  revenue: {
    today: number;
    week: number;
    month: number;
    quarter: number;
    total: number;
  };
  topMods: {
    id: string;
    title: string;
    slug: string;
    downloadCount: number;
    viewCount: number;
    revenueCents: number;
    reviewCount: number;
    averageRating: number | null;
  }[];
};

function periodStart(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getCreatorAdminAnalytics(
  userId: string,
  _creatorProfileId: string | null,
  followerCount = 0
): Promise<CreatorAdminAnalytics> {
  const todayStart = periodStart(0);
  const weekStart = periodStart(7);
  const monthStart = periodStart(30);
  const quarterStart = periodStart(90);

  const shopWhere = { product: { mod: { authorId: userId } } };

  const [
    modAgg,
    topModsRaw,
    modPurchases,
    shopPurchases,
    premiumPurchases,
    commentCount,
  ] = await Promise.all([
    prisma.mod.aggregate({
      where: { authorId: userId, status: { not: "DRAFT" } },
      _count: { id: true },
      _sum: { downloadCount: true, favoriteCount: true, reviewCount: true },
    }),
    prisma.mod.findMany({
      where: { authorId: userId, status: "PUBLISHED" },
      orderBy: { downloadCount: "desc" },
      take: 10,
      select: {
        id: true,
        title: true,
        slug: true,
        downloadCount: true,
        reviewCount: true,
        averageRating: true,
      },
    }),
    prisma.modPurchase.findMany({
      where: { mod: { authorId: userId } },
      select: { amountCents: true, createdAt: true },
    }),
    prisma.shopPurchase.findMany({
      where: shopWhere,
      select: { priceCents: true, createdAt: true },
    }),
    prisma.membershipPurchase.count({ where: { userId } }),
    prisma.modReview.count({ where: { mod: { authorId: userId } } }),
  ]);

  const allRevenue = [
    ...modPurchases.map((p) => ({ cents: p.amountCents, at: p.createdAt })),
    ...shopPurchases.map((p) => ({ cents: p.priceCents, at: p.createdAt })),
  ];

  const sumSince = (since: Date) =>
    allRevenue.filter((r) => r.at >= since).reduce((acc, r) => acc + r.cents, 0);

  const topMods = await Promise.all(
    topModsRaw.map(async (mod) => {
      const revenue = await prisma.modPurchase.aggregate({
        where: { modId: mod.id },
        _sum: { amountCents: true },
      });
      return {
        ...mod,
        viewCount: mod.downloadCount,
        revenueCents: revenue._sum.amountCents ?? 0,
        averageRating: mod.averageRating,
      };
    })
  );

  const totalRevenueCents = allRevenue.reduce((acc, r) => acc + r.cents, 0);

  return {
    overview: {
      totalUploads: modAgg._count.id,
      totalDownloads: modAgg._sum.downloadCount ?? 0,
      totalLikes: modAgg._sum.favoriteCount ?? 0,
      totalReviews: modAgg._sum.reviewCount ?? 0,
      totalComments: commentCount,
      followers: followerCount,
      totalRevenueCents,
      premiumSales: premiumPurchases,
      shopSales: shopPurchases.length,
    },
    revenue: {
      today: sumSince(todayStart),
      week: sumSince(weekStart),
      month: sumSince(monthStart),
      quarter: sumSince(quarterStart),
      total: totalRevenueCents,
    },
    topMods,
  };
}
