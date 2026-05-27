import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, Crown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ModCard } from "@/components/mods/mod-card";
import { GameCard } from "@/components/games/game-card";
import { getFeaturedGames, getTrendingMods } from "@/lib/data";
import { getActiveAnnouncements } from "@/actions/admin/announcements";
import { REVALIDATE } from "@/lib/cache";
import { AdLocationSlot } from "@/components/ads/ad-location-slot";
import type { Locale } from "@/i18n/config";

export const revalidate = REVALIDATE.homepage;

export default async function HomePage({ params: { locale } }: { params: { locale: Locale } }) {
  setRequestLocale(locale);
  const t = await getTranslations("landing");
  const tm = await getTranslations("mods");

  const [games, mods, announcements] = await Promise.all([
    getFeaturedGames().catch(() => []),
    getTrendingMods(8).catch(() => []),
    getActiveAnnouncements().catch(() => []),
  ]);

  const pricingLabels: Record<string, string> = {
    FREE: tm("free"),
    PREMIUM: tm("premium"),
    PAID: tm("paid"),
  };

  return (
    <div>
      {announcements.length > 0 && (
        <div className="border-b border-neon-purple/20 bg-neon-purple/5">
          <div className="mx-auto max-w-7xl px-4 py-2.5 sm:px-6">
            {announcements.map((a: { id: string; title: string; content: string; link: string | null }) => (
              <p key={a.id} className="text-center text-sm">
                <span className="font-medium text-neon-purple">{a.title}</span>
                <span className="text-muted-foreground"> — {a.content}</span>
                {a.link && (
                  <Link href={a.link} className="ml-2 text-neon-blue hover:underline">
                    →
                  </Link>
                )}
              </p>
            ))}
          </div>
        </div>
      )}

      <section className="relative overflow-hidden px-4 py-20 sm:px-6 lg:py-28">
        <div className="absolute inset-0 bg-hero-glow pointer-events-none" />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-neon-purple/30 bg-neon-purple/10 px-4 py-1.5 text-xs font-medium text-neon-purple">
            <Sparkles className="h-3.5 w-3.5" />
            {t("heroBadge")}
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl text-gradient leading-[1.1]">
            {t("heroTitle")}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed">
            {t("heroSubtitle")}
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Button variant="neon" size="lg" asChild>
              <Link href={`/${locale}/mods`} prefetch>
                {t("browseMods")} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href={`/${locale}/premium`} prefetch>
                <Crown className="h-4 w-4 mr-2" /> {t("goPremium")}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <AdLocationSlot location="homepage" className="mx-auto max-w-7xl px-4 sm:px-6" />

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="mb-8 flex items-end justify-between gap-4">
          <h2 className="text-2xl font-bold tracking-tight">{t("featuredGames")}</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/${locale}/games`}>{t("viewAllGames")}</Link>
          </Button>
        </div>
        {games.length === 0 ? (
          <Card className="glass p-12 text-center text-muted-foreground">{t("noGamesYet")}</Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((game) => (
              <GameCard key={game.id} locale={locale} game={game} />
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="mb-8 flex items-end justify-between gap-4">
          <h2 className="text-2xl font-bold tracking-tight">{t("trendingMods")}</h2>
          {mods.length > 0 && (
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/${locale}/mods`}>{t("viewAllMods")}</Link>
            </Button>
          )}
        </div>
        {mods.length === 0 ? (
          <Card className="glass p-12 text-center text-muted-foreground">{t("noModsYet")}</Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {mods.map((mod) => (
              <ModCard
                key={mod.id}
                locale={locale}
                mod={mod}
                pricingLabel={pricingLabels[mod.pricing] ?? mod.pricing}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <Card className="glass relative overflow-hidden border-neon-purple/25 p-8 sm:p-12 text-center">
          <div className="absolute inset-0 bg-gradient-to-br from-neon-purple/10 via-transparent to-neon-blue/10 pointer-events-none" />
          <div className="relative">
            <Crown className="mx-auto h-11 w-11 text-neon-purple mb-4" />
            <h2 className="text-2xl font-bold tracking-tight">{t("premiumBanner")}</h2>
            <p className="mt-3 text-muted-foreground max-w-lg mx-auto leading-relaxed">
              {t("premiumBannerDesc")}
            </p>
            <Button variant="neon" className="mt-7" asChild>
              <Link href={`/${locale}/premium`}>{t("premiumCta")}</Link>
            </Button>
          </div>
        </Card>
      </section>
    </div>
  );
}
