import { getPartnerAdsCenterData } from "@/actions/admin/partner-ads";
import { requireStaff } from "@/lib/auth";
import { PartnerAdsAdminPanel } from "@/components/admin/partner-ads-admin-panel";

export const dynamic = "force-dynamic";

export default async function PartnerAdsAdminPage() {
  await requireStaff();
  const result = await getPartnerAdsCenterData();
  if (!result.success) return <p className="text-destructive">{result.error}</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Partner & Werbung</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Hosting Partner — Name, Banner, Affiliate Link, Beschreibung.
        </p>
      </div>
      <PartnerAdsAdminPanel
        partners={result.data.partners}
        analytics={result.data.analytics}
      />
    </div>
  );
}
