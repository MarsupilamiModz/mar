import { requireAuth } from "@/lib/auth";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  getCreatorAnalytics,
  getDailyChartData,
  getUserCommissionSummary,
} from "@/lib/analytics/ecosystem";
import { StatGrid, ConversionChart, RevenueChart } from "@/components/analytics/ecosystem-charts";
import { Card } from "@/components/ui/card";
import { formatCents } from "@/lib/affiliate";
import type { Locale } from "@/i18n/config";

export default async function CreatorAnalyticsPage({ params: { locale } }: { params: { locale: Locale } }) {
  setRequestLocale(locale);
  const t = await getTranslations("ecosystem");
  const user = await requireAuth();

  const [analytics, commission, chart] = await Promise.all([
    getCreatorAnalytics(user.id).catch(() => null),
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
          { label: t("monthlyDownloads"), value: String(analytics?.monthlyDownloads ?? 0) },
          { label: t("purchaseCount"), value: String(analytics?.purchaseCount ?? 0) },
          { label: t("revenue"), value: formatCents(analytics?.purchaseRevenue ?? 0, locale) },
          { label: t("couponUses"), value: String(analytics?.couponUses ?? 0) },
          { label: t("couponRevenue"), value: formatCents(analytics?.couponRevenue ?? 0, locale) },
          { label: t("commission"), value: formatCents(commission.pendingCents, locale) },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <ConversionChart data={chart} title={t("engagement")} />
        <RevenueChart data={chart} title={t("revenueChart")} />
      </div>

      {analytics?.mods && analytics.mods.length > 0 && (
        <Card className="glass p-4">
          <h3 className="font-medium mb-3">{t("topProducts")}</h3>
          <div className="space-y-2">
            {analytics.mods.map((m) => (
              <div key={m.id} className="flex justify-between text-sm border-b border-border/30 pb-2 last:border-0">
                <span>{m.title}</span>
                <span className="text-muted-foreground">{m.downloadCount} DL</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
