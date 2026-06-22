import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { CACHE_TAGS, REVALIDATE } from "@/lib/cache";
import type { PublisherLevel } from "@prisma/client";

const creatorInclude = {
  user: { select: { username: true, displayName: true, avatarUrl: true } },
  socialLinks: { take: 3, orderBy: { sortOrder: "asc" as const } },
} as const;

export type CreatorCardData = Awaited<ReturnType<typeof getPublicCreators>>[number];

export const getPublicCreators = unstable_cache(
  async (limit = 24) =>
    prisma.creatorProfile.findMany({
      where: { isPublic: true, isSuspended: false, isVerified: true },
      orderBy: [{ sortOrder: "asc" }, { totalDownloads: "desc" }],
      take: limit,
      include: creatorInclude,
    }),
  ["public-creators"],
  { revalidate: REVALIDATE.catalog, tags: [CACHE_TAGS.creators] }
);

export const getFeaturedCreatorsDiscovery = unstable_cache(
  async (limit = 8) =>
    prisma.creatorProfile.findMany({
      where: { isPublic: true, isFeatured: true, isSuspended: false },
      orderBy: [{ sortOrder: "asc" }, { totalRevenueCents: "desc" }],
      take: limit,
      include: creatorInclude,
    }),
  ["featured-creators-discovery"],
  { revalidate: REVALIDATE.homepage, tags: [CACHE_TAGS.creators, CACHE_TAGS.featured] }
);

export const getTrendingCreators = unstable_cache(
  async (limit = 8) =>
    prisma.creatorProfile.findMany({
      where: { isPublic: true, isTrending: true, isSuspended: false },
      orderBy: [{ totalConversions: "desc" }, { totalDownloads: "desc" }],
      take: limit,
      include: creatorInclude,
    }),
  ["trending-creators"],
  { revalidate: REVALIDATE.homepage, tags: [CACHE_TAGS.creators] }
);

export const getTopRevenueCreators = unstable_cache(
  async (limit = 8) =>
    prisma.creatorProfile.findMany({
      where: { isPublic: true, isSuspended: false },
      orderBy: { totalRevenueCents: "desc" },
      take: limit,
      include: creatorInclude,
    }),
  ["top-revenue-creators"],
  { revalidate: REVALIDATE.catalog, tags: [CACHE_TAGS.creators] }
);

export const getMostDownloadedCreators = unstable_cache(
  async (limit = 8) =>
    prisma.creatorProfile.findMany({
      where: { isPublic: true, isSuspended: false },
      orderBy: { totalDownloads: "desc" },
      take: limit,
      include: creatorInclude,
    }),
  ["most-downloaded-creators"],
  { revalidate: REVALIDATE.catalog, tags: [CACHE_TAGS.creators] }
);

export const getHomepageCreators = unstable_cache(
  async (limit = 6) =>
    prisma.creatorProfile.findMany({
      where: { isPublic: true, isHomepage: true, isSuspended: false },
      orderBy: [{ sortOrder: "asc" }],
      take: limit,
      include: creatorInclude,
    }),
  ["homepage-creators"],
  { revalidate: REVALIDATE.homepage, tags: [CACHE_TAGS.creators, CACHE_TAGS.featured] }
);

export async function getCreatorBySlug(slug: string) {
  return unstable_cache(
    async () =>
      prisma.creatorProfile.findFirst({
        where: { slug, isPublic: true, isSuspended: false },
        include: {
          user: { select: { id: true, username: true, displayName: true, avatarUrl: true, bio: true } },
          socialLinks: { orderBy: { sortOrder: "asc" } },
        },
      }),
    ["creator-profile", slug],
    { revalidate: REVALIDATE.catalog, tags: [CACHE_TAGS.creators, `creator-${slug}`] }
  )();
}

export function creatorReferralLink(locale: string, code: string) {
  return `/${locale}?ref=${code}`;
}

export function affiliateReferralLink(code: string, redirect = "/") {
  return `/api/ref/${code}?redirect=${encodeURIComponent(redirect)}`;
}

export async function syncCreatorStats(userId: string) {
  const [downloads, purchases, coupons, events] = await Promise.all([
    prisma.download.count({ where: { mod: { authorId: userId } } }),
    prisma.modPurchase.aggregate({
      where: { mod: { authorId: userId } },
      _sum: { amountCents: true },
      _count: true,
    }),
    prisma.coupon.aggregate({
      where: { ownerUserId: userId },
      _sum: { usedCount: true, discountCents: true, revenueCents: true, clickCount: true, conversionCount: true },
    }),
    prisma.affiliateEvent.groupBy({
      by: ["eventType"],
      where: { ownerUserId: userId },
      _count: true,
    }),
  ]);

  const clicks = events.find((e) => e.eventType === "CLICK")?._count ?? 0;
  const conversions =
    (events.find((e) => e.eventType === "CONVERSION")?._count ?? 0) +
    (events.find((e) => e.eventType === "SUBSCRIPTION")?._count ?? 0);

  await prisma.creatorProfile.updateMany({
    where: { userId },
    data: {
      totalDownloads: downloads,
      totalRevenueCents: purchases._sum.amountCents ?? 0,
      totalSales: purchases._count,
      totalCouponUses: coupons._sum.usedCount ?? 0,
      totalDiscountCents: coupons._sum.discountCents ?? 0,
      totalClicks: coupons._sum.clickCount ?? clicks,
      totalConversions: coupons._sum.conversionCount ?? conversions,
    },
  });
}

export async function applyLevelRevenueShare(profileId: string, level: PublisherLevel) {
  const { CREATOR_LEVELS } = await import("@/lib/creator-levels");
  const bps = CREATOR_LEVELS[level]?.revenueShareBps ?? 0;
  await prisma.creatorProfile.update({
    where: { id: profileId },
    data: { level, commissionRateBps: bps, isVerified: level !== "UNVERIFIED" },
  });
}
