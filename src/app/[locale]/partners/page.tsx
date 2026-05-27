import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SITE } from "@/lib/site";
import type { Locale } from "@/i18n/config";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Partners",
  description: `Affiliate partners on ${SITE.name}.`,
};

export default async function PartnersPage({ params: { locale } }: { params: { locale: Locale } }) {
  setRequestLocale(locale);
  const t = await getTranslations("ecosystem");

  const partners = await prisma.partnerProfile.findMany({
    where: { isVerified: true, isBanned: false, isSuspended: false },
    orderBy: { totalRevenueCents: "desc" },
    take: 24,
    include: {
      user: { select: { displayName: true, username: true, avatarUrl: true } },
    },
  }).catch(() => []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-gradient">{t("partners")}</h1>
      <p className="mt-2 text-muted-foreground">{t("partnersSubtitle")}</p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {partners.length === 0 ? (
          <Card className="glass col-span-full p-12 text-center text-muted-foreground">{t("noPartners")}</Card>
        ) : (
          partners.map((p) => (
            <Link key={p.id} href={`/${locale}/partners/${p.slug}`}>
              <Card className="glass p-6 hover:border-neon-blue/40 transition-colors h-full">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{p.user.displayName ?? p.user.username}</p>
                  {p.isFeatured && <Badge variant="premium">{t("featured")}</Badge>}
                </div>
                <p className="text-sm text-muted-foreground mt-1">{p.tagline ?? t("partner")}</p>
                <p className="text-xs text-neon-blue mt-3">{p.totalConversions} {t("conversions")}</p>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
