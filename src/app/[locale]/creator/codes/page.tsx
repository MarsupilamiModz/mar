import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/affiliate";
import type { Locale } from "@/i18n/config";

export default async function CreatorCodesPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  setRequestLocale(locale);
  const t = await getTranslations("ecosystem");
  const user = await requireAuth();

  const coupons = await prisma.coupon.findMany({
    where: { ownerUserId: user.id },
    orderBy: { usedCount: "desc" },
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{t("codes")}</h2>
      {coupons.length === 0 ? (
        <Card className="glass p-8 text-center text-muted-foreground">{t("noCodes")}</Card>
      ) : (
        coupons.map((c) => (
          <Card key={c.id} className="glass p-4 flex flex-wrap justify-between gap-3">
            <div>
              <p className="font-mono text-neon-purple">{c.code}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {c.type === "PERCENT" ? `${c.value / 100}%` : formatCents(c.value, locale)} · {c.affiliateType}
              </p>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <span>{c.clickCount} {t("clicks")}</span>
              <span>{c.usedCount} {t("uses")}</span>
              <span>{formatCents(c.revenueCents, locale)} {t("revenue")}</span>
              <Badge variant={c.isActive ? "default" : "outline"}>{c.isActive ? t("active") : t("inactive")}</Badge>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
