import { getAdminReferrals } from "@/actions/admin/referrals";
import { ReferralsAdminPanel } from "@/components/admin/referrals-admin-panel";
import { requirePagePermission } from "@/lib/auth";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

export default async function AdminReferralsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  await requirePagePermission("settings.write");

  const result = await getAdminReferrals();
  if (!result.success) {
    return <p className="text-destructive text-sm">{result.error}</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Referral Management</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create referral links with free premium trials. Links format: /register?ref=CODE
        </p>
      </div>
      <ReferralsAdminPanel data={result.data} locale={locale} />
    </div>
  );
}
