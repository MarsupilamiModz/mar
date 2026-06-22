import { unstable_cache } from "next/cache";
import { prisma, withDbRetry } from "@/lib/db";
import { CACHE_TAGS, REVALIDATE } from "@/lib/cache";
import { withPlatformCache, PLATFORM_CACHE_KEYS } from "@/lib/platform-cache";

export type NavGameItem = {
  id: string;
  slug: string;
  name: string;
  coverUrl: string | null;
  logoUrl: string | null;
  modeCount: number;
  soleModeSlug: string | null;
};

async function fetchNavGames(): Promise<NavGameItem[]> {
  return withDbRetry(async () => {
    const games = await prisma.game.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: 24,
      select: {
        id: true,
        slug: true,
        name: true,
        coverUrl: true,
        logoUrl: true,
        bannerUrl: true,
      },
    });

    if (games.length === 0) return [];

    const gameIds = games.map((g) => g.id);
    const modes = await prisma.gameMode.findMany({
      where: { gameId: { in: gameIds }, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { gameId: true, slug: true },
    });

    const byGame = new Map<string, string[]>();
    for (const mode of modes) {
      const list = byGame.get(mode.gameId) ?? [];
      list.push(mode.slug);
      byGame.set(mode.gameId, list);
    }

    return games.map((g) => {
      const slugs = byGame.get(g.id) ?? [];
      return {
        id: g.id,
        slug: g.slug,
        name: g.name,
        coverUrl: g.coverUrl ?? g.bannerUrl,
        logoUrl: g.logoUrl,
        modeCount: slugs.length,
        soleModeSlug: slugs.length === 1 ? slugs[0]! : null,
      };
    });
  }, { label: "nav:games" });
}

const getNavGamesCached = unstable_cache(
  fetchNavGames,
  ["nav-games"],
  { revalidate: REVALIDATE.catalog, tags: [CACHE_TAGS.games] }
);

/** Header hover menu — Redis layer + Next cache. */
export async function getNavGames(): Promise<NavGameItem[]> {
  return withPlatformCache(PLATFORM_CACHE_KEYS.navGames, getNavGamesCached, {
    ttlSeconds: REVALIDATE.catalog,
    tag: CACHE_TAGS.games,
  });
}
