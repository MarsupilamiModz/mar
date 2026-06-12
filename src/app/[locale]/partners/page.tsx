import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PartnerHubCard } from "@/components/partners/partner-hub-card";
import { SITE } from "@/lib/site";
import type { Locale } from "@/i18n/config";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Partners",
  description: `Verified affiliate partners on ${SITE.name}.`,
};

export default async function PartnersPage({ params: { locale } }: { params: { locale: Locale } }) {
  setRequestLocale(locale);
  const t = await getTranslations("ecosystem");
  const user = await getCurrentUser();

  const [featured, verified, elite, official, topPerforming] = await Promise.all([
    prisma.partnerProfile.findMany({
      where: { isFeatured: true, isBanned: false, isSuspended: false },
      orderBy: { totalConversions: "desc" },
      take: 6,
      include: { user: { select: { displayName: true, username: true, avatarUrl: true } }, socialLinks: { take: 4 } },
    }).catch(() => []),
    prisma.partnerProfile.findMany({
      where: { isVerified: true, isBanned: false, isSuspended: false },
      orderBy: { followerCount: "desc" },
      take: 12,
      include: { user: { select: { displayName: true, username: true, avatarUrl: true } }, socialLinks: { take: 4 } },
    }).catch(() => []),
    prisma.partnerProfile.findMany({
      where: { level: "ELITE", isBanned: false, isSuspended: false },
      take: 8,
      include: { user: { select: { displayName: true, username: true, avatarUrl: true } }, socialLinks: { take: 4 } },
    }).catch(() => []),
    prisma.partnerProfile.findMany({
      where: { level: "OFFICIAL_PARTNER", isBanned: false, isSuspended: false },
      take: 8,
      include: { user: { select: { displayName: true, username: true, avatarUrl: true } }, socialLinks: { take: 4 } },
    }).catch(() => []),
    prisma.partnerProfile.findMany({
      where: { isBanned: false, isSuspended: false },
      orderBy: { totalConversions: "desc" },
      take: 12,
      include: { user: { select: { displayName: true, username: true, avatarUrl: true } }, socialLinks: { take: 4 } },
    }).catch(() => []),
  ]);

  const sections = [
    { title: t("featuredPartners"), items: featured },
    { title: t("verifiedPartners"), items: verified },
    { title: t("elitePartners"), items: elite },
    { title: t("officialPartners"), items: official },
    { title: t("topPartners"), items: topPerforming },
  ];

  const hasAny = sections.some((s) => s.items.length > 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-gradient">{t("partnerHub")}</h1>
      <p className="mt-2 text-muted-foreground">{t("partnersSubtitle")}</p>

      {!hasAny ? (
        <Card className="glass mt-10 p-12 text-center text-muted-foreground">{t("noPartners")}</Card>
      ) : (
        <div className="mt-10 space-y-12">
          {sections.map(
            (section) =>
              section.items.length > 0 && (
                <section key={section.title}>
                  <h2 className="text-xl font-bold mb-6">{section.title}</h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {section.items.map((p) => (
                      <PartnerHubCard key={p.id} locale={locale} partner={p} t={t} />
                    ))}
                  </div>
                </section>
              )
          )}
        </div>
      )}

      <div className="mt-12 text-center space-y-3">
        {user ? (
          <Button variant="neon" asChild>
            <Link href={`/${locale}/become-partner`}>{t("becomePartner")}</Link>
          </Button>
        ) : (
          <Button variant="neon" asChild>
            <Link href={`/${locale}/login?redirect=${encodeURIComponent(`/${locale}/become-partner`)}`}>
              {t("becomePartner")}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
