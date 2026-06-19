import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { CACHE_TAGS, REVALIDATE } from "@/lib/cache";
import { collectDescendantIds, type FlatCategory } from "@/lib/categories";

import { ensureModMediaSynced } from "@/lib/mod-media";

const modListSelect = {
  id: true,
  slug: true,
  title: true,
  shortDescription: true,
  pricing: true,
  downloadCount: true,
  averageRating: true,
  favoriteCount: true,
  game: { select: { name: true, slug: true } },
  screenshots: { take: 1, orderBy: { sortOrder: "asc" as const } },
  author: { select: { username: true, displayName: true, avatarUrl: true } },
  versions: {
    where: { isPrimary: true, isArchived: false },
    take: 1,
    select: {
      scanStatus: true,
      trustedFile: { select: { id: true } },
    },
  },
  productType: true,
  soundProfile: {
    select: {
      artist: true,
      audioCategory: true,
      genre: true,
      playCount: true,
      coverImageKey: true,
      previewDurationSeconds: true,
      durationSeconds: true,
    },
  },
};

const modListSelectWithMedia = {
  ...modListSelect,
  media: { orderBy: [{ isFeatured: "desc" as const }, { orderIndex: "asc" as const }] },
};

const modListSelectMinimal = {
  id: true,
  slug: true,
  title: true,
  shortDescription: true,
  pricing: true,
  downloadCount: true,
  averageRating: true,
  game: { select: { name: true, slug: true } },
  screenshots: { take: 1, orderBy: { sortOrder: "asc" as const } },
  author: { select: { username: true, displayName: true, avatarUrl: true } },
};

export async function findModsListing(args: NonNullable<Parameters<typeof prisma.mod.findMany>[0]> = {}) {
  const { include: _include, select: _select, ...rest } = args;

  try {
    return await prisma.mod.findMany({
      ...rest,
      select: modListSelectWithMedia,
    });
  } catch (err) {
    console.error("[findModsListing] media select failed", err);
    try {
      return await prisma.mod.findMany({
        ...rest,
        select: modListSelect,
      });
    } catch (err2) {
      console.error("[findModsListing] standard select failed", err2);
      return prisma.mod.findMany({
        ...rest,
        select: modListSelectMinimal,
      });
    }
  }
}

const modDetailInclude = {
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
  media: { orderBy: [{ isFeatured: "desc" as const }, { orderIndex: "asc" as const }] },
  screenshots: { orderBy: { sortOrder: "asc" as const } },
  videos: { orderBy: { sortOrder: "asc" as const } },
  tags: true,
  soundProfile: true,
  versions: {
    orderBy: { createdAt: "desc" as const },
    include: { trustedFile: { select: { id: true } } },
  },
  changelog: { orderBy: { createdAt: "desc" as const }, take: 10 },
  reviews: {
    take: 20,
    orderBy: { createdAt: "desc" as const },
    include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
  },
  dependencies: {
    include: {
      dependency: {
        select: {
          id: true,
          slug: true,
          title: true,
          status: true,
          game: { select: { name: true, slug: true } },
          versions: {
            where: { isPrimary: true },
            take: 1,
            select: { version: true, gameVersion: true },
          },
        },
      },
    },
  },
};

const modDetailIncludeNoMedia = {
  ...modDetailInclude,
  media: false as const,
};

export const getHomepageGames = unstable_cache(
  async () => {
    const select = {
      id: true,
      slug: true,
      name: true,
      description: true,
      shortDescription: true,
      iconUrl: true,
      bannerUrl: true,
      coverUrl: true,
      isFeatured: true,
      _count: { select: { mods: { where: { status: "PUBLISHED" as const } } } },
    };

    const featured = await prisma.game.findMany({
      where: { isActive: true, isFeatured: true },
      orderBy: { sortOrder: "asc" },
      take: 6,
      select,
    });

    if (featured.length > 0) return featured;

    return prisma.game.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      take: 6,
      select,
    });
  },
  ["homepage-games"],
  { revalidate: REVALIDATE.homepage, tags: [CACHE_TAGS.games, CACHE_TAGS.featured] }
);

