import { requireAuth } from "@/lib/auth";
import { safeToLocaleString, safeToLocaleDateString, getIntlLocale } from "@/lib/i18n/safe-locale";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  getCreatorAnalytics,
  getCreatorVersionAnalytics,
  getDailyChartData,
  getUserCommissionSummary,
  type VersionAnalyticsRow,
} from "@/lib/analytics/ecosystem";
import { getCreatorSoundAnalytics } from "@/actions/sounds";
import { StatGrid, ConversionChart, RevenueChart } from "@/components/analytics/ecosystem-charts";
import { Card } from "@/components/ui/card";
import { formatCents } from "@/lib/affiliate";
import type { Locale } from "@/i18n/config";

export default async function CreatorAnalyticsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  setRequestLocale(locale);
  const t = await getTranslations("ecosystem");
  const user = await requireAuth();

  const [analytics, commission, chart, versionStats, soundStats] = await Promise.all([
    getCreatorAnalytics(user.id).catch(() => null),
    getUserCommissionSummary(user.id).catch(() => ({
      pendingCents: 0,
      pendingCount: 0,
      paidCents: 0,
      paidCount: 0,
      payouts: [],
    })),
    getDailyChartData(user.id).catch(() => []),
    getCreatorVersionAnalytics(user.id).catch((): VersionAnalyticsRow[] => []),
    getCreatorSoundAnalytics(user.id).catch(() => null),
  ]);

  return (
    <div className="space-y-8">
      <StatGrid
        stats={[
          { label: t("monthlyDownloads"), value: String(analytics?.monthlyDownloads ?? 0) },
          { label: "Total plays", value: String(soundStats?.totalPlays ?? 0) },
          { label: t("purchaseCount"), value: String(analytics?.purchaseCount ?? 0) },
          { label: t("revenue"), value: formatCents(analytics?.purchaseRevenue ?? 0, locale) },
          { label: "Conversion rate", value: `${soundStats?.conversionRate ?? 0}%` },
          { label: t("commission"), value: formatCents(commission.pendingCents, locale) },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <ConversionChart data={chart} title={t("engagement")} />
        <RevenueChart data={chart} title={t("revenueChart")} />
      </div>

      {versionStats.length > 0 && (
        <Card className="glass p-4">
          <h3 className="font-medium mb-3">Version downloads</h3>
          <div className="space-y-2">
            {versionStats.map((v) => (
              <div key={`${v.modSlug}-${v.version}`} className="flex justify-between text-sm border-b border-border/30 pb-2 last:border-0">
                <span>
                  {v.modTitle} v{v.version}
                  {v.isPrimary && " (latest)"}
                </span>
                <span className="text-muted-foreground">{safeToLocaleString(v.totalDownloads)} downloads</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {soundStats && soundStats.topSounds.length > 0 && (
        <Card className="glass p-4">
          <h3 className="font-medium mb-3">Most played sounds</h3>
          <div className="space-y-2">
            {soundStats.topSounds.map((s) => (
              <div key={s.id} className="flex justify-between text-sm border-b border-border/30 pb-2 last:border-0">
                <span>{s.title}</span>
                <span className="text-muted-foreground">
                  {safeToLocaleString(s.plays)} plays · {safeToLocaleString(s.downloads)} DL
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

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
