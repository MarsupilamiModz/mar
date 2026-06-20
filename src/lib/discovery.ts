import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { findModsListing } from "@/lib/data";
import { CACHE_TAGS, REVALIDATE } from "@/lib/cache";
import { enqueueBackgroundJob } from "@/lib/background-jobs";
import type { Prisma } from "@prisma/client";

export type ModSearchFilters = {
  gameSlug?: string;
  categorySlug?: string;
  creatorId?: string;
  tag?: string;
  pricing?: string;
  productType?: string;
  verifiedCreator?: boolean;
  minRating?: number;
  sort?: "downloads" | "trending" | "rating" | "newest" | "updated" | "likes";
  page?: number;
  limit?: number;
};

async function executeSearch(query: string, filters: ModSearchFilters) {
  const page = filters.page ?? 1;
  const limit = Math.min(filters.limit ?? 24, 48);
  const skip = (page - 1) * limit;

  let categoryIds: string[] | undefined;
  if (filters.categorySlug && filters.gameSlug) {
    const cat = await prisma.gameCategory.findFirst({
      where: { slug: filters.categorySlug, game: { slug: filters.gameSlug, isActive: true } },
      select: { id: true },
    });
    if (!cat) return { mods: [], total: 0, pages: 0, page };
    const children = await prisma.gameCategory.findMany({
      where: { OR: [{ id: cat.id }, { parentId: cat.id }] },
      select: { id: true },
    });
    categoryIds = children.map((c) => c.id);
  }

  const where = {
    status: "PUBLISHED" as const,
    visibility: "PUBLIC" as const,
    ...(filters.gameSlug && { game: { slug: filters.gameSlug } }),
    ...(categoryIds && { categoryId: { in: categoryIds } }),
    ...(filters.creatorId && { authorId: filters.creatorId }),
    ...(filters.pricing && { pricing: filters.pricing as "FREE" | "PREMIUM" | "PAID" }),
    ...(filters.productType && filters.productType !== "ALL" && {
      productType: filters.productType as "MOD" | "SOUND",
    }),
    ...(filters.minRating && { averageRating: { gte: filters.minRating } }),
    ...(filters.verifiedCreator && {
      author: { creatorProfile: { isVerified: true } },
    }),
    ...(filters.tag && {
      tags: { some: { name: { equals: filters.tag.trim().toLowerCase(), mode: "insensitive" as const } } },
    }),
    ...(query.trim() && {
      OR: [
        { title: { contains: query.trim(), mode: "insensitive" as const } },
        { description: { contains: query.trim(), mode: "insensitive" as const } },
        { shortDescription: { contains: query.trim(), mode: "insensitive" as const } },
        { tags: { some: { name: { contains: query.trim(), mode: "insensitive" as const } } } },
        { author: { username: { contains: query.trim(), mode: "insensitive" as const } } },
      ],
    }),
  };

  let orderBy: NonNullable<Parameters<typeof findModsListing>[0]>["orderBy"];
  switch (filters.sort) {
    case "rating":
      orderBy = [{ averageRating: "desc" }, { reviewCount: "desc" }];
      break;
    case "newest":
      orderBy = { publishedAt: "desc" };
      break;
    case "updated":
      orderBy = { updatedAt: "desc" };
      break;
    case "likes":
      orderBy = { favoriteCount: "desc" };
      break;
    case "trending":
    case "downloads":
    default:
      orderBy = { downloadCount: "desc" };
      break;
  }

  const [mods, total] = await Promise.all([
    findModsListing({ where, skip, take: limit, orderBy }),
    prisma.mod.count({ where }),
  ]);

  return { mods, total, pages: Math.ceil(total / limit), page };
}

function isCacheableSearch(query: string, filters: ModSearchFilters) {
  return (
    !query.trim() &&
    (filters.page ?? 1) === 1 &&
    !filters.creatorId &&
    !filters.minRating &&
    !filters.verifiedCreator &&
    !filters.categorySlug
  );
}

export async function searchMods(query: string, filters: ModSearchFilters = {}) {
  if (isCacheableSearch(query, filters)) {
    const key = [
      filters.gameSlug ?? "all",
      filters.tag ?? "all",
      filters.pricing ?? "all",
      filters.productType ?? "ALL",
      filters.sort ?? "downloads",
    ].join(":");
    return unstable_cache(
      () => executeSearch(query, filters),
      ["search-mods", key],
      { revalidate: REVALIDATE.search, tags: [CACHE_TAGS.mods, CACHE_TAGS.discovery] }
    )();
  }
  return executeSearch(query, filters);
}

export async function logSearchQuery(params: {
  query: string;
  filters?: Record<string, unknown>;
  userId?: string;
  resultCount: number;
}) {
  enqueueBackgroundJob(async () => {
    await prisma.searchQueryLog.create({
      data: {
        query: params.query.slice(0, 200),
        filters: (params.filters ?? undefined) as Prisma.InputJsonValue | undefined,
        userId: params.userId,
        resultCount: params.resultCount,
      },
    });
  });
}

export function getPopularTags(limit = 30) {
  return unstable_cache(
    async () => {
      const tags = await prisma.modTag.groupBy({
        by: ["name"],
        _count: { name: true },
        orderBy: { _count: { name: "desc" } },
        take: limit,
      });
      return tags.map((t) => ({ name: t.name, count: t._count.name }));
    },
    ["popular-tags", String(limit)],
    { revalidate: REVALIDATE.search, tags: [CACHE_TAGS.discovery] }
  )();
}

export async function trackPlatformEvent(params: {
  type: string;
  userId?: string;
  modId?: string;
  metadata?: Record<string, unknown>;
}) {
  enqueueBackgroundJob(async () => {
    await prisma.platformEvent.create({
      data: {
        type: params.type,
        userId: params.userId,
        modId: params.modId,
        metadata: (params.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  });
}
