import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { CACHE_TAGS, REVALIDATE } from "@/lib/cache";
import { collectDescendantIds, type FlatCategory } from "@/lib/categories";

import { ensureModMediaSynced } from "@/lib/mod-media";

const modListInclude = {
  id: true,
  slug: true,
  title: true,
  shortDescription: true,
  pricing: true,
  downloadCount: true,
  averageRating: true,
  favoriteCount: true,
  game: { select: { name: true, slug: true } },
  media: { orderBy: [{ isFeatured: "desc" as const }, { orderIndex: "asc" as const }] },
  screenshots: { take: 1, orderBy: { sortOrder: "asc" as const } },
  author: { select: { username: true, displayName: true, avatarUrl: true } },
};

export const getFeaturedGames = unstable_cache(
  async () =>
    prisma.game.findMany({
      where: { isActive: true, isFeatured: true },
      orderBy: { sortOrder: "asc" },
      take: 6,
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        iconUrl: true,
        bannerUrl: true,
        coverUrl: true,
        _count: { select: { mods: { where: { status: "PUBLISHED" } } } },
      },
    }),
  ["featured-games"],
  { revalidate: REVALIDATE.homepage, tags: [CACHE_TAGS.games, CACHE_TAGS.featured] }
);

export const getAllGames = unstable_cache(
  async () =>
    prisma.game.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        iconUrl: true,
        bannerUrl: true,
        coverUrl: true,
        _count: { select: { mods: { where: { status: "PUBLISHED" } } } },
      },
    }),
  ["all-games"],
  { revalidate: REVALIDATE.catalog, tags: [CACHE_TAGS.games] }
);

export async function getTrendingMods(limit = 8, gameId?: string) {
  return unstable_cache(
    async () =>
      prisma.mod.findMany({
        where: {
          status: "PUBLISHED",
          visibility: "PUBLIC",
          ...(gameId && { gameId }),
        },
        orderBy: { downloadCount: "desc" },
        take: limit,
        include: modListInclude,
      }),
    [`trending-mods-${limit}-${gameId ?? "all"}`],
    { revalidate: REVALIDATE.homepage, tags: [CACHE_TAGS.mods] }
  )();
}

export async function getPremiumMods(limit = 8, gameId?: string) {
  return unstable_cache(
    async () =>
      prisma.mod.findMany({
        where: {
          status: "PUBLISHED",
          visibility: "PUBLIC",
          pricing: { in: ["PREMIUM", "PAID"] },
          ...(gameId && { gameId }),
        },
        orderBy: { downloadCount: "desc" },
        take: limit,
        include: modListInclude,
      }),
    [`premium-mods-${limit}-${gameId ?? "all"}`],
    { revalidate: REVALIDATE.catalog, tags: [CACHE_TAGS.mods] }
  )();
}

export async function getFeaturedMods(limit = 8, gameId?: string) {
  return unstable_cache(
    async () =>
      prisma.mod.findMany({
        where: {
          status: "PUBLISHED",
          visibility: "PUBLIC",
          isFeatured: true,
          ...(gameId && { gameId }),
        },
        orderBy: { downloadCount: "desc" },
        take: limit,
        include: modListInclude,
      }),
    [`featured-mods-${limit}-${gameId ?? "all"}`],
    { revalidate: REVALIDATE.catalog, tags: [CACHE_TAGS.mods, CACHE_TAGS.featured] }
  )();
}

export async function getFeaturedCreators(limit = 6) {
  const { getFeaturedCreatorsDiscovery } = await import("@/lib/creators");
  return getFeaturedCreatorsDiscovery(limit);
}

