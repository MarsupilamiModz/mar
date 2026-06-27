import { getPartnerAdsCenterData } from "@/actions/admin/partner-ads";
import { requireStaff } from "@/lib/auth";
import { PartnerAdsAdminPanel } from "@/components/admin/partner-ads-admin-panel";
import { Badge } from "@/components/ui/badge";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

export default async function PartnerAdsAdminPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  void locale;
  await requireStaff();

  const result = await getPartnerAdsCenterData();
  if (!result.success) {
    return <p className="text-destructive">{result.error}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <Badge className="mb-2 bg-neon-purple/20 text-neon-purple border-neon-purple/40">
          Admin
        </Badge>
        <h1 className="text-2xl font-bold">Partner & Werbung</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Hosting Partner, Banner, Affiliate Links und Klick-Statistiken.
        </p>
      </div>
      <PartnerAdsAdminPanel data={result.data} />
    </div>
  );
}
