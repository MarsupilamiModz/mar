import { unstable_cache } from "next/cache";
import { prisma, withDbRetry } from "@/lib/db";
import { CACHE_TAGS, REVALIDATE } from "@/lib/cache";
import { buildCategoryTree, type FlatCategory } from "@/lib/categories";
import type { GameModePickerMeta, GameModeCardData, GameModePickerSettings } from "@/lib/game-modes";

export type GameDiscoveryCardData = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  coverUrl: string | null;
  logoUrl: string | null;
  isFeatured: boolean;
  modCount: number;
  downloadCount: number;
  creatorCount: number;
  lastUpdated: Date | string | null;
  modeCount: number;
  soleModeSlug: string | null;
  modeBundle?: {
    modes: import("@/lib/game-modes").GameModeCardData[];
    picker: import("@/lib/game-modes").GameModePickerSettings;
  } | null;
};

export type CategoryDiscoveryNode = FlatCategory & {
  thumbnailUrl: string | null;
  bannerUrl: string | null;
  iconUrl: string | null;
  accentColor: string | null;
  modCount: number;
  children: CategoryDiscoveryNode[];
};

async function fetchGameDiscoveryStats() {
  return withDbRetry(async () => {
    const games = await prisma.game.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        shortDescription: true,
        coverUrl: true,
        logoUrl: true,
        isFeatured: true,
      },
    });

    if (games.length === 0) return [];

    const gameIds = games.map((g) => g.id);

    const [aggregates, creators, modes] = await Promise.all([
      prisma.mod.groupBy({
        by: ["gameId"],
        where: { gameId: { in: gameIds }, status: "PUBLISHED", visibility: "PUBLIC" },
        _count: { id: true },
        _sum: { downloadCount: true },
        _max: { updatedAt: true },
      }),
      prisma.mod.groupBy({
        by: ["gameId", "authorId"],
        where: { gameId: { in: gameIds }, status: "PUBLISHED" },
      }),
      prisma.gameMode.findMany({
        where: { gameId: { in: gameIds }, isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { gameId: true, slug: true },
      }),
    ]);

    const aggByGame = new Map(aggregates.map((a) => [a.gameId, a]));
    const creatorsByGame = new Map<string, number>();
    for (const row of creators) {
      creatorsByGame.set(row.gameId, (creatorsByGame.get(row.gameId) ?? 0) + 1);
    }

    const modeMeta: Record<string, GameModePickerMeta> = {};
    const multiModeGameIds: string[] = [];
    for (const id of gameIds) {
      const slugs = modes.filter((m) => m.gameId === id).map((m) => m.slug);
      modeMeta[id] = {
        modeCount: slugs.length,
        soleModeSlug: slugs.length === 1 ? slugs[0]! : null,
      };
      if (slugs.length > 1) multiModeGameIds.push(id);
    }

    const modeDetails =
      multiModeGameIds.length > 0
        ? await prisma.gameMode.findMany({
            where: { gameId: { in: multiModeGameIds }, isActive: true },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            select: {
              id: true,
              gameId: true,
              slug: true,
              name: true,
              description: true,
              thumbnailUrl: true,
              bannerUrl: true,
              backgroundUrl: true,
              logoUrl: true,
              iconUrl: true,
              accentColor: true,
            },
          })
        : [];

    const pickerRows =
      multiModeGameIds.length > 0
        ? await prisma.game.findMany({
            where: { id: { in: multiModeGameIds } },
            select: {
              id: true,
              modePickerOverlay: true,
              modePickerBlurPx: true,
              modePickerGlowEnabled: true,
              modePickerAnimation: true,
              modePickerOpacity: true,
            },
          })
        : [];

    const pickerByGame = new Map(pickerRows.map((g) => [g.id, g]));
    const modesByGame = new Map<string, typeof modeDetails>();
    for (const mode of modeDetails) {
      const list = modesByGame.get(mode.gameId) ?? [];
      list.push(mode);
      modesByGame.set(mode.gameId, list);
    }

    const modCountsByMode =
      modeDetails.length > 0
        ? await prisma.mod.groupBy({
            by: ["modeId"],
            where: {
              gameId: { in: multiModeGameIds },
              status: "PUBLISHED",
              visibility: "PUBLIC",
              modeId: { not: null },
            },
            _count: { id: true },
          })
        : [];
    const modeCountMap = new Map(modCountsByMode.map((r) => [r.modeId!, r._count.id]));

    return games.map((g) => {
      const agg = aggByGame.get(g.id);
      const meta = modeMeta[g.id] ?? { modeCount: 0, soleModeSlug: null };
      const pickerRow = pickerByGame.get(g.id);
      const gameModes = modesByGame.get(g.id);

      let modeBundle: GameDiscoveryCardData["modeBundle"] = null;
      if (meta.modeCount > 1 && gameModes?.length) {
        const animation = pickerRow?.modePickerAnimation ?? "fade";
        modeBundle = {
          modes: gameModes.map(
            (mode) =>
              ({
                ...mode,
                modCount: modeCountMap.get(mode.id) ?? 0,
              }) satisfies GameModeCardData
          ),
          picker: {
            overlayOpacity: pickerRow?.modePickerOverlay ?? 0.72,
            blurPx: pickerRow?.modePickerBlurPx ?? 16,
            glowEnabled: pickerRow?.modePickerGlowEnabled ?? true,
            animation:
              animation === "scale" || animation === "slide" ? animation : "fade",
            panelOpacity: pickerRow?.modePickerOpacity ?? 0.85,
          } satisfies GameModePickerSettings,
        };
      }

      return {
        ...g,
        modCount: agg?._count.id ?? 0,
        downloadCount: agg?._sum.downloadCount ?? 0,
        creatorCount: creatorsByGame.get(g.id) ?? 0,
        lastUpdated: agg?._max.updatedAt ?? null,
        modeCount: meta.modeCount,
        soleModeSlug: meta.soleModeSlug,
        modeBundle,
      } satisfies GameDiscoveryCardData;
    });
  }, { label: "games:discovery-stats" });
}