export async function getMods(filters: {
  gameSlug?: string;
  pricing?: string;
  search?: string;
  categorySlug?: string;
  page?: number;
  limit?: number;
}) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 24;
  const skip = (page - 1) * limit;

  const categoryFilter = filters.categorySlug && filters.gameSlug
    ? await resolveCategoryFilter(filters.gameSlug, filters.categorySlug)
    : undefined;

  const where = {
    status: "PUBLISHED" as const,
    visibility: "PUBLIC" as const,
    ...(filters.pricing && { pricing: filters.pricing as "FREE" | "PREMIUM" | "PAID" }),
    ...(filters.search && {
      OR: [
        { title: { contains: filters.search, mode: "insensitive" as const } },
        { description: { contains: filters.search, mode: "insensitive" as const } },
      ],
    }),
    ...(filters.gameSlug && { game: { slug: filters.gameSlug } }),
    ...(categoryFilter && { categoryId: { in: categoryFilter } }),
  };

  const [mods, total] = await Promise.all([
    prisma.mod.findMany({
      where,
      skip,
      take: limit,
      orderBy: { downloadCount: "desc" },
      include: {
        game: { select: { name: true, slug: true } },
        media: { orderBy: [{ isFeatured: "desc" }, { orderIndex: "asc" }] },
        screenshots: { take: 1, orderBy: { sortOrder: "asc" } },
        tags: { take: 3 },
      },
    }),
    prisma.mod.count({ where }),
  ]);

  return { mods, total, pages: Math.ceil(total / limit) };
}

export async function getModBySlug(slug: string) {
  const found = await prisma.mod.findUnique({ where: { slug }, select: { id: true } });
  if (found) await ensureModMediaSynced(found.id);

  return prisma.mod.findUnique({
    where: { slug },
    include: {
      game: true,
      category: true,
      author: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          creatorProfile: true,
          designerProfile: true,
        },
      },
      media: { orderBy: [{ isFeatured: "desc" }, { orderIndex: "asc" }] },
      screenshots: { orderBy: { sortOrder: "asc" } },
      videos: { orderBy: { sortOrder: "asc" } },
      tags: true,
      versions: { orderBy: { createdAt: "desc" } },
      changelog: { orderBy: { createdAt: "desc" }, take: 10 },
      reviews: {
        take: 20,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
      },
      dependencies: { include: { dependency: { select: { slug: true, title: true } } } },
    },
  });
}

export async function getGameBySlug(slug: string) {
  return unstable_cache(
    async () =>
      prisma.game.findUnique({
        where: { slug, isActive: true },
        include: {
          categories: {
            where: { isVisible: true },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          },
          _count: { select: { mods: { where: { status: "PUBLISHED" } } } },
        },
      }),
    [`game-${slug}`],
    { revalidate: REVALIDATE.catalog, tags: [CACHE_TAGS.games, `game-${slug}`] }
  )();
}

async function resolveCategoryFilter(gameSlug: string, categorySlug: string): Promise<string[] | undefined> {
  const category = await prisma.gameCategory.findFirst({
    where: { slug: categorySlug, game: { slug: gameSlug, isActive: true } },
    select: { id: true, gameId: true },
  });
  if (!category) return undefined;

  const flat = await prisma.gameCategory.findMany({
    where: { gameId: category.gameId },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      sortOrder: true,
      isVisible: true,
      parentId: true,
    },
  });

  return collectDescendantIds(flat as FlatCategory[], category.id);
}

export async function getGamePageData(slug: string) {
  const game = await getGameBySlug(slug);
  if (!game) return null;

  const [featured, trending, premium] = await Promise.all([
    getFeaturedMods(8, game.id),
    getTrendingMods(12, game.id),
    getPremiumMods(8, game.id),
  ]);

  return { game, featured, trending, premium };
}

export async function getGamesAndCategories() {
  return prisma.game.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      categories: {
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          gameId: true,
          parentId: true,
          sortOrder: true,
          isVisible: true,
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
  });
}

export async function getCreatorsForSelect() {
  return prisma.user.findMany({
    where: { role: { in: ["CREATOR", "DESIGNER", "ADMIN", "OWNER"] } },
    select: { id: true, username: true, displayName: true, role: true },
    orderBy: { username: "asc" },
    take: 200,
  });
}
