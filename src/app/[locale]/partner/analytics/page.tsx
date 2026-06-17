import { requireAuth } from "@/lib/auth";
import { getPartnerAnalytics, getDailyChartData } from "@/lib/analytics/ecosystem";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { StatGrid, ConversionChart, RevenueChart } from "@/components/analytics/ecosystem-charts";
import { formatCents } from "@/lib/affiliate";
import type { Locale } from "@/i18n/config";

export default async function PartnerAnalyticsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  setRequestLocale(locale);
  const t = await getTranslations("ecosystem");
  const user = await requireAuth();

  const [analytics, chart] = await Promise.all([
    getPartnerAnalytics(user.id).catch(() => null),
    getDailyChartData(user.id).catch(() => []),
  ]);

  return (
    <div className="space-y-8">
      <StatGrid
        stats={[
          { label: t("clicks"), value: String(analytics?.clicks ?? 0) },
          { label: t("conversions"), value: String(analytics?.conversions ?? 0) },
          { label: t("totalUses"), value: String(analytics?.totalUses ?? 0) },
          { label: t("totalDiscount"), value: formatCents(analytics?.totalDiscount ?? 0, locale) },
        ]}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <ConversionChart data={chart} title={t("clicksConversions")} />
        <RevenueChart data={chart} title={t("revenueChart")} />
      </div>
    </div>
  );
}
