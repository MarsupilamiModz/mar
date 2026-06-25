import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ModCard } from "@/components/mods/mod-card";
import { GameHeroBanner } from "@/components/games/game-hero-banner";
import { CategorySidebar } from "@/components/games/category-sidebar";
import { GameModsExplorer } from "@/components/games/game-mods-explorer";
import { getMods } from "@/lib/data";
import { getGameCategoriesWithStats } from "@/lib/game-discovery";
import { getGameModeBySlug } from "@/lib/game-modes";
import { getGameCoverOverrides } from "@/lib/branding";
import { AdLocationSlot } from "@/components/ads/ad-location-slot";
import { REVALIDATE } from "@/lib/cache";
import { SITE } from "@/lib/site";
import type { Locale } from "@/i18n/config";
import { getFeaturedMods, getPremiumMods } from "@/lib/data";

export const revalidate = REVALIDATE.catalog;

const PAGE_SIZE = 24;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; modeSlug: string }>;
}): Promise<Metadata> {
  const { slug, modeSlug } = await params;
  const mode = await getGameModeBySlug(slug, modeSlug);
  if (!mode) return { title: "Not Found" };

  const title = `${mode.game.name} ${mode.name} Mods`;
  return {
    title: mode.game.seoTitle ? `${mode.name} | ${mode.game.seoTitle}` : title,
    description: mode.description ?? mode.game.seoDescription ?? mode.game.description ?? undefined,
    openGraph: {
      title: `${title} | ${SITE.name}`,
      description: mode.description ?? mode.game.seoDescription ?? undefined,
      images: mode.bannerUrl ?? mode.game.bannerUrl ? [{ url: mode.bannerUrl ?? mode.game.bannerUrl! }] : undefined,
    },
  };
}

export default async function GameModePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; slug: string; modeSlug: string }>;
  searchParams: Promise<{
    q?: string;
    pricing?: string;
    type?: string;
    category?: string;
    subcategory?: string;
    sort?: string;
    verified?: string;
  }>;
}) {
  const { locale, slug, modeSlug } = await params;
  const sp = await searchParams;

  setRequestLocale(locale);
  const t = await getTranslations("mods");
  const tg = await getTranslations("games");

  const mode = await getGameModeBySlug(slug, modeSlug);
  if (!mode) notFound();

  const { game } = mode;
  const [covers, categories, featured, premium] = await Promise.all([
    getGameCoverOverrides(),
    getGameCategoriesWithStats(game.id, mode.id),
    getFeaturedMods(8, game.id, mode.id),
    getPremiumMods(8, game.id, mode.id),
  ]);
  const cover = covers[game.id];
  const heroStyle = cover?.backgroundGradient
    ? { background: cover.backgroundGradient }
    : undefined;

  const hasActiveFilter = Boolean(
    sp.q || sp.category || sp.subcategory || sp.pricing || sp.type || sp.verified || sp.sort
  );

  const { mods: filteredMods, total } = await getMods({
    gameSlug: slug,
    modeSlug,
    search: sp.q,
    pricing: sp.pricing,
    productType: sp.type,
    categorySlug: sp.category,
    subcategorySlug: sp.subcategory,
    sort: sp.sort,
    verified: sp.verified === "1",
    limit: PAGE_SIZE,
  });

  const creatorCount = await import("@/lib/db").then(({ prisma }) =>
    prisma.mod.groupBy({
      by: ["authorId"],
      where: { gameId: game.id, modeId: mode.id, status: "PUBLISHED" },
    }).then((rows) => rows.length)
  );

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

  const heroBanner = mode.bannerUrl ?? cover?.heroBannerUrl ?? game.bannerUrl;
  const heroIcon = mode.iconUrl ?? game.iconUrl;

  return (
    <div>
      <GameHeroBanner
        name={`${game.name} — ${mode.name}`}
        description={mode.description ?? game.description}
        shortDescription={game.shortDescription}
        iconUrl={heroIcon}
        bannerUrl={heroBanner}
        coverUrl={mode.thumbnailUrl ?? game.coverUrl}
        isFeatured={game.isFeatured}
        modCount={mode._count.mods}
        creatorCount={creatorCount}
        featuredLabel={tg("featured")}
        modsLabel={tg("modsCount", { count: mode._count.mods })}
        creatorsLabel={tg("creatorsCount", { count: creatorCount })}
        banner={{
          bannerDisplayType: game.bannerDisplayType,
          bannerHeightPx: game.bannerHeightPx,
          bannerFocusX: game.bannerFocusX,
          bannerFocusY: game.bannerFocusY,
          bannerZoom: game.bannerZoom,
          bannerAlign: game.bannerAlign,
        }}
        gradientStyle={
          mode.accentColor
            ? { background: `linear-gradient(135deg, ${mode.accentColor}22, transparent)` }
            : heroStyle
        }
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
                  modeSlug={modeSlug}
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
                modeSlug={modeSlug}
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
