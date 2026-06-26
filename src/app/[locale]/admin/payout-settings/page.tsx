import { getAdminRevenueShareDashboard } from "@/actions/admin/revenue-sharing";
import { RevenueSharingPanel } from "@/components/admin/revenue-sharing-panel";

export const dynamic = "force-dynamic";

export default async function PayoutSettingsPage() {
  const result = await getAdminRevenueShareDashboard();
  if (!result.success) {
    return <p className="text-destructive">Failed to load payout settings.</p>;
  }

  return <RevenueSharingPanel data={result.data} />;
}
