import { getPopularTags } from "@/lib/discovery";
import { getVelocityTrendingMods } from "@/lib/recommendations";
import { SearchPageClient } from "@/components/search/search-page-client";
import { prisma } from "@/lib/db";
import type { Locale } from "@/i18n/config";

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ q?: string; tag?: string; game?: string; sort?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;

  const [tags, games, trending] = await Promise.all([
    getPopularTags(30),
    prisma.game.findMany({
      where: { isActive: true },
      select: { slug: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
    getVelocityTrendingMods(8),
  ]);

  return (
    <SearchPageClient
      locale={locale}
      initialQuery={sp.q ?? ""}
      initialTag={sp.tag}
      initialGame={sp.game}
      initialSort={(sp.sort as "downloads" | "trending" | "rating" | "newest" | "updated" | "likes") ?? "downloads"}
      popularTags={tags}
      games={games}
      trendingMods={trending}
    />
  );
}