export const getGamesDiscoveryCards = unstable_cache(
  fetchGameDiscoveryStats,
  ["games-discovery-cards"],
  { revalidate: REVALIDATE.catalog, tags: [CACHE_TAGS.games] }
);

export async function getGameCategoriesWithStats(gameId: string, modeId?: string) {
  return unstable_cache(
    async () =>
      withDbRetry(async () => {
        const categoryWhere = {
          gameId,
          isVisible: true,
          ...(modeId ? { OR: [{ modeId: null }, { modeId }] } : {}),
        };

        const modWhere = {
          gameId,
          status: "PUBLISHED" as const,
          visibility: "PUBLIC" as const,
          categoryId: { not: null },
          ...(modeId ? { modeId } : {}),
        };

        const [categories, modCounts] = await Promise.all([
          prisma.gameCategory.findMany({
            where: categoryWhere,
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            select: {
              id: true,
              name: true,
              slug: true,
              description: true,
              sortOrder: true,
              isVisible: true,
              parentId: true,
              modeId: true,
              thumbnailUrl: true,
              bannerUrl: true,
              iconUrl: true,
              accentColor: true,
            },
          }),
          prisma.mod.groupBy({
            by: ["categoryId"],
            where: modWhere,
            _count: { id: true },
          }),
        ]);

      const countMap = new Map(
        modCounts.map((m) => [m.categoryId!, m._count.id])
      );

      const flat = categories.map((c) => ({
        ...c,
        modCount: countMap.get(c.id) ?? 0,
      }));

      const modCountById = new Map(flat.map((c) => [c.id, c.modCount]));
      const tree = buildCategoryTree(flat);

      const rollUp = (nodes: ReturnType<typeof buildCategoryTree>): CategoryDiscoveryNode[] =>
        nodes.map((n) => {
          const children = rollUp(n.children);
          const direct = modCountById.get(n.id) ?? 0;
          const childMods = children.reduce((s, ch) => s + ch.modCount, 0);
          return {
            ...n,
            thumbnailUrl: n.thumbnailUrl ?? null,
            bannerUrl: n.bannerUrl ?? null,
            iconUrl: n.iconUrl ?? null,
            accentColor: n.accentColor ?? null,
            modCount: direct + childMods,
            children,
          };
        });

      return rollUp(tree);
      }, { label: "games:category-stats" }),
    [`game-categories-discovery-${gameId}-${modeId ?? "all"}`],
    { revalidate: REVALIDATE.catalog, tags: [CACHE_TAGS.games, `game-${gameId}`] }
  )();
}

export function formatCompactCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}
