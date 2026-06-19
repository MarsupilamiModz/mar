import { getUserSecurityDashboard } from "@/actions/security";
import { SecurityDashboardPanel } from "@/components/dashboard/security-dashboard-panel";
import { requireAuth } from "@/lib/auth";
import type { Locale } from "@/i18n/config";

export default async function SecuritySettingsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  await requireAuth(`/${locale}/dashboard/security`);
  const result = await getUserSecurityDashboard();
  const dashboard = result.success
    ? {
        ...result.data,
        mfaEnabledAt: result.data.mfaEnabledAt ?? null,
      }
    : {
        mfaEnabled: false,
        mfaEnabledAt: null,
        mfaRequired: false,
        backupCodesRemaining: 0,
        failedLoginAttempts: 0,
        recentEvents: [],
      };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Security</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Two-factor authentication, backup codes, and security history
        </p>
      </div>
      <SecurityDashboardPanel locale={locale} initial={dashboard} />
    </div>
  );
}
