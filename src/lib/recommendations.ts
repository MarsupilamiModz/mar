import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { findModsListing } from "@/lib/data";

async function fetchSimilarMods(modId: string, gameId: string, limit: number) {
  const mod = await prisma.mod.findUnique({
    where: { id: modId },
    select: {
      id: true,
      authorId: true,
      categoryId: true,
      tags: { select: { name: true } },
    },
  });
  if (!mod) return [];

  const tagNames = mod.tags.map((t) => t.name.toLowerCase());
  const candidates = await prisma.mod.findMany({
    where: {
      status: "PUBLISHED",
      visibility: "PUBLIC",
      gameId,
      id: { not: modId },
    },
    select: {
      id: true,
      authorId: true,
      categoryId: true,
      tags: { select: { name: true } },
    },
    take: 40,
    orderBy: { downloadCount: "desc" },
  });

  const scored = candidates
    .map((c) => {
      let score = 0;
      if (mod.categoryId && c.categoryId === mod.categoryId) score += 3;
      if (c.authorId === mod.authorId) score += 2;
      const cTags = c.tags.map((t) => t.name.toLowerCase());
      score += cTags.filter((t) => tagNames.includes(t)).length * 2;
      return { id: c.id, score };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (scored.length === 0) {
    return findModsListing({
      where: { status: "PUBLISHED", visibility: "PUBLIC", gameId, id: { not: modId } },
      orderBy: { downloadCount: "desc" },
      take: limit,
    });
  }

  const ids = scored.map((s) => s.id);
  const mods = await findModsListing({
    where: { id: { in: ids } },
    take: limit,
  });
  const order = new Map(ids.map((id, i) => [id, i]));
  return mods.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
}

export function getSimilarMods(modId: string, gameId: string, limit = 4) {
  return unstable_cache(
    () => fetchSimilarMods(modId, gameId, limit),
    ["similar-mods", modId, gameId, String(limit)],
    { revalidate: 300, tags: [`mod-recs-${modId}`] }
  )();
}

async function fetchUsersAlsoDownloaded(modId: string, limit: number) {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const downloaderIds = (
    await prisma.download.findMany({
      where: { modId, createdAt: { gte: since }, userId: { not: null } },
      select: { userId: true },
      distinct: ["userId"],
      take: 200,
    })
  )
    .map((d) => d.userId)
    .filter((id): id is string => id != null);

  if (downloaderIds.length === 0) return [];

  const coDownloads = await prisma.download.groupBy({
    by: ["modId"],
    where: {
      modId: { not: modId },
      userId: { in: downloaderIds },
      createdAt: { gte: since },
    },
    _count: { modId: true },
    orderBy: { _count: { modId: "desc" } },
    take: limit,
  });

  if (coDownloads.length === 0) return [];

  const ids = coDownloads.map((c) => c.modId);
  const mods = await findModsListing({
    where: { id: { in: ids }, status: "PUBLISHED", visibility: "PUBLIC" },
    take: limit,
  });
  const order = new Map(ids.map((id, i) => [id, i]));
  return mods.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
}

export function getUsersAlsoDownloaded(modId: string, limit = 4) {
  return unstable_cache(
    () => fetchUsersAlsoDownloaded(modId, limit),
    ["also-downloaded", modId, String(limit)],
    { revalidate: 600, tags: [`mod-recs-${modId}`] }
  )();
}

export async function getVelocityTrendingMods(limit = 12, gameId?: string) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const grouped = await prisma.download.groupBy({
    by: ["modId"],
    where: {
      createdAt: { gte: since },
      mod: {
        status: "PUBLISHED",
        visibility: "PUBLIC",
        ...(gameId && { gameId }),
      },
    },
    _count: { modId: true },
    orderBy: { _count: { modId: "desc" } },
    take: limit,
  });

  if (grouped.length === 0) {
    const { getTrendingMods } = await import("@/lib/data");
    return getTrendingMods(limit, gameId);
  }

  const ids = grouped.map((g) => g.modId);
  const mods = await findModsListing({
    where: { id: { in: ids } },
    take: limit,
  });
  const order = new Map(ids.map((id, i) => [id, i]));
  return mods.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
}

async function fetchPersonalizedRecommendations(userId: string, limit: number) {
  const [follows, favorites, downloads] = await Promise.all([
    prisma.profileFollow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
      take: 30,
    }),
    prisma.modFavorite.findMany({
      where: { userId },
      select: {
        modId: true,
        mod: { select: { gameId: true, categoryId: true, authorId: true, tags: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    prisma.download.findMany({
      where: { userId },
      select: {
        modId: true,
        mod: { select: { gameId: true, categoryId: true, authorId: true, tags: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      distinct: ["modId"],
    }),
  ]);

  const followedAuthorIds = follows.map((f) => f.followingId);
  const gameIds = new Set<string>();
  const categoryIds = new Set<string>();
  const tagNames = new Set<string>();
  const exclude = new Set<string>();

  for (const row of favorites) {
    exclude.add(row.modId);
    if (row.mod.gameId) gameIds.add(row.mod.gameId);
    if (row.mod.categoryId) categoryIds.add(row.mod.categoryId);
    row.mod.tags.forEach((t) => tagNames.add(t.name.toLowerCase()));
  }
  for (const row of downloads) {
    exclude.add(row.modId);
    if (row.mod.gameId) gameIds.add(row.mod.gameId);
    if (row.mod.categoryId) categoryIds.add(row.mod.categoryId);
    row.mod.tags.forEach((t) => tagNames.add(t.name.toLowerCase()));
  }

  const where = {
    status: "PUBLISHED" as const,
    visibility: "PUBLIC" as const,
    id: { notIn: Array.from(exclude) },
    OR: [
      ...(followedAuthorIds.length ? [{ authorId: { in: followedAuthorIds } }] : []),
      ...(gameIds.size ? [{ gameId: { in: Array.from(gameIds) } }] : []),
      ...(categoryIds.size ? [{ categoryId: { in: Array.from(categoryIds) } }] : []),
      ...(tagNames.size
        ? [{ tags: { some: { name: { in: Array.from(tagNames), mode: "insensitive" as const } } } }]
        : []),
    ],
  };

  if (!where.OR?.length) {
    const { getTrendingMods } = await import("@/lib/data");
    return getTrendingMods(limit);
  }

  return findModsListing({
    where,
    orderBy: [{ isFeatured: "desc" }, { downloadCount: "desc" }],
    take: limit,
  });
}

export function getPersonalizedRecommendations(userId: string, limit = 8) {
  return unstable_cache(
    () => fetchPersonalizedRecommendations(userId, limit),
    ["personalized-recs", userId, String(limit)],
    { revalidate: 120, tags: [`user-recs-${userId}`] }
  )();
}
