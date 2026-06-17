import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ModsCatalogClient } from "@/components/mods/mods-catalog-client";
import { ModGridSkeleton } from "@/components/ui/page-skeleton";
import { AdLocationSlot } from "@/components/ads/ad-location-slot";
import { getAllGames, getMods } from "@/lib/data";
import { REVALIDATE } from "@/lib/cache";
import type { Locale } from "@/i18n/config";

export const revalidate = REVALIDATE.catalog;

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  const t = await getTranslations({ locale, namespace: "mods" });
  return { title: t("title") };
}

async function CatalogContent({
  locale,
  searchParams,
}: {
  locale: Locale;
  searchParams: {
    q?: string;
    game?: string;
    pricing?: string;
    page?: string;
    type?: string;
    audioCategory?: string;
    genre?: string;
  };
}) {
  const page = Number(searchParams.page) || 1;
  const [{ mods, total, pages }, games] = await Promise.all([
    getMods({
      search: searchParams.q,
      gameSlug: searchParams.game,
      pricing: searchParams.pricing,
      productType: searchParams.type,
      audioCategory: searchParams.audioCategory,
      genre: searchParams.genre,
      page,
    }),
    getAllGames(),
  ]);

  return (
    <ModsCatalogClient
      locale={locale}
      initialMods={mods}
      games={games}
      total={total}
      pages={pages}
      initialQuery={searchParams.q}
      initialGame={searchParams.game}
      initialPricing={searchParams.pricing}
      initialType={searchParams.type}
      initialAudioCategory={searchParams.audioCategory}
      initialGenre={searchParams.genre}
      initialPage={page}
      listingAdBreak={<AdLocationSlot location="listing" className="col-span-full my-2" />}
    />
  );
}

export default async function ModsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: {
    q?: string;
    game?: string;
    pricing?: string;
    page?: string;
    type?: string;
    audioCategory?: string;
    genre?: string;
  };
}) {
  const { locale } = await params;

  setRequestLocale(locale);
  const t = await getTranslations("mods");

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-gradient">{t("title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      <Suspense fallback={<ModGridSkeleton />}>
        <CatalogContent locale={locale} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
