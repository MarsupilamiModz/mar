import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { CACHE_TAGS, REVALIDATE } from "@/lib/cache";

const partnerInclude = {
  user: { select: { username: true, displayName: true, avatarUrl: true } },
  socialLinks: { take: 4, orderBy: { sortOrder: "asc" as const } },
} as const;

const publicPartnerWhere = {
  isPublic: true,
  isBanned: false,
  isSuspended: false,
} as const;

export const getPublicPartners = unstable_cache(
  async (limit = 24) =>
    prisma.partnerProfile.findMany({
      where: publicPartnerWhere,
      orderBy: [{ sortOrder: "asc" }, { totalConversions: "desc" }],
      take: limit,
      include: partnerInclude,
    }),
  ["public-partners"],
  { revalidate: REVALIDATE.catalog, tags: [CACHE_TAGS.partners] }
);

export const getFeaturedPartners = unstable_cache(
  async (limit = 6) =>
    prisma.partnerProfile.findMany({
      where: { ...publicPartnerWhere, isFeatured: true },
      orderBy: { totalConversions: "desc" },
      take: limit,
      include: partnerInclude,
    }),
  ["featured-partners"],
  { revalidate: REVALIDATE.catalog, tags: [CACHE_TAGS.partners] }
);

export const getVerifiedPartners = unstable_cache(
  async (limit = 12) =>
    prisma.partnerProfile.findMany({
      where: { ...publicPartnerWhere, isVerified: true },
      orderBy: { followerCount: "desc" },
      take: limit,
      include: partnerInclude,
    }),
  ["verified-partners"],
  { revalidate: REVALIDATE.catalog, tags: [CACHE_TAGS.partners] }
);

export const getTopPartners = unstable_cache(
  async (limit = 12) =>
    prisma.partnerProfile.findMany({
      where: publicPartnerWhere,
      orderBy: { totalConversions: "desc" },
      take: limit,
      include: partnerInclude,
    }),
  ["top-partners"],
  { revalidate: REVALIDATE.catalog, tags: [CACHE_TAGS.partners] }
);

export async function getPublicPartnerBySlug(slug: string) {
  return prisma.partnerProfile.findFirst({
    where: { slug, isBanned: false, isSuspended: false },
    include: {
      user: { select: { id: true, displayName: true, username: true, avatarUrl: true } },
      socialLinks: { orderBy: { sortOrder: "asc" } },
    },
  });
}
