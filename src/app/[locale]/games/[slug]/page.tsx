import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ModCard } from "@/components/mods/mod-card";
import { Button } from "@/components/ui/button";
import { CategoryNav } from "@/components/games/category-nav";
import { GameHeroBanner } from "@/components/games/game-hero-banner";
import { getGamePageData, getMods } from "@/lib/data";
import { getGameCoverOverrides } from "@/lib/branding";
import { AdLocationSlot } from "@/components/ads/ad-location-slot";
import { REVALIDATE } from "@/lib/cache";
import { SITE } from "@/lib/site";
import type { Locale } from "@/i18n/config";

export const revalidate = REVALIDATE.catalog;

export async function generateMetadata({
  params: { slug },
}: {
  params: { slug: string };
}): Promise<Metadata> {
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
  params: { locale, slug },
  searchParams,
}: {
  params: { locale: Locale; slug: string };
  searchParams: { q?: string; pricing?: string; category?: string };
}) {
  setRequestLocale(locale);
  const t = await getTranslations("mods");
  const tg = await getTranslations("games");

  const pageData = await getGamePageData(slug);
  if (!pageData) notFound();

  const { game, featured, premium, creatorCount } = pageData;
  const covers = await getGameCoverOverrides();
  const cover = covers[game.id];
  const heroStyle = cover?.backgroundGradient
    ? { background: cover.backgroundGradient }
    : undefined;

  const { mods: filteredMods } = await getMods({
    gameSlug: slug,
    search: searchParams.q,
    pricing: searchParams.pricing,
    categorySlug: searchParams.category,
    limit: 24,
  });

  const hasActiveFilter = Boolean(searchParams.q || searchParams.category);
  const showBrowseSections = !hasActiveFilter;

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

      {game.categories.length > 0 && (
        <CategoryNav
          locale={locale}
          gameSlug={slug}
          categories={game.categories}
          activeSlug={searchParams.category}
          allLabel={tg("allCategories")}
        />
      )}

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <AdLocationSlot location="category" className="mb-6" />
        <form className="flex flex-wrap gap-3 mb-10">
          {searchParams.category && (
            <input type="hidden" name="category" value={searchParams.category} />
          )}
          <input
            name="q"
            defaultValue={searchParams.q}
            placeholder={t("search")}
            className="flex h-10 max-w-md flex-1 rounded-md border border-input bg-background/50 px-3 text-sm"
          />
          <select
            name="pricing"
            defaultValue={searchParams.pricing}
            className="h-10 rounded-md border border-input bg-background/50 px-3 text-sm"
          >
            <option value="">{tg("allTypes")}</option>
            <option value="FREE">{t("free")}</option>
            <option value="PREMIUM">{t("premium")}</option>
            <option value="PAID">{t("paid")}</option>
          </select>
          <Button type="submit" variant="neon">{t("filter")}</Button>
        </form>

        {featured.length > 0 && showBrowseSections && (
          <section className="mb-12">
            <h2 className="text-xl font-bold mb-6">{tg("featuredMods")}</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {featured.map((mod) => (
                <ModCard key={mod.id} locale={locale} mod={mod} />
              ))}
            </div>
          </section>
        )}

        {premium.length > 0 && showBrowseSections && (
          <section className="mb-12">
            <h2 className="text-xl font-bold mb-6">{tg("premiumMods")}</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {premium.map((mod) => (
                <ModCard key={mod.id} locale={locale} mod={mod} />
              ))}
            </div>
          </section>
        )}

        <section className="mb-12">
          <h2 className="text-xl font-bold mb-6">
            {hasActiveFilter ? tg("results") : tg("trendingMods")}
          </h2>
          {filteredMods.length === 0 ? (
            <p className="text-muted-foreground py-12 text-center">
              {hasActiveFilter ? tg("noFilterResults") : tg("noModsYet")}
            </p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {filteredMods.map((mod) => (
                <ModCard key={mod.id} locale={locale} mod={mod} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
