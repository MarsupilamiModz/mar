import { requirePagePermission } from "@/lib/auth";
import { getAdminSystemHealth, getAdminSystemLogs, getAdminPlatformMetrics } from "@/actions/admin/system";
import { SystemHealthPanel } from "@/components/admin/system-health-panel";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/config";

export default async function AdminSystemPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  setRequestLocale(locale);
  await requirePagePermission("settings.write");
  const t = await getTranslations("admin.system");

  const [logsResult, healthResult, metricsResult] = await Promise.all([
    getAdminSystemLogs(),
    getAdminSystemHealth(),
    getAdminPlatformMetrics(),
  ]);

  const logs = logsResult.success ? logsResult.data : [];
  const health = healthResult.success ? healthResult.data : [];
  const metrics = metricsResult.success ? metricsResult.data : null;

  const loadError = !logsResult.success
    ? logsResult.error
    : !healthResult.success
      ? healthResult.error
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>

      {loadError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      )}

      <SystemHealthPanel locale={locale} logs={logs} health={health} metrics={metrics} lazyAudit />
    </div>
  );
}
