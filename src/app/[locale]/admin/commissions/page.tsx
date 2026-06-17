import { getTranslations, setRequestLocale } from "next-intl/server";
import { listCommissionRules, listPayouts } from "@/actions/admin/commissions";
import { CommissionsAdminPanel } from "@/components/admin/commissions-admin-panel";
import type { Locale } from "@/i18n/config";

export default async function AdminCommissionsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  setRequestLocale(locale);
  await getTranslations("ecosystem");

  const [rulesResult, payoutsResult] = await Promise.all([
    listCommissionRules(),
    listPayouts(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Commissions & Payouts</h1>
      <CommissionsAdminPanel
        locale={locale}
        rules={rulesResult.success ? rulesResult.data : []}
        payouts={payoutsResult.success ? payoutsResult.data : []}
      />
    </div>
  );
}
