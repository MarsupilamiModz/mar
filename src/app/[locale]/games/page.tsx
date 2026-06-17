import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAllGames } from "@/lib/data";
import { GameCard } from "@/components/games/game-card";
import { Card } from "@/components/ui/card";
import type { Locale } from "@/i18n/config";
import type { Metadata } from "next";
import { REVALIDATE } from "@/lib/cache";
import { SITE } from "@/lib/site";

export const revalidate = REVALIDATE.catalog;

export const metadata: Metadata = {
  title: "Games",
  description: `Browse all supported games on ${SITE.name} and discover premium mods.`,
};

export default async function GamesPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  setRequestLocale(locale);
  const t = await getTranslations("games");
  const games = await getAllGames().catch(() => []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-gradient">{t("title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {games.length === 0 ? (
          <Card className="glass col-span-full p-12 text-center text-muted-foreground">
            {t("empty")}
          </Card>
        ) : (
          games.map((game) => <GameCard key={game.id} locale={locale} game={game} />)
        )}
      </div>
    </div>
  );
}
