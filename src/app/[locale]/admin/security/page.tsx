import { requirePagePermission } from "@/lib/auth";
import { getMalwareSettingsAdmin, getSecurityDashboardStats } from "@/actions/admin/security";
import { SecurityCenterPanel } from "@/components/admin/security-center-panel";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/config";

export default async function AdminSecurityPage({ params: { locale } }: { params: { locale: Locale } }) {
  setRequestLocale(locale);
  await requirePagePermission("settings.write");
  const t = await getTranslations("admin.security");

  const [settingsResult, statsResult] = await Promise.all([
    getMalwareSettingsAdmin(),
    getSecurityDashboardStats(),
  ]);

  const settings = settingsResult.success
    ? settingsResult.data
    : {
        virusTotalApiKey: "",
        scanThreshold: 2,
        autoApproveClean: true,
        requireManualReviewSuspicious: true,
        enabled: true,
        hasKey: false,
      };

  const stats = statsResult.success
    ? statsResult.data
    : { total: 0, clean: 0, suspicious: 0, malware: 0, blocked: 0, recent: [] };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("subtitle")}</p>
      </div>
      <SecurityCenterPanel settings={settings} stats={stats} />
    </div>
  );
}