/** @deprecated Use getHomepageGames */
export const getFeaturedGames = getHomepageGames;

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
      findModsListing({
        where: {
          status: "PUBLISHED",
          visibility: "PUBLIC",
          ...(gameId && { gameId }),
        },
        orderBy: { downloadCount: "desc" },
        take: limit,
      }),
    [`trending-mods-${limit}-${gameId ?? "all"}`],
    { revalidate: REVALIDATE.homepage, tags: [CACHE_TAGS.mods] }
  )();
}

export async function getPremiumMods(limit = 8, gameId?: string) {
  return unstable_cache(
    async () =>
      findModsListing({
        where: {
          status: "PUBLISHED",
          visibility: "PUBLIC",
          pricing: { in: ["PREMIUM", "PAID"] },
          ...(gameId && { gameId }),
        },
        orderBy: { downloadCount: "desc" },
        take: limit,
      }),
    [`premium-mods-${limit}-${gameId ?? "all"}`],
    { revalidate: REVALIDATE.catalog, tags: [CACHE_TAGS.mods] }
  )();
}

export async function getFeaturedMods(limit = 8, gameId?: string) {
  return unstable_cache(
    async () =>
      findModsListing({
        where: {
          status: "PUBLISHED",
          visibility: "PUBLIC",
          isFeatured: true,
          ...(gameId && { gameId }),
        },
        orderBy: { downloadCount: "desc" },
        take: limit,
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
  productType?: string;
  audioCategory?: string;
  genre?: string;
  page?: number;
  limit?: number;
}) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 24;
  const skip = (page - 1) * limit;

  if (filters.categorySlug && !filters.gameSlug) {
    return { mods: [], total: 0, pages: 0 };
  }

  let categoryFilter: string[] | undefined;
  if (filters.categorySlug && filters.gameSlug) {
    categoryFilter = await resolveCategoryFilter(filters.gameSlug, filters.categorySlug);
    if (!categoryFilter) {
      return { mods: [], total: 0, pages: 0 };
    }
  }

  const soundProfileFilter = {
    ...(filters.audioCategory && { audioCategory: filters.audioCategory as never }),
    ...(filters.genre && { genre: { equals: filters.genre, mode: "insensitive" as const } }),
  };

  const where = {
    status: "PUBLISHED" as const,
    visibility: "PUBLIC" as const,
    ...(filters.productType && filters.productType !== "ALL" && {
      productType: filters.productType as "MOD" | "SOUND",
    }),
    ...(filters.pricing && { pricing: filters.pricing as "FREE" | "PREMIUM" | "PAID" }),
    ...(filters.search && {
      OR: [
        { title: { contains: filters.search, mode: "insensitive" as const } },
        { description: { contains: filters.search, mode: "insensitive" as const } },
        { soundProfile: { artist: { contains: filters.search, mode: "insensitive" as const } } },
      ],
    }),
    ...(filters.gameSlug && { game: { slug: filters.gameSlug } }),
    ...(categoryFilter && { categoryId: { in: categoryFilter } }),
    ...(Object.keys(soundProfileFilter).length > 0 && { soundProfile: soundProfileFilter }),
  };

  const [mods, total] = await Promise.all([
    findModsListing({
      where,
      skip,
      take: limit,
      orderBy: { downloadCount: "desc" },
    }),
    prisma.mod.count({ where }),
  ]);

  return { mods, total, pages: Math.ceil(total / limit) };
}

export async function getModBySlug(slug: string) {
  const found = await prisma.mod.findUnique({ where: { slug }, select: { id: true } });
  if (found) await ensureModMediaSynced(found.id).catch(() => undefined);

  try {
    const mod = await prisma.mod.findUnique({
      where: { slug },
      include: modDetailInclude,
    });
    if (!mod) return null;
    return mod;
  } catch (err) {
    console.error("[getModBySlug] full include failed", err);
    try {
      const mod = await prisma.mod.findUnique({
        where: { slug },
        include: modDetailIncludeNoMedia,
      });
      if (!mod) return null;
      return { ...mod, media: [] };
    } catch (err2) {
      console.error("[getModBySlug] fallback include failed", err2);
      return null;
    }
  }
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

  const [featured, trending, premium, creatorCount] = await Promise.all([
    getFeaturedMods(8, game.id),
    getTrendingMods(12, game.id),
    getPremiumMods(8, game.id),
    prisma.mod.groupBy({
      by: ["authorId"],
      where: { gameId: game.id, status: "PUBLISHED" },
    }).then((rows) => rows.length),
  ]);

  return { game, featured, trending, premium, creatorCount };
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
