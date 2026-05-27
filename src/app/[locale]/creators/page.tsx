import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  getFeaturedCreatorsDiscovery,
  getTrendingCreators,
  getMostDownloadedCreators,
} from "@/lib/creators";
import { CreatorDiscoveryCard } from "@/components/creator/creator-discovery-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SITE } from "@/lib/site";
import type { Locale } from "@/i18n/config";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Creators",
  description: `Verified mod creators on ${SITE.name}.`,
};

export default async function CreatorsPage({ params: { locale } }: { params: { locale: Locale } }) {
  setRequestLocale(locale);
  const t = await getTranslations("ecosystem");

  const [featured, trending, mostDownloaded, mostActive] = await Promise.all([
    getFeaturedCreatorsDiscovery(6).catch(() => []),
    getTrendingCreators(6).catch(() => []),
    getMostDownloadedCreators(6).catch(() => []),
    getMostDownloadedCreators(6).catch(() => []),
  ]);

  const sections = [
    { title: t("featuredCreators"), items: featured },
    { title: t("trendingCreators"), items: trending },
    { title: t("mostDownloadedCreators"), items: mostDownloaded },
    { title: t("engagement"), items: mostActive },
  ];

  const hasAny = sections.some((s) => s.items.length > 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-gradient">{t("creatorDiscovery")}</h1>
      <p className="mt-2 text-muted-foreground">{t("creatorDiscoverySubtitle")}</p>

      {!hasAny ? (
        <Card className="glass mt-10 p-12 text-center">
          <p className="text-muted-foreground">{t("noCreators")}</p>
          <Button variant="neon" className="mt-4" asChild>
            <Link href={`/${locale}/register`}>{t("becomeCreator")}</Link>
          </Button>
        </Card>
      ) : (
        <div className="mt-10 space-y-12">
          {sections.map(
            (section) =>
              section.items.length > 0 && (
                <section key={section.title}>
                  <h2 className="text-xl font-bold mb-6">{section.title}</h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {section.items.map((c) => (
                      <CreatorDiscoveryCard
                        key={c.id}
                        locale={locale}
                        creator={c}
                      />
                    ))}
                  </div>
                </section>
              )
          )}
        </div>
      )}
    </div>
  );
}
