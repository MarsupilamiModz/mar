import { requireAdmin } from "@/lib/auth";
import { getAdminAdDashboard } from "@/actions/admin/ads";
import { AdsAdminPanel } from "@/components/admin/ads-admin-panel";

export default async function AdminAdsPage() {
  await requireAdmin();
  const result = await getAdminAdDashboard();
  if (!result.success) return <p className="text-destructive">{result.error}</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold">Advertising Management</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Configure ad providers, placements, and track performance.
      </p>
      <div className="mt-8">
        <AdsAdminPanel data={result.data} />
      </div>
    </div>
  );
}
