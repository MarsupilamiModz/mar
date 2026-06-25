import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ModCard } from "@/components/mods/mod-card";
import { GameHeroBanner } from "@/components/games/game-hero-banner";
import { CategorySidebar } from "@/components/games/category-sidebar";
import { GameModsExplorer } from "@/components/games/game-mods-explorer";
import { getGamePageData, getMods } from "@/lib/data";
import { getGameCategoriesWithStats } from "@/lib/game-discovery";
import { getGameCoverOverrides } from "@/lib/branding";
import { AdLocationSlot } from "@/components/ads/ad-location-slot";
import type { Locale } from "@/i18n/config";

const PAGE_SIZE = 24;

export async function GameLegacyBrowse({
  locale,
  slug,
  searchParams,
}: {
  locale: Locale;
  slug: string;
  searchParams: {
    q?: string;
    pricing?: string;
    category?: string;
    subcategory?: string;
    sort?: string;
    type?: string;
    verified?: string;
  };
}) {
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
    searchParams.q ||
      searchParams.category ||
      searchParams.subcategory ||
      searchParams.pricing ||
      searchParams.type ||
      searchParams.verified ||
      searchParams.sort
  );

  const { mods: filteredMods, total } = await getMods({
    gameSlug: slug,
    search: searchParams.q,
    pricing: searchParams.pricing,
    productType: searchParams.type,
    categorySlug: searchParams.category,
    subcategorySlug: searchParams.subcategory,
    sort: searchParams.sort,
    verified: searchParams.verified === "1",
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
    allPricing: tg("allPricing"),
    typeMod: tg("typeMod"),
    typeSound: tg("typeSound"),
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
                <CategorySidebar locale={locale} gameSlug={slug} categories={categories} />
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
