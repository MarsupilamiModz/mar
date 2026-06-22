import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ModCard } from "@/components/mods/mod-card";
import { GameHeroBanner } from "@/components/games/game-hero-banner";
import { CategorySidebar } from "@/components/games/category-sidebar";
import { GameModsExplorer } from "@/components/games/game-mods-explorer";
import { getGamePageData, getMods } from "@/lib/data";
import { getGameCategoriesWithStats } from "@/lib/game-discovery";
import { getGameCoverOverrides } from "@/lib/branding";
import { AdLocationSlot } from "@/components/ads/ad-location-slot";
import { REVALIDATE } from "@/lib/cache";
import { SITE } from "@/lib/site";
import type { Locale } from "@/i18n/config";

export const revalidate = REVALIDATE.catalog;

const PAGE_SIZE = 24;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getGamePageData(slug);
  if (!data) return { title: "Game Not Found" };

  const { game } = data;
  return {
    title: game.seoTitle ?? `${game.name} Mods`,
    description: game.seoDescription ?? game.description ?? undefined,
    openGraph: {
      title: `${game.name} Mods | ${SITE.name}`,
      description: game.seoDescription ?? game.description ?? undefined,
      images: game.bannerUrl ? [{ url: game.bannerUrl }] : undefined,
    },
  };
}

export default async function GameDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
  searchParams: Promise<{
    q?: string;
    pricing?: string;
    category?: string;
    subcategory?: string;
    sort?: string;
    verified?: string;
  }>;
}) {
  const { locale, slug } = await params;
  const sp = await searchParams;

  setRequestLocale(locale);
  const t = await getTranslations("mods");
  const tg = await getTranslations("games");

  const pageData = await getGamePageData(slug);
  if (!pageData) notFound();

  const { game, featured, premium, creatorCount } = pageData;
  const [covers, categories] = await Promise.all([
    getGameCoverOverrides(),
    getGameCategoriesWithStats(game.id),
  ]);
  const cover = covers[game.id];
  const heroStyle = cover?.backgroundGradient
    ? { background: cover.backgroundGradient }
    : undefined;

  const hasActiveFilter = Boolean(
    sp.q || sp.category || sp.subcategory || sp.pricing || sp.verified || sp.sort
  );

  const { mods: filteredMods, total } = await getMods({
    gameSlug: slug,
    search: sp.q,
    pricing: sp.pricing,
    categorySlug: sp.category,
    subcategorySlug: sp.subcategory,
    sort: sp.sort,
    verified: sp.verified === "1",
    limit: PAGE_SIZE,
  });

  const pricingLabels: Record<string, string> = {
    FREE: t("free"),
    PREMIUM: t("premium"),
    PAID: t("paid"),
  };

  const explorerLabels = {
    search: t("search"),
    filter: t("filter"),
    allTypes: tg("allTypes"),
    free: t("free"),
    premium: t("premium"),
    paid: t("paid"),
    verified: tg("verifiedOnly"),
    sortDownloads: tg("sortDownloads"),
    sortLikes: tg("sortLikes"),
    sortDate: tg("sortDate"),
    results: hasActiveFilter ? tg("results") : tg("trendingMods"),
    noFilterResults: tg("noFilterResults"),
    noModsYet: tg("noModsYet"),
    loadMore: tg("loadMore"),
  };

  return (
    <div>
      <GameHeroBanner
        name={game.name}
        description={game.description}
        shortDescription={game.shortDescription}
        iconUrl={game.iconUrl}
        bannerUrl={cover?.heroBannerUrl ?? game.bannerUrl}
        coverUrl={game.coverUrl}
        isFeatured={game.isFeatured}
        modCount={game._count.mods}
        creatorCount={creatorCount}
        featuredLabel={tg("featured")}
        modsLabel={tg("modsCount", { count: game._count.mods })}
        creatorsLabel={tg("creatorsCount", { count: creatorCount })}
        banner={{
          bannerDisplayType: game.bannerDisplayType,
          bannerHeightPx: game.bannerHeightPx,
          bannerFocusX: game.bannerFocusX,
          bannerFocusY: game.bannerFocusY,
          bannerZoom: game.bannerZoom,
          bannerAlign: game.bannerAlign,
        }}
        gradientStyle={heroStyle}
      />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <AdLocationSlot location="category" className="mb-6" />

        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          {categories.length > 0 && (
            <aside className="w-full shrink-0 lg:sticky lg:top-24 lg:w-72">
              <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted/30" />}>
                <CategorySidebar
                  locale={locale}
                  gameSlug={slug}
                  categories={categories}
                />
              </Suspense>
            </aside>
          )}

          <div className="min-w-0 flex-1">
            {!hasActiveFilter && featured.length > 0 && (
              <section className="mb-12">
                <h2 className="mb-6 text-xl font-bold">{tg("featuredMods")}</h2>
                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                  {featured.map((mod) => (
                    <ModCard key={mod.id} locale={locale} mod={mod} pricingLabel={pricingLabels[mod.pricing]} />
                  ))}
                </div>
              </section>
            )}

            {!hasActiveFilter && premium.length > 0 && (
              <section className="mb-12">
                <h2 className="mb-6 text-xl font-bold">{tg("premiumMods")}</h2>
                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                  {premium.map((mod) => (
                    <ModCard key={mod.id} locale={locale} mod={mod} pricingLabel={pricingLabels[mod.pricing]} />
                  ))}
                </div>
              </section>
            )}

            <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted/30" />}>
              <GameModsExplorer
                locale={locale}
                gameSlug={slug}
                initialMods={filteredMods}
                initialTotal={total}
                pageSize={PAGE_SIZE}
                labels={explorerLabels}
                pricingLabels={pricingLabels}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
