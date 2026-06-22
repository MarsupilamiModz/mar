import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PartnerHubCard } from "@/components/partners/partner-hub-card";
import { getFeaturedPartners, getVerifiedPartners, getTopPartners } from "@/lib/partners";
import { SITE } from "@/lib/site";
import type { Locale } from "@/i18n/config";
import type { Metadata } from "next";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Partners",
  description: `Verified affiliate partners on ${SITE.name}.`,
};

export default async function PartnersPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  setRequestLocale(locale);
  const t = await getTranslations("ecosystem");
  const user = await getCurrentUser();

  const [featured, verified, elite, official, topPerforming] = await Promise.all([
    getFeaturedPartners(6),
    getVerifiedPartners(12),
    prisma.partnerProfile.findMany({
      where: { isPublic: true, level: "ELITE", isBanned: false, isSuspended: false },
      take: 8,
      include: { user: { select: { displayName: true, username: true, avatarUrl: true } }, socialLinks: { take: 4 } },
    }).catch(() => []),
    prisma.partnerProfile.findMany({
      where: { isPublic: true, level: "OFFICIAL_PARTNER", isBanned: false, isSuspended: false },
      take: 8,
      include: { user: { select: { displayName: true, username: true, avatarUrl: true } }, socialLinks: { take: 4 } },
    }).catch(() => []),
    getTopPartners(12),
  ]);

  const sections = [
    { title: t("featuredPartners"), items: featured },
    { title: t("verifiedPartners"), items: verified },
    { title: t("elitePartners"), items: elite },
    { title: t("officialPartners"), items: official },
    { title: t("topPartners"), items: topPerforming },
  ].filter((s) => s.items.length > 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-bold">{t("partners")}</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">{t("partnersSubtitle")}</p>
        </div>
        <Button variant="neon" asChild>
          <Link href={user ? `/${locale}/become-partner` : `/${locale}/login?redirect=/${locale}/become-partner`}>
            {t("becomePartner")}
          </Link>
        </Button>
      </div>

      {sections.length === 0 ? (
        <Card className="glass p-12 text-center text-muted-foreground">{t("noPartners")}</Card>
      ) : (
        sections.map((section) => (
          <section key={section.title} className="mb-12">
            <h2 className="text-xl font-bold mb-6">{section.title}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {section.items.map((p) => (
                <PartnerHubCard key={p.id} locale={locale} partner={p} t={t} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
