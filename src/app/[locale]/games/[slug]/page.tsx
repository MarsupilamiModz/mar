import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getGameBySlug } from "@/lib/data";
import { getGameModesForGame } from "@/lib/game-modes";
import { GameModePickerPage } from "@/components/games/game-mode-picker-page";
import { GameLegacyBrowse } from "@/components/games/game-legacy-browse";
import { REVALIDATE } from "@/lib/cache";
import { SITE } from "@/lib/site";
import type { Locale } from "@/i18n/config";

export const revalidate = REVALIDATE.catalog;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game) return { title: "Game Not Found" };

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

export default async function GameLandingPage({
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
  const tg = await getTranslations("games");

  const game = await getGameBySlug(slug);
  if (!game) notFound();

  const modes = await getGameModesForGame(game.id);

  if (modes.length === 1) {
    redirect(`/${locale}/games/${slug}/${modes[0]!.slug}`);
  }

  if (modes.length === 0) {
    return <GameLegacyBrowse locale={locale} slug={slug} searchParams={sp} />;
  }

  return (
    <GameModePickerPage
      locale={locale}
      game={{
        slug: game.slug,
        name: game.name,
        description: game.description,
        bannerUrl: game.bannerUrl,
        coverUrl: game.coverUrl,
      }}
      modes={modes}
      labels={{
        choosePlatform: tg("choosePlatform"),
        modesAvailable: tg("modesAvailable", { count: modes.length }),
      }}
    />
  );
}
