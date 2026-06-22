import { unstable_cache } from "next/cache";
import { prisma, withDbRetry } from "@/lib/db";
import { CACHE_TAGS, REVALIDATE } from "@/lib/cache";

export type GameModeCardData = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  thumbnailUrl: string | null;
  bannerUrl: string | null;
  iconUrl: string | null;
  accentColor: string | null;
  modCount: number;
};

export type GameModePickerMeta = {
  modeCount: number;
  soleModeSlug: string | null;
};

async function fetchGameModePickerMeta(gameIds: string[]) {
  return withDbRetry(async () => {
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

    return Object.fromEntries(
      gameIds.map((id) => {
        const slugs = byGame.get(id) ?? [];
        return [
          id,
          {
            modeCount: slugs.length,
            soleModeSlug: slugs.length === 1 ? slugs[0]! : null,
          } satisfies GameModePickerMeta,
        ];
      })
    ) as Record<string, GameModePickerMeta>;
  }, { label: "games:mode-meta" });
}

export async function getGameModePickerMetaBatch(gameIds: string[]) {
  if (gameIds.length === 0) return {} as Record<string, GameModePickerMeta>;
  return unstable_cache(
    () => fetchGameModePickerMeta(gameIds),
    ["game-mode-picker-meta", ...gameIds.sort()],
    { revalidate: REVALIDATE.catalog, tags: [CACHE_TAGS.games] }
  )();
}

export async function getGameModesForGame(gameId: string) {
  return unstable_cache(
    async () =>
      withDbRetry(async () => {
        const [modes, modCounts] = await Promise.all([
          prisma.gameMode.findMany({
            where: { gameId, isActive: true },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            select: {
              id: true,
              slug: true,
              name: true,
              description: true,
              thumbnailUrl: true,
              bannerUrl: true,
              iconUrl: true,
              accentColor: true,
            },
          }),
          prisma.mod.groupBy({
            by: ["modeId"],
            where: {
              gameId,
              status: "PUBLISHED",
              visibility: "PUBLIC",
              modeId: { not: null },
            },
            _count: { id: true },
          }),
        ]);

        const countMap = new Map(modCounts.map((row) => [row.modeId!, row._count.id]));

        return modes.map(
          (mode) =>
            ({
              ...mode,
              modCount: countMap.get(mode.id) ?? 0,
            }) satisfies GameModeCardData
        );
      }, { label: "games:modes-for-game" }),
    [`game-modes-${gameId}`],
    { revalidate: REVALIDATE.catalog, tags: [CACHE_TAGS.games, `game-${gameId}`] }
  )();
}

export async function getGameModeBySlug(gameSlug: string, modeSlug: string) {
  return unstable_cache(
    async () =>
      prisma.gameMode.findFirst({
        where: {
          slug: modeSlug,
          isActive: true,
          game: { slug: gameSlug, isActive: true },
        },
        include: {
          game: {
            select: {
              id: true,
              slug: true,
              name: true,
              description: true,
              shortDescription: true,
              coverUrl: true,
              bannerUrl: true,
              iconUrl: true,
              logoUrl: true,
              isFeatured: true,
              bannerDisplayType: true,
              bannerHeightPx: true,
              bannerFocusX: true,
              bannerFocusY: true,
              bannerZoom: true,
              bannerAlign: true,
              seoTitle: true,
              seoDescription: true,
            },
          },
          _count: {
            select: { mods: { where: { status: "PUBLISHED", visibility: "PUBLIC" } } },
          },
        },
      }),
    [`game-mode-${gameSlug}-${modeSlug}`],
    {
      revalidate: REVALIDATE.catalog,
      tags: [CACHE_TAGS.games, `game-${gameSlug}`, `game-mode-${gameSlug}-${modeSlug}`],
    }
  )();
}

export async function getGameModesByGameSlug(gameSlug: string) {
  return withDbRetry(async () => {
    const game = await prisma.game.findUnique({
      where: { slug: gameSlug, isActive: true },
      select: { id: true },
    });
    if (!game) return [];
    return getGameModesForGame(game.id);
  }, { label: "games:modes-by-slug" });
}
