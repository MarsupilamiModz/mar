import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ModCard } from "@/components/mods/mod-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SafeImage } from "@/components/ui/safe-image";
import { CategoryNav } from "@/components/games/category-nav";
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

  const { game, featured, trending, premium } = pageData;
  const covers = await getGameCoverOverrides();
  const cover = covers[game.id];
  const bannerUrl = cover?.heroBannerUrl ?? game.bannerUrl;
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

  return (
    <div>
      <section className="relative border-b border-border/40" style={heroStyle}>
        <div className="absolute inset-0 bg-gradient-to-b from-neon-purple/10 to-background" />
        {bannerUrl && (
          <div className="absolute inset-0 opacity-20">
            <SafeImage src={bannerUrl} alt="" fill className="object-cover" priority sizes="100vw" />
          </div>
        )}
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="flex flex-wrap items-center gap-4">
            {game.iconUrl ? (
              <div className="relative h-20 w-20 rounded-2xl overflow-hidden border border-neon-purple/30 shadow-neon">
                <SafeImage src={game.iconUrl} alt={game.name} fill className="object-cover" sizes="80px" />
              </div>
            ) : null}
            <div>
              {game.isFeatured && <Badge variant="premium" className="mb-2">{tg("featured")}</Badge>}
              <h1 className="text-4xl font-bold text-gradient">{game.name}</h1>
              {game.description && (
                <p className="mt-2 max-w-2xl text-muted-foreground">{game.description}</p>
              )}
              <p className="mt-2 text-sm text-neon-blue">{tg("modsCount", { count: game._count.mods })}</p>
            </div>
          </div>
        </div>
      </section>

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

        {featured.length > 0 && !searchParams.q && (
          <section className="mb-12">
            <h2 className="text-xl font-bold mb-6">{tg("featuredMods")}</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {featured.map((mod) => (
                <ModCard key={mod.id} locale={locale} mod={mod} />
              ))}
            </div>
          </section>
        )}

        {premium.length > 0 && !searchParams.q && (
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
            {searchParams.q || searchParams.category ? tg("results") : tg("trendingMods")}
          </h2>
          {filteredMods.length === 0 && trending.length === 0 ? (
            <p className="text-muted-foreground py-12 text-center">{tg("noModsYet")}</p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {(filteredMods.length ? filteredMods : trending).map((mod) => (
                <ModCard key={mod.id} locale={locale} mod={mod} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
