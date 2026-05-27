import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/affiliate";
import type { Locale } from "@/i18n/config";

export default async function PartnerCodesPage({ params: { locale } }: { params: { locale: Locale } }) {
  setRequestLocale(locale);
  const t = await getTranslations("ecosystem");
  const user = await requireAuth();

  const coupons = await prisma.coupon.findMany({
    where: { ownerUserId: user.id },
    orderBy: { conversionCount: "desc" },
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{t("affiliateCodes")}</h2>
      {coupons.map((c) => (
        <Card key={c.id} className="glass p-4 flex flex-wrap justify-between gap-3">
          <p className="font-mono text-neon-blue">{c.code}</p>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>{c.clickCount} clicks</span>
            <span>{c.conversionCount} conv.</span>
            <span>{formatCents(c.revenueCents, locale)}</span>
            <Badge variant={c.isActive ? "default" : "outline"}>{c.isActive ? "Active" : "Off"}</Badge>
          </div>
        </Card>
      ))}
    </div>
  );
}
