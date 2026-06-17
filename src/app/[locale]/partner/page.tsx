import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  getPartnerAnalytics,
  getUserCommissionSummary,
  getDailyChartData,
} from "@/lib/analytics/ecosystem";
import { StatGrid, ConversionChart, RevenueChart } from "@/components/analytics/ecosystem-charts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/affiliate";
import type { Locale } from "@/i18n/config";

export default async function PartnerPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  setRequestLocale(locale);
  const t = await getTranslations("ecosystem");
  const user = await requireAuth();

  const [profile, analytics, commission, chart] = await Promise.all([
    prisma.partnerProfile.findUnique({ where: { userId: user.id } }),
    getPartnerAnalytics(user.id).catch(() => null),
    getUserCommissionSummary(user.id).catch(() => ({
      pendingCents: 0,
      pendingCount: 0,
      paidCents: 0,
      paidCount: 0,
      payouts: [],
    })),
    getDailyChartData(user.id).catch(() => []),
  ]);

  return (
    <div className="space-y-8">
      <StatGrid
        stats={[
          { label: t("clicks"), value: String(analytics?.clicks ?? profile?.totalClicks ?? 0) },
          { label: t("conversions"), value: String(analytics?.conversions ?? profile?.totalConversions ?? 0) },
          {
            label: t("conversionRate"),
            value: `${(analytics?.conversionRate ?? 0).toFixed(1)}%`,
          },
          { label: t("revenue"), value: formatCents(analytics?.totalRevenue ?? 0, locale) },
          { label: t("commission"), value: formatCents(commission.pendingCents, locale), hint: t("pending") },
          { label: t("referrals"), value: String(analytics?.referrals ?? 0) },
        ]}
      />

      {profile?.affiliateCode && (
        <Card className="glass p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">{t("affiliateCode")}</p>
            <p className="font-mono text-lg text-neon-blue">{profile.affiliateCode}</p>
          </div>
          {profile.isVerified && <Badge variant="premium">{t("verified")}</Badge>}
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <ConversionChart data={chart} title={t("clicksConversions")} />
        <RevenueChart data={chart} title={t("revenueChart")} />
      </div>
    </div>
  );
}
